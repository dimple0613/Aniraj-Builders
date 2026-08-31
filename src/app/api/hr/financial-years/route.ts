import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const createSchema = yup.object({
    name: yup.string().required('Name is required').max(100, 'Name must not exceed 100 characters'),
    start_date: yup.date().required('Start date is required').typeError('Invalid date format'),
    end_date: yup.date().required('End date is required').typeError('Invalid date format'),
    is_closed: yup.boolean().optional().default(false),
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sortField = searchParams.get('sortField') || 'start_date';
        const sortOrder = searchParams.get('sortOrder') || 'desc';

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const validSortFields = ['name', 'start_date', 'end_date', 'is_closed', 'createdAt', 'updatedAt'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'start_date';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const page = parseInt(searchParams.get('page') || '1', 10);
            const limit = parseInt(searchParams.get('limit') || '10', 10);
            const search = searchParams.get('search') || '';
            const skip = (page - 1) * limit;

            const where: any = { company_id };
            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                ];
            }

            const [data, total] = await Promise.all([
                prisma.payrollFinancialYear.findMany({
                    where,
                    orderBy: { [sortFieldToUse]: sortDirection },
                    skip,
                    take: limit,
                    include: {
                        _count: {
                            select: { periods: true },
                        },
                    },
                }),
                prisma.payrollFinancialYear.count({ where }),
            ]);

            return NextResponse.json(
                successResponse('Financial years fetched successfully', data, {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                })
            );
        });
    } catch (error: any) {
        console.error('Error fetching financial years:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch financial years'), { status: 500 });
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

            if (validated.end_date <= validated.start_date) {
                return NextResponse.json(
                    errorResponse('End date must be after start date'),
                    { status: 400 }
                );
            }

            const financialYear = await prisma.payrollFinancialYear.create({
                data: {
                    name: validated.name,
                    start_date: validated.start_date,
                    end_date: validated.end_date,
                    is_closed: validated.is_closed ?? false,
                    company_id,
                },
            });

            await createNotification({
                action: 'Created',
                entity: 'FinancialYear',
                entityId: financialYear.id,
                entityName: financialYear.name,
                userId: (session?.user as any)?.id,
                link: `/hr/financial-years`,
            });

            return NextResponse.json(
                successResponse('Financial year created successfully', financialYear),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error creating financial year:', error);
        if (error.code === 'P2002') {
            return NextResponse.json(
                errorResponse('Financial year with this name already exists'),
                { status: 409 }
            );
        }
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to create financial year';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
