import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';
import { parseDateOnly } from '@/lib/date-utils';

const updatePerformanceReviewSchema = yup.object({
    employee_id: yup.string().optional(),
    reviewer: yup.string().nullable().optional(),
    rating: yup.number().integer().min(1).max(5).nullable().optional(),
    goals: yup.string().nullable().optional(),
    achievements: yup.string().nullable().optional(),
    comments: yup.string().nullable().optional(),
    review_date: yup.string().nullable().optional(),
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

            const performanceReview = await prisma.performanceReview.findFirst({
                where: { id, company_id },
                include: {
                    employee: {
                        select: { id: true, name: true, employee_code: true },
                    },
                },
            });

            if (!performanceReview) {
                return NextResponse.json(
                    errorResponse('Performance review not found'),
                    { status: 404 }
                );
            }

            return NextResponse.json(
                successResponse('Performance review fetched successfully', performanceReview)
            );
        });
    } catch (error: any) {
        console.error('Error fetching performance review:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch performance review'), { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        let validated: yup.InferType<typeof updatePerformanceReviewSchema>;
        try {
            validated = await updatePerformanceReviewSchema.validate(body, { abortEarly: false });
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

            const existing = await prisma.performanceReview.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Performance review not found'),
                    { status: 404 }
                );
            }

            if (validated.employee_id) {
                const employee = await prisma.employee.findFirst({
                    where: { id: validated.employee_id, company_id },
                });
                if (!employee) {
                    return NextResponse.json(
                        errorResponse('Selected employee does not exist'),
                        { status: 400 }
                    );
                }
            }

            const performanceReview = await prisma.performanceReview.update({
                where: { id },
                data: {
                    ...(validated.employee_id !== undefined && { employee_id: validated.employee_id }),
                    ...(validated.reviewer !== undefined && { reviewer: validated.reviewer }),
                    ...(validated.rating !== undefined && { rating: validated.rating }),
                    ...(validated.goals !== undefined && { goals: validated.goals }),
                    ...(validated.achievements !== undefined && { achievements: validated.achievements }),
                    ...(validated.comments !== undefined && { comments: validated.comments }),
                    ...(validated.review_date !== undefined && { review_date: parseDateOnly(validated.review_date) }),
                },
            });

            await createNotification({
                action: 'Updated',
                entity: 'PerformanceReview',
                entityId: performanceReview.id,
                entityName: `Performance review`,
                userId: (session?.user as any)?.id,
                link: `/hr/performance`,
            });

            return NextResponse.json(
                successResponse('Performance review updated successfully', performanceReview)
            );
        });
    } catch (error: any) {
        console.error('Error updating performance review:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to update performance review'), { status: 500 });
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

            const existing = await prisma.performanceReview.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Performance review not found'),
                    { status: 404 }
                );
            }

            await prisma.performanceReview.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'PerformanceReview',
                entityId: id,
                entityName: `Performance review`,
                userId: (session?.user as any)?.id,
                link: `/hr/performance`,
            });

            return NextResponse.json(
                successResponse('Performance review deleted successfully')
            );
        });
    } catch (error: any) {
        console.error('Error deleting performance review:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to delete performance review'), { status: 500 });
    }
}
