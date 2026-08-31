import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { STAGE_FIELDS, STAGE_KEYS, StageField, STAGES } from '@/lib/constants/stage-constants';
import { createNotification } from '@/lib/notification-service';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { stage, reason, date, prevStage } = body;

        if (!reason || !reason.trim()) {
            return NextResponse.json(
                errorResponse('Reason is required'),
                { status: 400 }
            );
        }

        if (!stage || !STAGE_FIELDS.includes(stage)) {
            return NextResponse.json(
                errorResponse('Invalid stage'),
                { status: 400 }
            );
        }

        const result = await withCompany(async (companyId) => {
            const company_id = companyId?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existing = await prisma.vardhiEstimation.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(errorResponse('Estimation not found'), { status: 404 });
            }

            const stageToDateField: Record<string, string> = {
                'file_submitted': 'file_submitted_date',
                'store_report': 'store_report_date',
                'submitted_for_approved': 'submitted_for_approved_date',
                'approved': 'approved_date',
                'bill_prepaid': 'bill_prepaid_date',
                'bill_audit': 'bill_audit_date',
                'bill_account': 'bill_account_date',
                'payment_received': 'payment_received_date',
            };
            
            const resolvedPrevStage = stageToDateField[prevStage as string] || prevStage;
            
            const prevStageField = resolvedPrevStage;
            
            const reasonFieldMap: Record<string, string> = {
                'file_submitted_date': 'file_submitted_reason',
                'store_report_date': 'store_report_reason',
                'submitted_for_approved_date': 'submitted_for_approved_reason',
                'approved_date': 'approved_reason',
                'bill_prepaid_date': 'bill_prepaid_reason',
                'bill_audit_date': 'bill_audit_reason',
                'bill_account_date': 'bill_account_reason',
            };
            
            const prevStageReasonField = reasonFieldMap[prevStageField] || reasonFieldMap[resolvedPrevStage];
            
            if (!prevStageReasonField && reason) {
                return NextResponse.json(
                    errorResponse('Cannot add reason for this stage'),
                    { status: 400 }
                );
            }
            
            const updateData: Record<string, any> = {
                [prevStageField]: date ? new Date(date) : new Date(),
                [prevStageReasonField]: reason.trim(),
            };

            const updated: any = await (prisma.vardhiEstimation as any).update({
                where: { id },
                data: updateData,
            });

            return updated;
        });
 
        if (result instanceof NextResponse) {
            return result;
        }

        // Get stage label
        const stageConfig = STAGES.find(s => s.dateField === stage);
        const stageLabel = stageConfig?.label || stage.replace(/_/g, ' ');

        // Create notification for Bill Tracking - Stage Reverted
        const session = await getServerSession(authOptions);
        await createNotification({
            action: 'Updated',
            entity: 'Bill Tracking - Stage Reverted',
            entityId: id,
            entityName: `${stageLabel} (Reverted)`,
            userId: (session?.user as any)?.id,
            link: `/bill-generated/${id}`,
        });
 
        return NextResponse.json(
            successResponse('Stage reverted successfully', result)
        );
    } catch (error: any) {
        console.error('Error reverting stage:', error);
        return NextResponse.json(
            errorResponse(error.message || 'Failed to revert stage'),
            { status: 500 }
        );
    }
}