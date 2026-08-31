import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const itemMaster = await prisma.itemMaster.findFirst({
                where: { id },
                include: {
                    sor: true,
                    department: true,
                capitalSors: {
                         include: {
                             subcontractor: {
                                 select: { id: true, name: true },
                             },
                         },
                     },
                },
            });

            if (!itemMaster) {
                return NextResponse.json(errorResponse('Item Master not found'), { status: 404 });
            }

            return NextResponse.json(
                successResponse('Item Master fetched successfully', {
                    id: itemMaster.id,
                    sorId: itemMaster.sorId,
                    sorName: itemMaster.sor?.name || null,
                    departmentId: itemMaster.departmentId,
                    departmentName: itemMaster.department?.name || null,
                    items: itemMaster.capitalSors.map((cs: any) => ({
                        id: cs.id,
                        item_name: cs.item_name,
                        searching_preference: cs.searching_preference,
                        uom: cs.uom,
                        gst_master: cs.gst_master,
                        is_subcontractor: cs.is_subcontractor,
                        subcontractor_id: cs.subcontractor_id,
                        subcontractor_name: cs.subcontractor?.name || null,
                        srNo: cs.srNo,
                        itemNo: cs.itemNo,
                        rate: cs.rate,
                        is_active: cs.is_active,
                        createdAt: cs.createdAt,
                    })),
                })
            );
        });
    } catch (error) {
        console.error('Error fetching item master:', error);
        return NextResponse.json(errorResponse('Failed to fetch item master'), { status: 500 });
    }
}
