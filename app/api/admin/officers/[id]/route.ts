import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { getAbsoluteImageUrl } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * Get detailed profile information for a specific field officer
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const officerId = params.id;
    
    if (!officerId) {
      return NextResponse.json(
        { ok: false, error: 'Officer ID is required' },
        { status: 400 }
      );
    }

    const pool = getDbPool();
    const conn = await pool.getConnection();

    try {
      // Get user basic information
      const [userRows]: any = await conn.query(
        `SELECT u.id, u.name, u.contact_number, u.email, u.status, u.is_active, 
                u.created_at, u.updated_at, u.last_login
         FROM users u
         WHERE u.id = ? AND u.user_type = 'field_officer'
         LIMIT 1`,
        [officerId]
      );

      if (!Array.isArray(userRows) || userRows.length === 0) {
        return NextResponse.json(
          { ok: false, error: 'Field officer not found' },
          { status: 404 }
        );
      }

      const user = userRows[0];

      // Get field officer profile information
      const [profileRows]: any = await conn.query(
        `SELECT fop.profile_photo, fop.taluka, fop.primary_gaav, fop.additional_gaavs,
                fop.account_holder_name, fop.account_number, fop.bank_name, 
                fop.ifsc_code, fop.upi_id, fop.qr_code, fop.profile_complete,
                fop.created_at, fop.updated_at
         FROM field_officer_profiles fop
         WHERE fop.user_id = ?
         LIMIT 1`,
        [officerId]
      );

      const profile = Array.isArray(profileRows) && profileRows.length > 0 
        ? profileRows[0] 
        : null;

      // Get survey statistics
      const [completedCount]: any = await conn.query(
        `SELECT COUNT(*) as count FROM surveys 
         WHERE user_id = ? AND no_of_questions_unanswered = 0`,
        [officerId]
      );
      const completedSurveys = completedCount && Array.isArray(completedCount) && completedCount.length > 0
        ? Number(completedCount[0].count || 0)
        : 0;

      const [incompleteCount]: any = await conn.query(
        `SELECT COUNT(*) as count FROM surveys 
         WHERE user_id = ? AND no_of_questions_unanswered > 0`,
        [officerId]
      );
      const incompleteSurveys = incompleteCount && Array.isArray(incompleteCount) && incompleteCount.length > 0
        ? Number(incompleteCount[0].count || 0)
        : 0;

      // Get rate per survey
      const [rateRows]: any = await conn.query(
        `SELECT setting_value FROM app_settings WHERE setting_key = ? LIMIT 1`,
        ['rate_per_survey_field_officer']
      );
      const ratePerSurvey = rateRows && Array.isArray(rateRows) && rateRows.length > 0
        ? parseFloat((rateRows[0] as any).setting_value || '0')
        : 0;

      const walletBalance = completedSurveys * ratePerSurvey;

      // Parse additional_gaavs JSON
      let additionalGaavs: string[] = [];
      if (profile && profile.additional_gaavs) {
        try {
          additionalGaavs = typeof profile.additional_gaavs === 'string'
            ? JSON.parse(profile.additional_gaavs)
            : profile.additional_gaavs;
          if (!Array.isArray(additionalGaavs)) {
            additionalGaavs = [];
          }
        } catch (e) {
          additionalGaavs = [];
        }
      }

      return NextResponse.json({
        ok: true,
        data: {
          id: user.id.toString(),
          name: user.name,
          phone: user.contact_number || null,
          email: user.email || null,
          status: user.status || null,
          isActive: user.is_active === 1,
          createdAt: user.created_at ? new Date(user.created_at).toISOString() : null,
          updatedAt: user.updated_at ? new Date(user.updated_at).toISOString() : null,
          lastLogin: user.last_login ? new Date(user.last_login).toISOString() : null,
          profile: profile ? {
            profilePhoto: profile.profile_photo ? getAbsoluteImageUrl(profile.profile_photo) : null,
            taluka: profile.taluka || null,
            primaryGaav: profile.primary_gaav || null,
            additionalGaavs: additionalGaavs,
            accountHolderName: profile.account_holder_name || null,
            accountNumber: profile.account_number || null,
            bankName: profile.bank_name || null,
            ifscCode: profile.ifsc_code || null,
            upiId: profile.upi_id || null,
            qrCode: profile.qr_code ? getAbsoluteImageUrl(profile.qr_code) : null,
            profileComplete: profile.profile_complete === 1,
            createdAt: profile.created_at ? new Date(profile.created_at).toISOString() : null,
            updatedAt: profile.updated_at ? new Date(profile.updated_at).toISOString() : null,
          } : null,
          statistics: {
            completedSurveys,
            incompleteSurveys,
            totalSurveys: completedSurveys + incompleteSurveys,
            walletBalance: walletBalance.toFixed(2),
            ratePerSurvey,
          },
        },
      });
    } finally {
      conn.release();
    }
  } catch (error: any) {
    console.error('Error fetching officer profile:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch officer profile' },
      { status: 500 }
    );
  }
}
