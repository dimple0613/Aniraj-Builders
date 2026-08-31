import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';

export async function GET(
    request: NextRequest,
) {
    try {
        const { searchParams } = new URL(request.url);
        const capitalSorId = searchParams.get('capitalSorId');

        if (!capitalSorId) {
            return NextResponse.json(errorResponse('capitalSorId is required'), { status: 400 });
        }

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const usedInPurchase = await prisma.purchaseEntryMaterial.findFirst({
                where: { material_id: capitalSorId },
                select: { id: true },
            });

            return NextResponse.json(successResponse('Check completed', { hasEntries: !!usedInPurchase }));
        });
    } catch (error) {
        console.error('Error checking purchase entries:', error);
        return NextResponse.json(errorResponse('Failed to check purchase entries'), { status: 500 });
    }
}
