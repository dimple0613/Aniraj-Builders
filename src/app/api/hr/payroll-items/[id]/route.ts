import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';
import * as yup from 'yup';

const updateSchema = yup.object({
    status: yup.string().oneOf(['CONFIRMED', 'COMPUTED'], 'Status must be CONFIRMED or COMPUTED').required('Status is required'),
});

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const session = await getServerSession(authOptions);

        let validated: yup.InferType<typeof updateSchema>;
        try {
            validated = await updateSchema.validate(body, { abortEarly: false });
        } catch (err: any) {
            const errorMessages = err.inner
                .map((issue: any) => `${issue.path}: ${issue.message}`)
                .join('; ');
            return NextResponse.json(errorResponse(errorMessages), { status: 400 });
        }

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existing = await prisma.payrollItem.findFirst({
                where: { id },
                include: {
                    payrollRun: { select: { company_id: true, status: true } },
                },
            });

            if (!existing || existing.payrollRun.company_id !== company_id) {
                return NextResponse.json(
                    errorResponse('Payroll item not found'),
                    { status: 404 }
                );
            }

            if (existing.payrollRun.status === 'FINALIZED') {
                return NextResponse.json(
                    errorResponse('Cannot modify items in a finalized payroll run'),
                    { status: 400 }
                );
            }

            const updated = await prisma.payrollItem.update({
                where: { id },
                data: { status: validated.status },
            });

            await createNotification({
                action: validated.status === 'CONFIRMED' ? 'Updated' : 'Updated',
                entity: 'Payroll Item',
                entityId: updated.id,
                entityName: `Status → ${validated.status}`,
                userId: (session?.user as any)?.id,
                link: `/hr/payroll-runs`,
            });

            return NextResponse.json(
                successResponse('Payroll item updated successfully', updated)
            );
        });
    } catch (error: any) {
        console.error('Error updating payroll item:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to update payroll item';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
