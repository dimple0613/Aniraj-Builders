import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';
import * as yup from 'yup';

const createSchema = yup.object({
    name: yup.string().optional(),
    start_date: yup.date().required('Start date is required').typeError('Invalid date format'),
    end_date: yup.date().required('End date is required').typeError('Invalid date format'),
    is_closed: yup.boolean().optional().default(false),
});

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatPeriodName(month: number, year: number): string {
    return `${MONTH_NAMES[month - 1]} ${year}`;
}

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

            const fy = await prisma.payrollFinancialYear.findFirst({
                where: { id, company_id },
            });

            if (!fy) {
                return NextResponse.json(errorResponse('Financial year not found'), { status: 404 });
            }

            const periods = await prisma.payrollPeriod.findMany({
                where: { financial_year_id: id },
                orderBy: { month: 'asc' },
            });

            const data = periods.map(p => ({
                id: p.id,
                name: formatPeriodName(p.month, p.year),
                month: p.month,
                year: p.year,
                start_date: p.start_date,
                end_date: p.end_date,
                is_processed: p.is_processed,
                is_closed: p.is_closed,
            }));

            return NextResponse.json(successResponse('Periods fetched successfully', data));
        });
    } catch (error: any) {
        console.error('Error fetching periods:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch periods'), { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const session = await getServerSession(authOptions);

        let validated: yup.InferType<typeof createSchema>;
        try {
            validated = await createSchema.validate(body, { abortEarly: false });
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

            const startDate = new Date(validated.start_date);
            const month = startDate.getMonth() + 1;
            const year = startDate.getFullYear();

            const existing = await prisma.payrollPeriod.findFirst({
                where: { financial_year_id: id, month, year },
            });

            if (existing) {
                return NextResponse.json(errorResponse('Period already exists for this month'), { status: 409 });
            }

            const period = await prisma.payrollPeriod.create({
                data: {
                    financial_year_id: id,
                    month,
                    year,
                    start_date: validated.start_date,
                    end_date: validated.end_date,
                    is_closed: validated.is_closed ?? false,
                },
            });

            await createNotification({
                action: 'Created',
                entity: 'Period',
                entityId: period.id,
                entityName: formatPeriodName(period.month, period.year),
                userId: (session?.user as any)?.id,
                link: `/hr/financial-years`,
            });

            return NextResponse.json(
                successResponse('Period created successfully', {
                    id: period.id,
                    name: formatPeriodName(period.month, period.year),
                    month: period.month,
                    year: period.year,
                    start_date: period.start_date,
                    end_date: period.end_date,
                    is_processed: period.is_processed,
                    is_closed: period.is_closed,
                }),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error creating period:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to create period'), { status: 500 });
    }
}
