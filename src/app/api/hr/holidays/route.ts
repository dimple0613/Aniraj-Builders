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

const createHolidaySchema = yup.object({
    title: yup.string().required('Title is required').max(TITLE_MAX, `Title must not exceed ${TITLE_MAX} characters`),
    date: yup.string().required('Date is required'),
    type: yup.string().oneOf(['PUBLIC', 'OBSERVANCE', 'OPTIONAL']).default('PUBLIC').optional(),
    description: yup.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search')?.trim() || '';
        const sortField = searchParams.get('sortField') || 'date';
        const sortOrder = searchParams.get('sortOrder') || 'asc';
        const type = searchParams.get('type')?.trim() || '';
        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const where: any = { company_id };
            if (search) {
                where.title = { contains: search, mode: 'insensitive' };
            }
            if (type) {
                where.type = type;
            }

            const validSortFields = ['title', 'date', 'type', 'createdAt'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'date';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const [data, total] = await Promise.all([
                prisma.holiday.findMany({
                    where,
                    orderBy: { [sortFieldToUse]: sortDirection },
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                prisma.holiday.count({ where }),
            ]);

            return NextResponse.json(
                successResponse('Holidays fetched successfully', data, {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                })
            );
        });
    } catch (error: any) {
        console.error('Error fetching holidays:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch holidays'), { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        let validated: { title: string; date: string; type?: string; description?: string | null };
        try {
            const validation = await createHolidaySchema.validate(body, { abortEarly: false });
            validated = validation;
        } catch (err: any) {
            const errorMessages = err.inner
                .map((issue: any) => `${issue.path}: ${issue.message}`)
                .join('; ');
            return NextResponse.json(errorResponse(errorMessages), { status: 400 });
        }

        const { title, date, type, description } = validated;
        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const holidayDate = parseDateOnly(date);
            if (isNaN(holidayDate.getTime())) {
                return NextResponse.json(
                    errorResponse('Invalid date format'),
                    { status: 400 }
                );
            }

            const existing = await prisma.holiday.findFirst({
                where: {
                    title: { equals: title, mode: 'insensitive' },
                    date: holidayDate,
                    company_id,
                },
            });

            if (existing) {
                return NextResponse.json(
                    errorResponse('Holiday with this title and date already exists'),
                    { status: 409 }
                );
            }

            const holiday = await prisma.holiday.create({
                data: {
                    title,
                    company_id,
                    date: holidayDate,
                    type: type || 'PUBLIC',
                    description: description || null,
                },
            });

            await createNotification({
                action: 'Created',
                entity: 'Holiday',
                entityId: holiday.id,
                entityName: holiday.title,
                userId: (session?.user as any)?.id,
                link: `/hr/holidays`,
            });

            return NextResponse.json(
                successResponse('Holiday created successfully', holiday),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error creating holiday:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to create holiday'), { status: 500 });
    }
}
