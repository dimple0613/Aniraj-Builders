import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const NAME_MAX = 100;

const createLeaveTypeSchema = yup.object({
    name: yup.string().required('Name is required').max(NAME_MAX, `Leave type name must not exceed ${NAME_MAX} characters`),
    days: yup.number().integer().min(0).default(0).optional(),
    carry_forward: yup.boolean().default(false).optional(),
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search')?.trim() || '';
        const sortField = searchParams.get('sortField') || 'name';
        const sortOrder = searchParams.get('sortOrder') || 'asc';
        return await withCompany(async (company) => {
            const where: any = {};
            if (search) {
                where.name = { contains: search, mode: 'insensitive' };
            }

            const validSortFields = ['name', 'days', 'createdAt', 'updatedAt'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'name';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const [data, total] = await Promise.all([
                prisma.leaveType.findMany({
                    where,
                    orderBy: { [sortFieldToUse]: sortDirection },
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                prisma.leaveType.count({ where }),
            ]);

            return NextResponse.json(
                successResponse('Leave types fetched successfully', data, {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                })
            );
        });
    } catch (error: any) {
        console.error('Error fetching leave types:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch leave types'), { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        let validated: { name: string; days?: number; carry_forward?: boolean };
        try {
            const validation = await createLeaveTypeSchema.validate(body, { abortEarly: false });
            validated = validation;
        } catch (err: any) {
            const errorMessages = err.inner
                .map((issue: any) => `${issue.path}: ${issue.message}`)
                .join('; ');
            return NextResponse.json(errorResponse(errorMessages), { status: 400 });
        }

        const { name, days, carry_forward } = validated;
        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existing = await prisma.leaveType.findFirst({
                where: {
                    name: { equals: name, mode: 'insensitive' },
                },
            });

            if (existing) {
                return NextResponse.json(
                    errorResponse('Leave type with this name already exists'),
                    { status: 409 }
                );
            }

            const leaveType = await prisma.leaveType.create({
                data: {
                    name,
                    company_id,
                    days: days ?? 0,
                    carry_forward: carry_forward ?? false,
                },
            });

            await createNotification({
                action: 'Created',
                entity: 'LeaveType',
                entityId: leaveType.id,
                entityName: leaveType.name,
                userId: (session?.user as any)?.id,
                link: `/hr/leave-types`,
            });

            return NextResponse.json(
                successResponse('Leave type created successfully', leaveType),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error creating leave type:', error);
        if (error.code === 'P2002') {
            return NextResponse.json(
                errorResponse('Leave type with this name already exists'),
                { status: 409 }
            );
        }
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to create leave type'), { status: 500 });
    }
}
