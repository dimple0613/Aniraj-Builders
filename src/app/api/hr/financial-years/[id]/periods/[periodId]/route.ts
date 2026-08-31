import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';
import * as yup from 'yup';

const updateSchema = yup.object({
    name: yup.string().optional(),
    start_date: yup.date().typeError('Invalid date format').optional(),
    end_date: yup.date().typeError('Invalid date format').optional(),
    is_closed: yup.boolean().optional(),
});

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatPeriodName(month: number, year: number): string {
    return `${MONTH_NAMES[month - 1]} ${year}`;
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; periodId: string }> }
) {
    try {
        const { id, periodId } = await params;
        const body = await request.json();
        const session = await getServerSession(authOptions);

        let validated: yup.InferType<typeof updateSchema>;
        try {
            validated = await updateSchema.validate(body, { abortEarly: false });
        } catch (err: any) {
            const errorMessages = err.inner.map((issue: any) => `${issue.path}: ${issue.message}`).join('; ');
            return NextResponse.json(errorResponse(errorMessages), { status: 400 });
        }

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const fy = await prisma.payrollFinancialYear.findFirst({
                where: { id, company_id },
            });

            if (!fy) {
                return NextResponse.json(errorResponse('Financial year not found'), { status: 404 });
            }

            const existing = await prisma.payrollPeriod.findFirst({
                where: { id: periodId, financial_year_id: id },
            });

            if (!existing) {
                return NextResponse.json(errorResponse('Period not found'), { status: 404 });
            }

            const updateData: any = {};
            if (validated.start_date !== undefined) updateData.start_date = validated.start_date;
            if (validated.end_date !== undefined) updateData.end_date = validated.end_date;
            if (validated.is_closed !== undefined) updateData.is_closed = validated.is_closed;
            if (validated.start_date !== undefined) {
                const d = new Date(validated.start_date);
                updateData.month = d.getMonth() + 1;
                updateData.year = d.getFullYear();
            }

            const period = await prisma.payrollPeriod.update({
                where: { id: periodId },
                data: updateData,
            });

            await createNotification({
                action: 'Updated',
                entity: 'Period',
                entityId: period.id,
                entityName: formatPeriodName(period.month, period.year),
                userId: (session?.user as any)?.id,
                link: `/hr/financial-years`,
            });

            return NextResponse.json(
                successResponse('Period updated successfully', {
                    id: period.id,
                    name: formatPeriodName(period.month, period.year),
                    month: period.month,
                    year: period.year,
                    start_date: period.start_date,
                    end_date: period.end_date,
                    is_processed: period.is_processed,
                    is_closed: period.is_closed,
                })
            );
        });
    } catch (error: any) {
        console.error('Error updating period:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to update period'), { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; periodId: string }> }
) {
    try {
        const { id, periodId } = await params;
        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const fy = await prisma.payrollFinancialYear.findFirst({
                where: { id, company_id },
            });

            if (!fy) {
                return NextResponse.json(errorResponse('Financial year not found'), { status: 404 });
            }

            const existing = await prisma.payrollPeriod.findFirst({
                where: { id: periodId, financial_year_id: id },
            });

            if (!existing) {
                return NextResponse.json(errorResponse('Period not found'), { status: 404 });
            }

            const runCount = await prisma.payrollRun.count({
                where: { period_id: periodId },
            });

            if (runCount > 0) {
                return NextResponse.json(
                    errorResponse(`Cannot delete period. ${runCount} payroll run(s) are associated with this period.`),
                    { status: 409 }
                );
            }

            await prisma.payrollPeriod.delete({
                where: { id: periodId },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'Period',
                entityId: periodId,
                entityName: formatPeriodName(existing.month, existing.year),
                userId: (session?.user as any)?.id,
                link: `/hr/financial-years`,
            });

            return NextResponse.json(
                successResponse('Period deleted successfully')
            );
        });
    } catch (error: any) {
        console.error('Error deleting period:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to delete period';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
