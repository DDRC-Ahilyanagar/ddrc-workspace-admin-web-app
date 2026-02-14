import { NextRequest, NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';
import { Logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const taluka = searchParams.get('taluka')?.trim() || '';

        if (!taluka) {
            return NextResponse.json(
                { ok: false, error: 'taluka required' },
                { status: 400 }
            );
        }

        const pool = await import('@/lib/db').then(m => m.getDbPool());

        // Fetch everything in parallel to avoid sequential timeout
        const [villageResult, gramResult, talathiResult, phcResult] = await Promise.all([
            // 1) Villages
            (async () => {
                const [tables] = await pool.execute("SHOW TABLES LIKE 'tbl_all_villages'");
                const useVillagesTable = Array.isArray(tables) && tables.length > 0;
                const sql = useVillagesTable
                    ? `SELECT DISTINCT villages FROM tbl_all_villages WHERE TRIM(taluka) = ? AND (status IS NULL OR status = 'Active') ORDER BY villages`
                    : `SELECT DISTINCT village AS villages FROM tbl_all_grams WHERE TRIM(taluka) = ? AND (status IS NULL OR status = 'Active') ORDER BY village`;
                const rows = await dbQuery(sql, [taluka]);
                return rows.map((r: any) => (r.villages || r.village)).filter(Boolean)
                    .filter((v: string) => v.toLowerCase().trim() !== taluka.toLowerCase().trim());
            })().catch(() => []),

            // 2) Grams
            (async () => {
                const [tables] = await pool.execute("SHOW TABLES LIKE 'tbl_all_grams'");
                if (!(Array.isArray(tables) && tables.length > 0)) return [];
                const rows = await dbQuery(`SELECT DISTINCT gram FROM tbl_all_grams WHERE taluka = ? AND (status IS NULL OR status = 'Active') ORDER BY gram`, [taluka]);
                return rows.map((r: any) => r.gram).filter(Boolean);
            })().catch(() => []),

            // 3) Talathis
            (async () => {
                const [tables] = await pool.execute("SHOW TABLES LIKE 'tbl_all_talathi'");
                if (!(Array.isArray(tables) && tables.length > 0)) return [];
                const rows = await dbQuery(`SELECT DISTINCT talathi FROM tbl_all_talathi WHERE taluka = ? AND (status IS NULL OR status = 'Active') ORDER BY talathi`, [taluka]);
                return rows.map((r: any) => (r.talathi || '').toString().trim()).filter(Boolean);
            })().catch(() => []),

            // 4) PHCs
            (async () => {
                const [tables] = await pool.execute("SHOW TABLES LIKE 'tbl_all_phc'");
                if (!(Array.isArray(tables) && tables.length > 0)) return [];
                const rows = await dbQuery(`SELECT DISTINCT phc FROM tbl_all_phc WHERE taluka = ? AND (status IS NULL OR status = 'Active') ORDER BY phc`, [taluka]);
                return rows.map((r: any) => (r.phc || '').toString().trim()).filter(Boolean);
            })().catch(() => [])
        ]);

        return NextResponse.json(
            {
                ok: true,
                villages: villageResult,
                grams: gramResult,
                talathis: talathiResult,
                phcs: phcResult
            },
            { headers: { 'Content-Type': 'application/json; charset=utf-8' } }
        );
    } catch (error: any) {
        Logger.error('get_dependents_failed', { error: error?.message });
        return NextResponse.json(
            { ok: false, error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
