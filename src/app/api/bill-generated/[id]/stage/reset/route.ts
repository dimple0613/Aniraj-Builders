import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { createNotification } from '@/lib/notification-service';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const result = await withCompany(async (companyId) => {
            const company_id = companyId?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }
            
            const existing = await prisma.vardhiEstimation.findFirst({
                where: { id, company_id },
                include: {
                    vardhis: {
                        select: { id: true }
                    },
                    invoices: {
                        select: { id: true }
                    }
                }
            });

            if (!existing) {
                return NextResponse.json(errorResponse('Estimation not found'), { status: 404 });
            }

            // Get all related Vardhi IDs and Invoice IDs
            const vardhiIds = existing.vardhis?.map(v => v.id) || [];
            const invoiceIds = existing.invoices?.map(inv => inv.id) || [];

            // Use transaction to ensure atomicity
            await prisma.$transaction(async (tx) => {
                // Reset all related Vardhi records to not in billing
                if (vardhiIds.length > 0) {
                    await tx.vardhi.updateMany({
                        where: {
                            id: { in: vardhiIds }
                        },
                        data: {
                            is_in_billing: false
                        }
                    });
                }

                // Delete related invoices first (no cascade on VardhiInvoice.estimation_id)
                if (invoiceIds.length > 0) {
                    await tx.vardhiInvoice.deleteMany({
                        where: {
                            id: { in: invoiceIds }
                        }
                    });
                }

                // Delete the VardhiEstimation (cascade handles VardhiWaterWorksDepartment and VardhiEstimationItem)
                await tx.vardhiEstimation.delete({
                    where: { id }
                });
            });

            // Create notification for Bill Tracking - Back to Summary
            const session = await getServerSession(authOptions);
            await createNotification({
                action: 'Deleted',
                entity: 'Bill Tracking - Back to Summary',
                entityId: id,
                entityName: existing.estimation_no || 'Bill',
                userId: (session?.user as any)?.id,
                link: `/bill-generated`,
            });

            return { success: true, message: 'Deleted from Vardhi estimation and reset billing status' };
        });
 
        if (result instanceof NextResponse) {
            return result;
        }
 
        return NextResponse.json(
            successResponse('Bill tracking returned to summary', result)
        );
    } catch (error: any) {
        console.error('Error resetting stage:', error);
        return NextResponse.json(
            errorResponse(error.message || 'Failed to reset stage'),
            { status: 500 }
        );
    }
}