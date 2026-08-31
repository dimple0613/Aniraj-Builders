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
            const { stage, date, approved_no } = body;

            if (!stage || !STAGE_FIELDS.includes(stage)) {
                return NextResponse.json(
                    errorResponse('Invalid stage: ' + stage),
                    { status: 400 }
                );
            }

            if (!date) {
                return NextResponse.json(
                    errorResponse(`${stage.replace(/_/g, ' ')} date is required`),
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

                const stageIndex = STAGE_FIELDS.indexOf(stage as StageField);

            const updateData: Record<string, any> = {
                [stage]: new Date(date),
            };

            if (stage === 'approved_date' && approved_no) {
                updateData.approved_no = approved_no;
            }

            // current_stage should be the KEY of the NEXT stage to complete
            // stageIndex is the index of the date field we just saved
            // Next stage is at stageIndex + 1
            const nextStageIndex = stageIndex + 1;
            
            if (nextStageIndex < STAGE_KEYS.length) {
                updateData.current_stage = STAGE_KEYS[nextStageIndex];
            } else {
                updateData.current_stage = STAGE_KEYS[STAGE_KEYS.length - 1];
            }

            const updated: any = await (prisma.vardhiEstimation as any).update({
                where: { id },
                data: updateData,
            });

            return updated;
        });
 
        if (result instanceof NextResponse) {
            return result;
        }

        // Get stage config to find the label
        const stageConfig = STAGES.find(s => s.dateField === stage);
        const stageLabel = stageConfig?.label || stage.replace(/_/g, ' ');

        // Get the actual date value from the updated result
        const stageDate = result[stage];
        const formattedDate = stageDate ? new Date(stageDate).toISOString().split('T')[0] : '';

        // Create notification for Current Stage Change
        const session = await getServerSession(authOptions);
        await createNotification({
            action: 'Updated',
            entity: 'Bill Tracking - Stage Changed',
            entityId: id,
            entityName: `${stageLabel} (${formattedDate})`,
            userId: (session?.user as any)?.id,
            link: `/bill-generated/${id}`,
        });
 
        return NextResponse.json(
            successResponse('Stage updated successfully', result)
        );
    } catch (error: any) {
        console.error('Error updating stage:', error);
        return NextResponse.json(
            errorResponse(error.message || 'Failed to update stage'),
            { status: 500 }
        );
    }
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const estimation = await withCompany(async (companyId) => {
            const company_id = companyId?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const estimation = await prisma.vardhiEstimation.findFirst({
                where: { id, company_id },
            });

            if (!estimation) {
                return NextResponse.json(errorResponse('Estimation not found'), { status: 404 });
            }

            return estimation;
        });

        if (estimation instanceof NextResponse) {
            return estimation;
        }

        return NextResponse.json(
            successResponse('Stage data fetched successfully', estimation)
        );
    } catch (error: any) {
        console.error('Error fetching stage data:', error);
        return NextResponse.json(
            errorResponse(error.message || 'Failed to fetch stage data'),
            { status: 500 }
        );
    }
}
