import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { createNotification } from '@/lib/notification-service';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const createWorkTypeSchema = yup.object({
    name: yup.string().required('Name is required').max(100, 'Name must be less than 100 characters'),
    is_active: yup.boolean().optional().default(true),
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search')?.trim() || '';
        const sortField = searchParams.get('sortField') || 'name';
        const sortOrder = searchParams.get('sortOrder') || 'asc';
        const includeInactive = searchParams.get('includeInactive') === 'true';

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const where: any = {};
            if (!includeInactive) {
                where.deletedAt = null;
            }

            if (search) {
                where.name = { contains: search, mode: 'insensitive' };
            }

            const validSortFields = ['name', 'is_active', 'createdAt', 'updatedAt'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'name';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const [data, total] = await Promise.all([
                prisma.workType.findMany({
                    where,
                    orderBy: { [sortFieldToUse]: sortDirection },
                    skip: (page - 1) * limit,
                    take: limit,
                    select: {
                        id: true,
                        name: true,
                        is_active: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                }),
                prisma.workType.count({ where }),
            ]);

            return NextResponse.json(
                successResponse('Work types fetched successfully', data, {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                })
            );
        });
    } catch (error) {
        console.error('Error fetching work types:', error);
        return NextResponse.json(errorResponse('Failed to fetch work types'), { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const validation = await createWorkTypeSchema.validate(body, { abortEarly: false })
            .catch(err => {
                const errorMessages = err.inner
                    .map((issue: any) => `${issue.path}: ${issue.message}`)
                    .join('; ');
                throw new Error(errorMessages);
            });

        const { name, is_active } = validation;

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const workType = await prisma.workType.create({
                data: {
                    name,
                    company_id,
                },
                select: {
                    id: true,
                    name: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });

            // Create notification for Work Type
            const session = await getServerSession(authOptions);
            await createNotification({
                action: 'Created',
                entity: 'Work Type',
                entityId: workType.id,
                entityName: workType.name,
                userId: (session?.user as any)?.id,
                link: `/maintenance-sor`,
            });

            return NextResponse.json(
                successResponse('Work type created successfully', workType),
                { status: 201 }
            );
        });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json(
                errorResponse('Work type with this name already exists'),
                { status: 409 }
            );
        }
        console.error('Error creating work type:', error);
        const message = error?.message || 'Failed to create work type';
        const isValidationError = message.includes(':');
        return NextResponse.json(errorResponse(message), { status: isValidationError ? 400 : 500 });
    }
}
