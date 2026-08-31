import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const NAME_MAX = 100;

const updateCandidateSchema = yup.object({
    name: yup.string().max(NAME_MAX, `Name must not exceed ${NAME_MAX} characters`).optional(),
    job_id: yup.string().nullable().optional(),
    email: yup.string().email('Invalid email').nullable().optional(),
    phone: yup.string().nullable().optional(),
    resume: yup.string().nullable().optional(),
    status: yup.string().oneOf(['APPLIED', 'NEW', 'REVIEWING', 'SHORTLISTED', 'INTERVIEWED', 'OFFERED', 'HIRED', 'REJECTED']).optional(),
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

            const candidate = await prisma.candidate.findFirst({
                where: { id, company_id },
                include: {
                    job: {
                        select: { id: true, title: true },
                    },
                },
            });

            if (!candidate) {
                return NextResponse.json(
                    errorResponse('Candidate not found'),
                    { status: 404 }
                );
            }

            return NextResponse.json(
                successResponse('Candidate fetched successfully', candidate)
            );
        });
    } catch (error: any) {
        console.error('Error fetching candidate:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch candidate'), { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        let validated: yup.InferType<typeof updateCandidateSchema>;
        try {
            validated = await updateCandidateSchema.validate(body, { abortEarly: false });
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

            const existing = await prisma.candidate.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Candidate not found'),
                    { status: 404 }
                );
            }

            if (validated.job_id) {
                const job = await prisma.job.findFirst({
                    where: { id: validated.job_id, company_id },
                });
                if (!job) {
                    return NextResponse.json(
                        errorResponse('Selected job does not exist'),
                        { status: 400 }
                    );
                }
            }

            const candidate = await prisma.candidate.update({
                where: { id },
                data: {
                    ...(validated.name !== undefined && { name: validated.name }),
                    ...(validated.job_id !== undefined && { job_id: validated.job_id }),
                    ...(validated.email !== undefined && { email: validated.email }),
                    ...(validated.phone !== undefined && { phone: validated.phone }),
                    ...(validated.resume !== undefined && { resume: validated.resume }),
                    ...(validated.status !== undefined && { status: validated.status }),
                },
            });

            await createNotification({
                action: 'Updated',
                entity: 'Candidate',
                entityId: candidate.id,
                entityName: candidate.name,
                userId: (session?.user as any)?.id,
                link: `/hr/candidates`,
            });

            return NextResponse.json(
                successResponse('Candidate updated successfully', candidate)
            );
        });
    } catch (error: any) {
        console.error('Error updating candidate:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to update candidate'), { status: 500 });
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

            const existing = await prisma.candidate.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Candidate not found'),
                    { status: 404 }
                );
            }

            await prisma.candidate.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'Candidate',
                entityId: id,
                entityName: existing.name,
                userId: (session?.user as any)?.id,
                link: `/hr/candidates`,
            });

            return NextResponse.json(
                successResponse('Candidate deleted successfully')
            );
        });
    } catch (error: any) {
        console.error('Error deleting candidate:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to delete candidate'), { status: 500 });
    }
}
