import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const TITLE_MAX = 200;

const updateJobSchema = yup.object({
    title: yup.string().max(TITLE_MAX, `Title must not exceed ${TITLE_MAX} characters`).optional(),
    department: yup.string().nullable().optional(),
    vacancy: yup.number().integer().min(1).optional(),
    experience: yup.string().nullable().optional(),
    salary_range: yup.string().nullable().optional(),
    location: yup.string().nullable().optional(),
    status: yup.string().oneOf(['OPEN', 'CLOSED', 'DRAFT']).optional(),
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

            const job = await prisma.job.findFirst({
                where: { id, company_id },
            });

            if (!job) {
                return NextResponse.json(
                    errorResponse('Job not found'),
                    { status: 404 }
                );
            }

            return NextResponse.json(
                successResponse('Job fetched successfully', job)
            );
        });
    } catch (error: any) {
        console.error('Error fetching job:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch job'), { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        let validated: yup.InferType<typeof updateJobSchema>;
        try {
            validated = await updateJobSchema.validate(body, { abortEarly: false });
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

            const existing = await prisma.job.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Job not found'),
                    { status: 404 }
                );
            }

            const job = await prisma.job.update({
                where: { id },
                data: {
                    ...(validated.title !== undefined && { title: validated.title }),
                    ...(validated.department !== undefined && { department: validated.department }),
                    ...(validated.vacancy !== undefined && { vacancy: validated.vacancy }),
                    ...(validated.experience !== undefined && { experience: validated.experience }),
                    ...(validated.salary_range !== undefined && { salary_range: validated.salary_range }),
                    ...(validated.location !== undefined && { location: validated.location }),
                    ...(validated.status !== undefined && { status: validated.status }),
                },
            });

            await createNotification({
                action: 'Updated',
                entity: 'Job',
                entityId: job.id,
                entityName: job.title,
                userId: (session?.user as any)?.id,
                link: `/hr/jobs`,
            });

            return NextResponse.json(
                successResponse('Job updated successfully', job)
            );
        });
    } catch (error: any) {
        console.error('Error updating job:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to update job'), { status: 500 });
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

            const existing = await prisma.job.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Job not found'),
                    { status: 404 }
                );
            }

            const candidateCount = await prisma.candidate.count({
                where: { job_id: id },
            });

            if (candidateCount > 0) {
                return NextResponse.json(
                    errorResponse(`Cannot delete job. ${candidateCount} candidate(s) are associated with this job.`),
                    { status: 409 }
                );
            }

            await prisma.job.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'Job',
                entityId: id,
                entityName: existing.title,
                userId: (session?.user as any)?.id,
                link: `/hr/jobs`,
            });

            return NextResponse.json(
                successResponse('Job deleted successfully')
            );
        });
    } catch (error: any) {
        console.error('Error deleting job:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to delete job'), { status: 500 });
    }
}
