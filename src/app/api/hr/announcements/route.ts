import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';
import { parseDateOnly } from '@/lib/date-utils';

const TITLE_MAX = 200;

const createAnnouncementSchema = yup.object({
    title: yup.string().required('Title is required').max(TITLE_MAX, `Title must not exceed ${TITLE_MAX} characters`),
    description: yup.string().nullable().optional(),
    publish_date: yup.string().nullable().optional(),
    expiry_date: yup.string().nullable().optional(),
    priority: yup.string().oneOf(['LOW', 'MEDIUM', 'HIGH', 'NORMAL']).default('NORMAL').optional(),
    status: yup.string().oneOf(['ACTIVE', 'ARCHIVED', 'DRAFT']).default('ACTIVE').optional(),
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search')?.trim() || '';
        const sortField = searchParams.get('sortField') || 'publish_date';
        const sortOrder = searchParams.get('sortOrder') || 'desc';
        const status = searchParams.get('status')?.trim() || '';
        const priority = searchParams.get('priority')?.trim() || '';
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
            if (priority) {
                where.priority = priority;
            }

            const validSortFields = ['title', 'publish_date', 'expiry_date', 'priority', 'status', 'createdAt'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'publish_date';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const [data, total] = await Promise.all([
                prisma.announcement.findMany({
                    where,
                    orderBy: { [sortFieldToUse]: sortDirection },
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                prisma.announcement.count({ where }),
            ]);

            return NextResponse.json(
                successResponse('Announcements fetched successfully', data, {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                })
            );
        });
    } catch (error: any) {
        console.error('Error fetching announcements:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch announcements'), { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        let validated: {
            title: string;
            description?: string | null;
            publish_date?: string | null;
            expiry_date?: string | null;
            priority?: string;
            status?: string;
        };
        try {
            const validation = await createAnnouncementSchema.validate(body, { abortEarly: false });
            validated = validation;
        } catch (err: any) {
            const errorMessages = err.inner
                .map((issue: any) => `${issue.path}: ${issue.message}`)
                .join('; ');
            return NextResponse.json(errorResponse(errorMessages), { status: 400 });
        }

        const { title, description, publish_date, expiry_date, priority, status } = validated;
        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const announcement = await prisma.announcement.create({
                data: {
                    title,
                    company_id,
                    description: description || null,
                    publish_date: publish_date ? parseDateOnly(publish_date) : new Date(),
                    expiry_date: expiry_date ? parseDateOnly(expiry_date) : null,
                    priority: priority || 'NORMAL',
                    status: status || 'ACTIVE',
                },
            });

            await createNotification({
                action: 'Created',
                entity: 'Announcement',
                entityId: announcement.id,
                entityName: announcement.title,
                userId: (session?.user as any)?.id,
                link: `/hr/announcements`,
            });

            return NextResponse.json(
                successResponse('Announcement created successfully', announcement),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error creating announcement:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to create announcement'), { status: 500 });
    }
}
