import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const categories = await prisma.casteCategory.findMany({
            where: {
                status: 'Active'
            },
            include: {
                castes: {
                    select: {
                        id: true,
                        categoryId: true,
                        nameMarathi: true,
                        nameEnglish: true,
                        status: true,
                        sortOrder: true
                    },
                    where: {
                        status: 'Active'
                    },
                    orderBy: {
                        nameEnglish: 'asc'
                    }
                }
            },
            orderBy: {
                id: 'asc'
            }
        });

        return NextResponse.json(categories);
    } catch (error) {
        console.error('Error fetching caste data:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 }
        );
    }
}
