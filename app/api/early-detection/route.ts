import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { verifyAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await verifyAuth(request);
    if (!user || error) {
      return NextResponse.json({ ok: false, error: error || 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    const pool = getDbPool();
    
    if (phone) {
      // Get all babies for a specific parent phone
      const [rows] = await pool.query(
        `SELECT * FROM early_detection_babies 
         WHERE parent_phone = ? 
         ORDER BY created_at DESC`,
        [phone]
      );
      
      return NextResponse.json({
        ok: true,
        babies: rows,
        count: Array.isArray(rows) ? rows.length : 0,
      });
    } else {
      // Get all records (with pagination)
      const page = parseInt(searchParams.get('page') || '1');
      const limit = parseInt(searchParams.get('limit') || '50');
      const offset = (page - 1) * limit;

      const [rows] = await pool.query(
        `SELECT * FROM early_detection_babies 
         ORDER BY created_at DESC 
         LIMIT ? OFFSET ?`,
        [limit, offset]
      );

      const [countRows] = await pool.query(
        `SELECT COUNT(*) as total FROM early_detection_babies`
      );
      const total = (countRows as any[])[0]?.total || 0;

      return NextResponse.json({
        ok: true,
        babies: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }
  } catch (error: any) {
    Logger.error('early_detection_get_failed', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch early detection records' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await verifyAuth(request);
    if (!user || error) {
      return NextResponse.json({ ok: false, error: error || 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      parent_phone,
      father_name,
      mother_name,
      baby_name,
      baby_birth_date,
      age_months,
      gender,
      current_weight,
      birth_weight,
      length_height,
      head_circumference_at_birth,
      blood_group,
      no_of_siblings,
      address,
      district,
      taluka,
      village,
      talathi,
      grampanchayat,
      phc,
      status_universal_eye_screening,
      status_oae_test,
      type_of_marriage,
      type_of_delivery,
      prenatal_complications,
      perinatal_complications,
      postnatal_complications,
      previous_treatment,
      current_treatment,
      current_medications,
    } = body;

    if (!parent_phone) {
      return NextResponse.json(
        { ok: false, error: 'Parent phone number is required' },
        { status: 422 }
      );
    }

    const pool = getDbPool();
    const userId = user.id || null;

    // Handle JSON arrays for complications
    const prenatalJson = Array.isArray(prenatal_complications)
      ? JSON.stringify(prenatal_complications)
      : prenatal_complications;
    const perinatalJson = Array.isArray(perinatal_complications)
      ? JSON.stringify(perinatal_complications)
      : perinatal_complications;
    const postnatalJson = Array.isArray(postnatal_complications)
      ? JSON.stringify(postnatal_complications)
      : postnatal_complications;

    const [result] = await pool.query(
      `INSERT INTO early_detection_babies (
        parent_phone, user_id,
        father_name, mother_name, baby_name, baby_birth_date, age_months,
        gender, current_weight, birth_weight, length_height, 
        head_circumference_at_birth, blood_group, no_of_siblings,
        address, district, taluka, village, talathi, grampanchayat, phc,
        status_universal_eye_screening, status_oae_test,
        type_of_marriage, type_of_delivery,
        prenatal_complications, perinatal_complications, postnatal_complications,
        previous_treatment, current_treatment, current_medications,
        created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        parent_phone,
        userId,
        father_name || null,
        mother_name || null,
        baby_name || null,
        baby_birth_date || null,
        age_months || null,
        gender || null,
        current_weight || null,
        birth_weight || null,
        length_height || null,
        head_circumference_at_birth || null,
        blood_group || null,
        no_of_siblings || null,
        address || null,
        district || null,
        taluka || null,
        village || null,
        talathi || null,
        grampanchayat || null,
        phc || null,
        status_universal_eye_screening || null,
        status_oae_test || null,
        type_of_marriage || null,
        type_of_delivery || null,
        prenatalJson || null,
        perinatalJson || null,
        postnatalJson || null,
        previous_treatment || null,
        current_treatment || null,
        current_medications || null,
        userId,
      ]
    );

    const insertId = (result as any).insertId;

    Logger.info('early_detection_created', {
      id: insertId,
      parent_phone,
      user_id: userId,
    });

    return NextResponse.json({
      ok: true,
      id: insertId,
      message: 'Early detection record created successfully',
    });
  } catch (error: any) {
    Logger.error('early_detection_create_failed', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to create early detection record' },
      { status: 500 }
    );
  }
}


