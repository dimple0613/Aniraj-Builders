import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';

export async function GET(request: NextRequest) {
    try {
        const zones = await withCompany(async (company: any) => {
            return await (prisma as any).zoneMaster.findMany({
                select: {
                    id: true,
                    name: true,
                    file_no: true,
                },
                orderBy: {
                    file_no: 'asc',
                },
            });
        });

        return NextResponse.json({
            data: zones,
        });
    } catch (error) {
        console.error('Error fetching zones:', error);
        return NextResponse.json(
            { error: 'Failed to fetch zones' },
            { status: 500 }
        );
    }
}
