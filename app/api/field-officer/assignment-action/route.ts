import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { verifyAuth } from '@/lib/auth';

export async function POST(request: NextRequest) {
    try {
        const { user, error } = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ ok: false, error: error || 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { assignment_id, action, reason } = body;

        if (!assignment_id || !['accept', 'reject'].includes(action)) {
            return NextResponse.json({ ok: false, error: 'Invalid parameters' }, { status: 422 });
        }

        if (action === 'reject' && !reason) {
            return NextResponse.json({ ok: false, error: 'Rejection reason is required' }, { status: 422 });
        }

        const pool = getDbPool();
        const connection = await pool.getConnection();

        try {
            // First check if the assignment belongs to this user and is still pending
            const [rows]: any = await connection.query(
                'SELECT a.id, a.survey_id, s.aadhaar_id FROM survey_assignments a JOIN surveys s ON a.survey_id = s.id WHERE a.id = ? AND a.field_officer_id = ? LIMIT 1',
                [assignment_id, user.id]
            );

            if (rows.length === 0) {
                return NextResponse.json({ ok: false, error: 'Assignment not found' }, { status: 404 });
            }

            const assignment = rows[0];
            const newStatus = action === 'accept' ? 'accepted' : 'rejected';

            // Update assignment
            await connection.execute(
                'UPDATE survey_assignments SET status = ?, rejection_reason = ? WHERE id = ?',
                [newStatus, action === 'reject' ? reason : null, assignment_id]
            );

            // If rejected, unassign the survey itself so it can be reassigned
            if (action === 'reject') {
                await connection.execute(
                    'UPDATE surveys SET user_id = 1, source = "Divyang Self" WHERE id = ?',
                    [assignment.survey_id]
                );
            }

            // Log activity
            await connection.execute(
                `INSERT INTO survey_activity_logs (user_id, type, aadhaar_id, details) 
         VALUES (?, ?, ?, ?)`,
                [
                    user.id,
                    action === 'accept' ? 'ASSIGNMENT_ACCEPTED' : 'ASSIGNMENT_REJECTED',
                    assignment.aadhaar_id,
                    JSON.stringify({
                        assignment_id,
                        survey_id: assignment.survey_id,
                        reason: action === 'reject' ? reason : null
                    })
                ]
            );

            // Notify Admins and Verification Officers
            const notifTitle = action === 'accept' ? 'सर्वेक्षण स्वीकारले' : 'सर्वेक्षण नाकारले';
            const notifMessage = `${user.name || 'Field Officer'} ने सर्वेक्षण ${action === 'accept' ? 'स्वीकारले' : 'नाकारले'} आहे. (Aadhaar ID: ${assignment.aadhaar_id})${action === 'reject' ? `\nकारण: ${reason}` : ''}`;

            await connection.execute(
                `INSERT INTO notifications (user_id, from_user_id, field_officer_id, type, title, message, data, target_user_type, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    null,
                    user.id,
                    user.id,
                    action === 'accept' ? 'assignment_accepted' : 'assignment_rejected',
                    notifTitle,
                    notifMessage,
                    JSON.stringify({
                        survey_id: assignment.survey_id,
                        assignment_id,
                        field_officer_id: user.id,
                        aadhaar_id: assignment.aadhaar_id,
                        reason: action === 'reject' ? reason : null
                    }),
                    'admin_all' // Custom type to target both Admin and VO
                ]
            );

            Logger.info(`ASSIGNMENT_${action.toUpperCase()}`, { userId: user.id, assignment_id });

            return NextResponse.json({ ok: true });
        } finally {
            connection.release();
        }
    } catch (err: any) {
        Logger.error('ASSIGNMENT_ACTION_FAILED', { error: err.message });
        return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
    }
}
