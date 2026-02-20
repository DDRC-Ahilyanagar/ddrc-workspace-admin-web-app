import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import { Logger } from '@/lib/logger';
import { verifyAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await verifyAuth(request);
    if (!user || error) {
      return NextResponse.json({ ok: false, error: error || 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);
    if (!id || id <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Invalid ID' },
        { status: 422 }
      );
    }

    const pool = getDbPool();
    const [rows] = await pool.query(
      `SELECT * FROM early_detection_babies WHERE id = ?`,
      [id]
    );

    const babies = rows as any[];
    if (babies.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Record not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      baby: babies[0],
    });
  } catch (error: any) {
    Logger.error('early_detection_get_by_id_failed', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to fetch record' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await verifyAuth(request);
    if (!user || error) {
      return NextResponse.json({ ok: false, error: error || 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);
    if (!id || id <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Invalid ID' },
        { status: 422 }
      );
    }

    const body = await request.json();
    const {
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

    await pool.query(
      `UPDATE early_detection_babies SET
        father_name = ?, mother_name = ?, baby_name = ?, baby_birth_date = ?, age_months = ?,
        gender = ?, current_weight = ?, birth_weight = ?, length_height = ?,
        head_circumference_at_birth = ?, blood_group = ?, no_of_siblings = ?,
        address = ?, district = ?, taluka = ?, village = ?, talathi = ?, grampanchayat = ?, phc = ?,
        status_universal_eye_screening = ?, status_oae_test = ?,
        type_of_marriage = ?, type_of_delivery = ?,
        prenatal_complications = ?, perinatal_complications = ?, postnatal_complications = ?,
        previous_treatment = ?, current_treatment = ?, current_medications = ?,
        updated_by = ?, updated_at = NOW()
      WHERE id = ?`,
      [
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
        id,
      ]
    );

    Logger.info('early_detection_updated', {
      id,
      user_id: userId,
    });

    return NextResponse.json({
      ok: true,
      message: 'Early detection record updated successfully',
    });
  } catch (error: any) {
    Logger.error('early_detection_update_failed', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to update record' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user, error } = await verifyAuth(request);
    if (!user || error) {
      return NextResponse.json({ ok: false, error: error || 'Unauthorized' }, { status: 401 });
    }

    const id = parseInt(params.id);
    if (!id || id <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Invalid ID' },
        { status: 422 }
      );
    }

    const pool = getDbPool();
    await pool.query(`DELETE FROM early_detection_babies WHERE id = ?`, [id]);

    Logger.info('early_detection_deleted', {
      id,
      user_id: user.id || null,
    });

    return NextResponse.json({
      ok: true,
      message: 'Early detection record deleted successfully',
    });
  } catch (error: any) {
    Logger.error('early_detection_delete_failed', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message || 'Failed to delete record' },
      { status: 500 }
    );
  }
}

