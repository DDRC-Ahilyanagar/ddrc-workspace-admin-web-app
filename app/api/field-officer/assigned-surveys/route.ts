import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/field-officer/assigned-surveys
 * Get surveys assigned to the current field officer
 */
export async function GET(request: NextRequest) {
    try {
        const authResult = await verifyAuth(request);
        if (!authResult.user || authResult.error) {
            return NextResponse.json(
                { ok: false, error: authResult.error || 'Unauthorized' },
                { status: 401 }
            );
        }

        const user = authResult.user;
        const userType = (user.user_type || '').toLowerCase().trim();

        // Allow both field officers and verification officers to access assigned surveys
        const allowedRoles = ['field_officer', 'field officer', 'verification_officer', 'verification officer'];
        if (!allowedRoles.includes(userType)) {
            Logger.warn('ASSIGNED_SURVEYS_ACCESS_DENIED', {
                user_id: user.id,
                user_name: user.name,
                user_type: user.user_type,
                message: 'User is not a field officer or verification officer'
            });
            return NextResponse.json(
                { ok: false, error: `Only field officers and verification officers can access assigned surveys. Your current role is: ${user.user_type || 'unknown'}` },
                { status: 403 }
            );
        }

        const pool = getDbPool();
        const conn = await pool.getConnection();

        try {
            let rows: any;
            
            // Check if user is a verification officer
            const isVerificationOfficer = userType === 'verification_officer' || userType === 'verification officer';
            
            if (isVerificationOfficer) {
                // For verification officers, get surveys assigned via surveys.assigned_to
                // Check if assigned_to column exists
                const [columns]: any = await conn.query(`
                    SELECT COLUMN_NAME 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'surveys' 
                    AND COLUMN_NAME = 'assigned_to'
                `);
                
                if (Array.isArray(columns) && columns.length > 0) {
                    // Column exists, query using assigned_to
                    [rows] = await conn.query(`
                        SELECT 
                          s.id,
                          s.survey_json,
                          s.source,
                          s.verification_status as survey_status,
                          NULL as assignment_id,
                          s.verification_status as assignment_status,
                          s.updated_at as assigned_at,
                          NULL as rejection_reason
                        FROM surveys s
                        WHERE s.assigned_to = ?
                        ORDER BY s.updated_at DESC
                    `, [user.id]);
                } else {
                    // Column doesn't exist, return empty array
                    rows = [];
                }
            } else {
                // For field officers, get surveys from survey_assignments
                [rows] = await conn.query(`
                    SELECT 
                      s.id,
                      s.survey_json,
                      s.source,
                      s.verification_status as survey_status,
                      sa.id as assignment_id,
                      sa.status as assignment_status,
                      sa.assigned_at,
                      sa.rejection_reason
                    FROM survey_assignments sa
                    JOIN surveys s ON sa.survey_id = s.id
                    WHERE sa.field_officer_id = ?
                    ORDER BY sa.assigned_at DESC
                `, [user.id]);
            }

            const surveys = Array.isArray(rows) ? rows.map((row: any) => {
                let surveyData = {};
                try {
                    surveyData = typeof row.survey_json === 'string'
                        ? JSON.parse(row.survey_json)
                        : row.survey_json;
                } catch (e: any) {
                    Logger.error('PARSE_SURVEY_JSON_ERROR', { survey_id: row.id, error: e.message });
                }

                return {
                    id: row.id,
                    assignment_id: row.assignment_id,
                    survey_data: surveyData,
                    source: row.source,
                    survey_status: row.survey_status,
                    assignment_status: row.assignment_status,
                    assigned_at: row.assigned_at,
                    rejection_reason: row.rejection_reason,
                };
            }) : [];

            return NextResponse.json({
                ok: true,
                surveys: surveys
            });
        } finally {
            conn.release();
        }
    } catch (error: any) {
        Logger.error('GET_ASSIGNED_SURVEYS_ERROR', { error: error?.message || String(error) });
        return NextResponse.json(
            { ok: false, error: error?.message || 'Failed to fetch assigned surveys' },
            { status: 500 }
        );
    }
}
