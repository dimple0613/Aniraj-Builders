import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';
import { parseDateOnly } from '@/lib/date-utils';

const createPerformanceReviewSchema = yup.object({
    employee_id: yup.string().required('Employee is required'),
    reviewer: yup.string().nullable().optional(),
    rating: yup.number().integer().min(1).max(5).nullable().optional(),
    goals: yup.string().nullable().optional(),
    achievements: yup.string().nullable().optional(),
    comments: yup.string().nullable().optional(),
    review_date: yup.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search')?.trim() || '';
        const sortField = searchParams.get('sortField') || 'review_date';
        const sortOrder = searchParams.get('sortOrder') || 'desc';
        const employee_id = searchParams.get('employee_id')?.trim() || '';
        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const where: any = { company_id };
            if (search) {
                where.goals = { contains: search, mode: 'insensitive' };
            }
            if (employee_id) {
                where.employee_id = employee_id;
            }

            const validSortFields = ['review_date', 'rating', 'createdAt', 'updatedAt'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'review_date';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const [data, total] = await Promise.all([
                prisma.performanceReview.findMany({
                    where,
                    orderBy: { [sortFieldToUse]: sortDirection },
                    skip: (page - 1) * limit,
                    take: limit,
                    include: {
                        employee: {
                            select: { id: true, name: true, employee_code: true },
                        },
                    },
                }),
                prisma.performanceReview.count({ where }),
            ]);

            return NextResponse.json(
                successResponse('Performance reviews fetched successfully', data, {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                })
            );
        });
    } catch (error: any) {
        console.error('Error fetching performance reviews:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch performance reviews'), { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        let validated: {
            employee_id: string;
            reviewer?: string | null;
            rating?: number | null;
            goals?: string | null;
            achievements?: string | null;
            comments?: string | null;
            review_date?: string | null;
        };
        try {
            const validation = await createPerformanceReviewSchema.validate(body, { abortEarly: false });
            validated = validation;
        } catch (err: any) {
            const errorMessages = err.inner
                .map((issue: any) => `${issue.path}: ${issue.message}`)
                .join('; ');
            return NextResponse.json(errorResponse(errorMessages), { status: 400 });
        }

        const { employee_id, reviewer, rating, goals, achievements, comments, review_date } = validated;
        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const employee = await prisma.employee.findFirst({
                where: { id: employee_id, company_id },
            });

            if (!employee) {
                return NextResponse.json(
                    errorResponse('Selected employee does not exist'),
                    { status: 400 }
                );
            }

            const performanceReview = await prisma.performanceReview.create({
                data: {
                    company_id,
                    employee_id,
                    reviewer: reviewer || null,
                    rating: rating ?? null,
                    goals: goals || null,
                    achievements: achievements || null,
                    comments: comments || null,
                    review_date: review_date ? parseDateOnly(review_date) : new Date(),
                },
            });

            await createNotification({
                action: 'Created',
                entity: 'PerformanceReview',
                entityId: performanceReview.id,
                entityName: `Review for ${employee.name}`,
                userId: (session?.user as any)?.id,
                link: `/hr/performance`,
            });

            return NextResponse.json(
                successResponse('Performance review created successfully', performanceReview),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error creating performance review:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to create performance review'), { status: 500 });
    }
}
