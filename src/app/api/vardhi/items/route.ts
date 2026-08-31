import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const vardhiId = searchParams.get('vardhi_id');

        if (!vardhiId) {
            return NextResponse.json({ data: [] });
        }

        const data = await withCompany(async (company) => {
            // 1. Fetch Vardhi to get its work_type string
            const vardhi = await (prisma as any).vardhi.findFirst({
                where: { id: vardhiId, company_id: company.company_id },
                include: {
                    zone: true,
                }
            });

            if (!vardhi) return [];

            // 2. Find the corresponding WorkType model ID
            const workType = await prisma.workType.findFirst({
                where: { name: vardhi.work_type, company_id: company.company_id }
            });

            // 3. Fetch all VardhiItem records for this Vardhi
            const vardhiItems = await prisma.vardhiItem.findMany({
                where: {
                    vardhi_id: vardhiId,
                    vardhi: {
                        company_id: company.company_id
                    }
                },
                include: {
                    item: {
                        include: {
                            unit: true,
                            ay: true,
                            workTypePrices: {
                                where: {
                                    work_type_id: workType?.id ?? ''
                                }
                            }
                        }
                    }
                }
            });

            return {
                vardhi,
                items: vardhiItems.map((vi: any) => ({
                    vardhi_id: vi.vardhi_id,
                    item_id: vi.item_id,
                    item_name: vi.item?.item_name,
                    size: vi.size,
                    unit_id: vi.item?.unit_id,
                    unit_name: vi.item?.unit?.unit_name,
                    ay_id: vi.item?.ay_id,
                    ay_no: vi.item?.ay?.ay_no,
                    // Get rate from ItemWorkTypePrice if it exists, otherwise 0
                    rate: vi.item?.workTypePrices?.[0]?.price || 0,
                    quantity: 0,
                    amount: 0,
                    isCustom: false
                }))
            };
        });

        return NextResponse.json({ data });
    } catch (error) {
        console.error('Error fetching vardhi items:', error);
        return NextResponse.json(
            { error: 'Failed to fetch items' },
            { status: 500 }
        );
    }
}
