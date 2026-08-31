import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const updateSchema = yup.object({
    financial_year_id: yup.string().optional(),
    month: yup.number().min(1, 'Month must be between 1 and 12').max(12, 'Month must be between 1 and 12').optional(),
    year: yup.number().optional(),
    start_date: yup.date().typeError('Invalid date format').optional(),
    end_date: yup.date().typeError('Invalid date format').optional(),
    is_processed: yup.boolean().optional(),
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

            const period = await prisma.payrollPeriod.findFirst({
                where: { id },
                include: {
                    financialYear: {
                        select: { id: true, name: true, start_date: true, end_date: true },
                    },
                    _count: {
                        select: { payrollRuns: true },
                    },
                },
            });

            if (!period || period.financialYear.company_id !== company_id) {
                return NextResponse.json(
                    errorResponse('Payroll period not found'),
                    { status: 404 }
                );
            }

            return NextResponse.json(
                successResponse('Payroll period fetched successfully', period)
            );
        });
    } catch (error: any) {
        console.error('Error fetching payroll period:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch payroll period'), { status: 500 });
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

            const existing = await prisma.payrollPeriod.findFirst({
                where: { id },
                include: {
                    financialYear: true,
                },
            });

            if (!existing || existing.financialYear.company_id !== company_id) {
                return NextResponse.json(
                    errorResponse('Payroll period not found'),
                    { status: 404 }
                );
            }

            if (validated.financial_year_id && validated.financial_year_id !== existing.financial_year_id) {
                const financialYear = await prisma.payrollFinancialYear.findFirst({
                    where: { id: validated.financial_year_id, company_id },
                });
                if (!financialYear) {
                    return NextResponse.json(
                        errorResponse('Financial year does not exist'),
                        { status: 400 }
                    );
                }
            }

            const updateData: any = {};
            if (validated.financial_year_id !== undefined) updateData.financial_year_id = validated.financial_year_id;
            if (validated.month !== undefined) updateData.month = validated.month;
            if (validated.year !== undefined) updateData.year = validated.year;
            if (validated.start_date !== undefined) updateData.start_date = validated.start_date;
            if (validated.end_date !== undefined) updateData.end_date = validated.end_date;
            if (validated.is_processed !== undefined) updateData.is_processed = validated.is_processed;
            if (validated.is_closed !== undefined) updateData.is_closed = validated.is_closed;

            const period = await prisma.payrollPeriod.update({
                where: { id },
                data: updateData,
                include: {
                    financialYear: {
                        select: { id: true, name: true },
                    },
                },
            });

            await createNotification({
                action: 'Updated',
                entity: 'PayrollPeriod',
                entityId: period.id,
                entityName: `${period.month}/${period.year}`,
                userId: (session?.user as any)?.id,
                link: `/hr/payroll-periods`,
            });

            return NextResponse.json(
                successResponse('Payroll period updated successfully', period)
            );
        });
    } catch (error: any) {
        console.error('Error updating payroll period:', error);
        if (error.code === 'P2002') {
            return NextResponse.json(
                errorResponse('Payroll period already exists for this month/year'),
                { status: 409 }
            );
        }
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to update payroll period';
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

            const existing = await prisma.payrollPeriod.findFirst({
                where: { id },
                include: {
                    financialYear: true,
                },
            });

            if (!existing || existing.financialYear.company_id !== company_id) {
                return NextResponse.json(
                    errorResponse('Payroll period not found'),
                    { status: 404 }
                );
            }

            await prisma.payrollPeriod.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'PayrollPeriod',
                entityId: id,
                entityName: `${existing.month}/${existing.year}`,
                userId: (session?.user as any)?.id,
                link: `/hr/payroll-periods`,
            });

            return NextResponse.json(
                successResponse('Payroll period deleted successfully')
            );
        });
    } catch (error: any) {
        console.error('Error deleting payroll period:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to delete payroll period';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
