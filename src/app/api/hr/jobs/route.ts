import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const TITLE_MAX = 200;

const createJobSchema = yup.object({
    title: yup.string().required('Title is required').max(TITLE_MAX, `Title must not exceed ${TITLE_MAX} characters`),
    department: yup.string().nullable().optional(),
    vacancy: yup.number().integer().min(1).default(1).optional(),
    experience: yup.string().nullable().optional(),
    salary_range: yup.string().nullable().optional(),
    location: yup.string().nullable().optional(),
    status: yup.string().oneOf(['OPEN', 'CLOSED', 'DRAFT']).default('OPEN').optional(),
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
        const department = searchParams.get('department')?.trim() || '';
        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const where: any = { company_id };
            if (search) {
                where.title = { contains: search, mode: 'insensitive' };
            }
            if (status) {
                where.status = status;
            }
            if (department) {
                where.department = { contains: department, mode: 'insensitive' };
            }

            const validSortFields = ['title', 'createdAt', 'updatedAt', 'status', 'vacancy'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'createdAt';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const [data, total] = await Promise.all([
                prisma.job.findMany({
                    where,
                    orderBy: { [sortFieldToUse]: sortDirection },
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                prisma.job.count({ where }),
            ]);

            return NextResponse.json(
                successResponse('Jobs fetched successfully', data, {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                })
            );
        });
    } catch (error: any) {
        console.error('Error fetching jobs:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch jobs'), { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        let validated: {
            title: string;
            department?: string | null;
            vacancy?: number;
            experience?: string | null;
            salary_range?: string | null;
            location?: string | null;
            status?: string;
        };
        try {
            const validation = await createJobSchema.validate(body, { abortEarly: false });
            validated = validation;
        } catch (err: any) {
            const errorMessages = err.inner
                .map((issue: any) => `${issue.path}: ${issue.message}`)
                .join('; ');
            return NextResponse.json(errorResponse(errorMessages), { status: 400 });
        }

        const { title, department, vacancy, experience, salary_range, location, status } = validated;
        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const job = await prisma.job.create({
                data: {
                    title,
                    company_id,
                    department: department || null,
                    vacancy: vacancy ?? 1,
                    experience: experience || null,
                    salary_range: salary_range || null,
                    location: location || null,
                    status: status || 'OPEN',
                },
            });

            await createNotification({
                action: 'Created',
                entity: 'Job',
                entityId: job.id,
                entityName: job.title,
                userId: (session?.user as any)?.id,
                link: `/hr/jobs`,
            });

            return NextResponse.json(
                successResponse('Job created successfully', job),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error creating job:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to create job'), { status: 500 });
    }
}
