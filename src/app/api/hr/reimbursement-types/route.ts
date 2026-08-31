import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const createSchema = yup.object({
    name: yup.string().required('Name is required').max(100, 'Name must not exceed 100 characters'),
    description: yup.string().nullable().optional(),
    is_active: yup.boolean().optional().default(true),
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const sortField = searchParams.get('sortField') || 'name';
        const sortOrder = searchParams.get('sortOrder') || 'asc';

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const validSortFields = ['name', 'description', 'is_active', 'createdAt', 'updatedAt'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'name';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const page = parseInt(searchParams.get('page') || '1', 10);
            const limit = parseInt(searchParams.get('limit') || '10', 10);
            const search = searchParams.get('search') || '';
            const skip = (page - 1) * limit;

            const where: any = { company_id };
            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { description: { contains: search, mode: 'insensitive' } },
                ];
            }

            const [data, total] = await Promise.all([
                prisma.reimbursementType.findMany({
                    where,
                    orderBy: { [sortFieldToUse]: sortDirection },
                    skip,
                    take: limit,
                    include: {
                        _count: {
                            select: { reimbursementRequests: true },
                        },
                    },
                }),
                prisma.reimbursementType.count({ where }),
            ]);

            return NextResponse.json(
                successResponse('Reimbursement types fetched successfully', data, {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                })
            );
        });
    } catch (error: any) {
        console.error('Error fetching reimbursement types:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch reimbursement types'), { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        let validated: yup.InferType<typeof createSchema>;
        try {
            validated = await createSchema.validate(body, { abortEarly: false });
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

            const reimbursementType = await prisma.reimbursementType.create({
                data: {
                    name: validated.name,
                    description: validated.description || null,
                    is_active: validated.is_active ?? true,
                    company_id,
                },
            });

            await createNotification({
                action: 'Created',
                entity: 'ReimbursementType',
                entityId: reimbursementType.id,
                entityName: reimbursementType.name,
                userId: (session?.user as any)?.id,
                link: `/hr/reimbursement-types`,
            });

            return NextResponse.json(
                successResponse('Reimbursement type created successfully', reimbursementType),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error creating reimbursement type:', error);
        if (error.code === 'P2002') {
            return NextResponse.json(
                errorResponse('Reimbursement type with this name already exists'),
                { status: 409 }
            );
        }
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to create reimbursement type';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
