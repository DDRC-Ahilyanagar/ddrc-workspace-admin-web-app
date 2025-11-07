import { NextRequest, NextResponse } from 'next/server';
import { dbQueryOne } from '@/lib/db';
import { Logger } from '@/lib/logger';

/**
 * @swagger
 * /api/get-aadhar-images:
 *   post:
 *     summary: Get Aadhaar card images
 *     tags: [Aadhaar]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - aadhar_id
 *             properties:
 *               aadhar_id:
 *                 type: number
 *                 example: 1
 *     responses:
 *       200:
 *         description: Images retrieved successfully
 *       404:
 *         description: Aadhaar ID not found
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const aadharId = parseInt(body.aadhar_id || '0');

    if (aadharId <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Invalid aadhar_id' },
        { status: 422 }
      );
    }

    const row = await dbQueryOne(
      'SELECT front_image, back_image FROM survey_aadhar WHERE id = ? LIMIT 1',
      [aadharId]
    );

    if (!row) {
      return NextResponse.json(
        { ok: false, error: 'Aadhaar ID not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      front_image: (row as any).front_image || null,
      back_image: (row as any).back_image || null,
    });
  } catch (error: any) {
    Logger.error('get_aadhar_images_failed', { error: error.message });
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

