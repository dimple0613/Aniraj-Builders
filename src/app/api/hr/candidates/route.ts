import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const NAME_MAX = 100;

const createCandidateSchema = yup.object({
    name: yup.string().required('Name is required').max(NAME_MAX, `Name must not exceed ${NAME_MAX} characters`),
    job_id: yup.string().nullable().optional(),
    email: yup.string().email('Invalid email').nullable().optional(),
    phone: yup.string().nullable().optional(),
    resume: yup.string().nullable().optional(),
    status: yup.string().oneOf(['APPLIED', 'NEW', 'REVIEWING', 'SHORTLISTED', 'INTERVIEWED', 'OFFERED', 'HIRED', 'REJECTED']).default('APPLIED').optional(),
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search')?.trim() || '';
        const sortField = searchParams.get('sortField') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';
        const status = searchParams.get('status')?.trim() || '';
        const job_id = searchParams.get('job_id')?.trim() || '';
        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const where: any = { company_id };
            if (search) {
                where.name = { contains: search, mode: 'insensitive' };
            }
            if (status) {
                where.status = status;
            }
            if (job_id) {
                where.job_id = job_id;
            }

            const validSortFields = ['name', 'createdAt', 'updatedAt', 'status'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'createdAt';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const [data, total] = await Promise.all([
                prisma.candidate.findMany({
                    where,
                    orderBy: { [sortFieldToUse]: sortDirection },
                    skip: (page - 1) * limit,
                    take: limit,
                    include: {
                        job: {
                            select: { id: true, title: true },
                        },
                    },
                }),
                prisma.candidate.count({ where }),
            ]);

            return NextResponse.json(
                successResponse('Candidates fetched successfully', data, {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                })
            );
        });
    } catch (error: any) {
        console.error('Error fetching candidates:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch candidates'), { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        let validated: {
            name: string;
            job_id?: string | null;
            email?: string | null;
            phone?: string | null;
            resume?: string | null;
            status?: string;
        };
        try {
            const validation = await createCandidateSchema.validate(body, { abortEarly: false });
            validated = validation;
        } catch (err: any) {
            const errorMessages = err.inner
                .map((issue: any) => `${issue.path}: ${issue.message}`)
                .join('; ');
            return NextResponse.json(errorResponse(errorMessages), { status: 400 });
        }

        const { name, job_id, email, phone, resume, status } = validated;
        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            if (job_id) {
                const job = await prisma.job.findFirst({
                    where: { id: job_id, company_id },
                });
                if (!job) {
                    return NextResponse.json(
                        errorResponse('Selected job does not exist'),
                        { status: 400 }
                    );
                }
            }

            const candidate = await prisma.candidate.create({
                data: {
                    name,
                    company_id,
                    job_id: job_id || null,
                    email: email || null,
                    phone: phone || null,
                    resume: resume || null,
                    status: status || 'APPLIED',
                },
            });

            await createNotification({
                action: 'Created',
                entity: 'Candidate',
                entityId: candidate.id,
                entityName: candidate.name,
                userId: (session?.user as any)?.id,
                link: `/hr/candidates`,
            });

            return NextResponse.json(
                successResponse('Candidate created successfully', candidate),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error creating candidate:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to create candidate'), { status: 500 });
    }
}
