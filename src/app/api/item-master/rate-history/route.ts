import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const capitalSorId = searchParams.get('capitalSorId');
        if (!capitalSorId) return NextResponse.json(errorResponse('Item ID is required'), { status: 400 });

        return await withCompany(async (company) => {
            const company_id = company?.company_id;
            if (!company_id) return NextResponse.json(unauthorizedResponse(), { status: 401 });

            const capitalSor = await prisma.capitalSOR.findFirst({
                where: { id: capitalSorId },
            });
            if (!capitalSor) return NextResponse.json(errorResponse('Item not found'), { status: 404 });

            const prices = await prisma.capitalSORPrice.findMany({
                where: { capitalSor_id: capitalSorId },
                orderBy: { start_date: 'desc' },
            });

            const history = prices.map((p) => ({
                id: p.id,
                price: Number(p.price),
                start_date: p.start_date,
                expiry_date: p.expiry_date,
            }));

            return NextResponse.json(successResponse('Rate history fetched successfully', history));
        });
    } catch (error: any) {
        console.error('Error fetching rate history:', error);
        return NextResponse.json(errorResponse('Failed to fetch rate history'), { status: 500 });
    }
}
