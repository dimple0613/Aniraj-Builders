import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const updateSchema = yup.object({
    name: yup.string().max(100, 'Name must not exceed 100 characters').optional(),
    start_date: yup.date().typeError('Invalid date format').optional(),
    end_date: yup.date().typeError('Invalid date format').optional(),
    is_closed: yup.boolean().optional(),
});

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const financialYear = await prisma.payrollFinancialYear.findFirst({
                where: { id, company_id },
                include: {
                    _count: {
                        select: { periods: true },
                    },
                },
            });

            if (!financialYear) {
                return NextResponse.json(
                    errorResponse('Financial year not found'),
                    { status: 404 }
                );
            }

            return NextResponse.json(
                successResponse('Financial year fetched successfully', financialYear)
            );
        });
    } catch (error: any) {
        console.error('Error fetching financial year:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch financial year'), { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        let validated: yup.InferType<typeof updateSchema>;
        try {
            validated = await updateSchema.validate(body, { abortEarly: false });
        } catch (err: any) {
            const errorMessages = err.inner
                .map((issue: any) => `${issue.path}: ${issue.message}`)
                .join('; ');
            return NextResponse.json(errorResponse(errorMessages), { status: 400 });
        }

        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existing = await prisma.payrollFinancialYear.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Financial year not found'),
                    { status: 404 }
                );
            }

            const updateData: any = {};
            if (validated.name !== undefined) updateData.name = validated.name;
            if (validated.start_date !== undefined) updateData.start_date = validated.start_date;
            if (validated.end_date !== undefined) updateData.end_date = validated.end_date;
            if (validated.is_closed !== undefined) updateData.is_closed = validated.is_closed;

            const financialYear = await prisma.payrollFinancialYear.update({
                where: { id },
                data: updateData,
            });

            await createNotification({
                action: 'Updated',
                entity: 'FinancialYear',
                entityId: financialYear.id,
                entityName: financialYear.name,
                userId: (session?.user as any)?.id,
                link: `/hr/financial-years`,
            });

            return NextResponse.json(
                successResponse('Financial year updated successfully', financialYear)
            );
        });
    } catch (error: any) {
        console.error('Error updating financial year:', error);
        if (error.code === 'P2002') {
            return NextResponse.json(
                errorResponse('Financial year with this name already exists'),
                { status: 409 }
            );
        }
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to update financial year';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existing = await prisma.payrollFinancialYear.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Financial year not found'),
                    { status: 404 }
                );
            }

            // Cascade delete child records to avoid foreign-key constraint violations.
            const periods = await prisma.payrollPeriod.findMany({
                where: { financial_year_id: id },
                select: { id: true },
            });
            const periodIds = periods.map((p) => p.id);

            const runs = await prisma.payrollRun.findMany({
                where: { OR: [{ financial_year_id: id }, { period_id: { in: periodIds } }] },
                select: { id: true },
            });
            const runIds = runs.map((r) => r.id);

            if (runIds.length > 0) {
                await prisma.loanRepayment.deleteMany({ where: { payroll_run_id: { in: runIds } } });
                await prisma.payslip.deleteMany({ where: { payroll_run_id: { in: runIds } } });
                await prisma.payrollRun.deleteMany({ where: { id: { in: runIds } } });
            }

            if (periodIds.length > 0) {
                await prisma.payrollPeriod.deleteMany({ where: { id: { in: periodIds } } });
            }

            await prisma.payrollFinancialYear.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'FinancialYear',
                entityId: id,
                entityName: existing.name,
                userId: (session?.user as any)?.id,
                link: `/hr/financial-years`,
            });

            return NextResponse.json(
                successResponse('Financial year deleted successfully')
            );
        });
    } catch (error: any) {
        console.error('Error deleting financial year:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to delete financial year';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
