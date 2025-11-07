import { NextRequest, NextResponse } from 'next/server';
import { getDbPool } from '@/lib/db';
import * as fs from 'fs/promises';
import path from 'path';

export const dynamic = 'force-dynamic';

function sanitizeName(name: string): string {
  return (name || '')
    .replace(/[^A-Za-z0-9 _-]/g, '')
    .replace(/\s+/g, '_')
    .trim() || 'UNKNOWN';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const aadharId = parseInt(body.aadhar_id || '0');
    const holderName = String(body.holder_name || '').trim();
    const aadharNoRaw = String(body.aadhar_no || '').trim();
    const digits = aadharNoRaw.replace(/\D+/g, '');
    if (!aadharId || !digits) {
      return NextResponse.json({ ok: false, error: 'invalid_input' }, { status: 422 });
    }

    const pool = getDbPool();
    const [rows] = await pool.query(
      'SELECT id, holder_name, aadhar_no FROM survey_aadhar WHERE id = ? LIMIT 1',
      [aadharId]
    );
    const rec = Array.isArray(rows) && (rows as any[]).length ? (rows as any[])[0] : null;
    if (!rec) {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    const oldName = sanitizeName(rec.holder_name || '');
    const oldDigits = String(rec.aadhar_no || '').replace(/\D+/g, '');
    const newName = sanitizeName(holderName);
    const uploads = path.join(process.cwd(), 'public', 'uploads');
    const oldFolder = path.join(uploads, `${oldName || 'UNKNOWN'}-${oldDigits || 'NA'}`);
    const newFolder = path.join(uploads, `${newName}-${digits}`);

    // Update DB first
    await pool.query(
      'UPDATE survey_aadhar SET holder_name = ?, aadhar_no = ?, updated_at = NOW() WHERE id = ?',
      [holderName, aadharNoRaw, aadharId]
    );

    // Rename folder if it changed
    if (oldFolder !== newFolder) {
      try {
        await fs.mkdir(uploads, { recursive: true });
        await fs.rename(oldFolder, newFolder);
      } catch {
        // If old doesn't exist, ignore; if rename fails, ignore silently
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}


