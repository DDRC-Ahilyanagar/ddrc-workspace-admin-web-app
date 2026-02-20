import { NextResponse } from 'next/server';
import { dbQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        // Fetch categories
        const categories = await dbQuery(`
            SELECT id, code, name_marathi as nameMarathi, name_english as nameEnglish, status 
            FROM caste_categories 
            WHERE status = 'Active' 
            ORDER BY id ASC
        `);

        // Fetch all active castes
        const allCastes = await dbQuery(`
            SELECT id, category_id as categoryId, name_marathi as nameMarathi, name_english as nameEnglish, status, sort_order as sortOrder
            FROM castes 
            WHERE status = 'Active' 
            ORDER BY name_english ASC
        `);

        // Map castes to their respective categories
        const result = categories.map((cat: any) => ({
            ...cat,
            castes: allCastes.filter((c: any) => Number(c.categoryId) === Number(cat.id))
        }));

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error fetching caste data:', error);
        return NextResponse.json(
            { error: 'Internal Server Error', message: error.message },
            { status: 500 }
        );
    }
}
