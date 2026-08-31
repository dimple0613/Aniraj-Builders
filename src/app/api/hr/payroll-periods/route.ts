import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const createSchema = yup.object({
    financial_year_id: yup.string().required('Financial year is required'),
    month: yup.number().required('Month is required').min(1, 'Month must be between 1 and 12').max(12, 'Month must be between 1 and 12'),
    year: yup.number().required('Year is required'),
    start_date: yup.date().required('Start date is required').typeError('Invalid date format'),
    end_date: yup.date().required('End date is required').typeError('Invalid date format'),
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const financial_year_id = searchParams.get('financial_year_id')?.trim() || '';
        const sortField = searchParams.get('sortField') || 'year';
        const sortOrder = searchParams.get('sortOrder') || 'desc';

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const where: any = {
                financialYear: { company_id },
            };

            if (financial_year_id) {
                where.financial_year_id = financial_year_id;
            }

            const validSortFields = ['month', 'year', 'start_date', 'end_date', 'is_processed', 'is_closed', 'createdAt', 'updatedAt'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'year';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const data = await prisma.payrollPeriod.findMany({
                where,
                orderBy: [
                    { [sortFieldToUse]: sortDirection },
                ],
                include: {
                    financialYear: {
                        select: { id: true, name: true, start_date: true, end_date: true },
                    },
                    _count: {
                        select: { payrollRuns: true },
                    },
                },
            });

            return NextResponse.json(
                successResponse('Payroll periods fetched successfully', data)
            );
        });
    } catch (error: any) {
        console.error('Error fetching payroll periods:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch payroll periods'), { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        let validated: yup.InferType<typeof createSchema>;
        try {
            validated = await createSchema.validate(body, { abortEarly: false });
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

            const financialYear = await prisma.payrollFinancialYear.findFirst({
                where: { id: validated.financial_year_id, company_id },
            });

            if (!financialYear) {
                return NextResponse.json(
                    errorResponse('Financial year does not exist'),
                    { status: 400 }
                );
            }

            if (validated.end_date <= validated.start_date) {
                return NextResponse.json(
                    errorResponse('End date must be after start date'),
                    { status: 400 }
                );
            }

            if (validated.start_date < financialYear.start_date || validated.end_date > financialYear.end_date) {
                return NextResponse.json(
                    errorResponse('Period dates must be within the financial year range'),
                    { status: 400 }
                );
            }

            const period = await prisma.payrollPeriod.create({
                data: {
                    financial_year_id: validated.financial_year_id,
                    month: validated.month,
                    year: validated.year,
                    start_date: validated.start_date,
                    end_date: validated.end_date,
                },
                include: {
                    financialYear: {
                        select: { id: true, name: true },
                    },
                },
            });

            await createNotification({
                action: 'Created',
                entity: 'PayrollPeriod',
                entityId: period.id,
                entityName: `${period.month}/${period.year}`,
                userId: (session?.user as any)?.id,
                link: `/hr/payroll-periods`,
            });

            return NextResponse.json(
                successResponse('Payroll period created successfully', period),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error creating payroll period:', error);
        if (error.code === 'P2002') {
            return NextResponse.json(
                errorResponse('Payroll period already exists for this month/year'),
                { status: 409 }
            );
        }
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to create payroll period';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
