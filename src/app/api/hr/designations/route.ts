import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

if (!prisma) {
    throw new Error('Prisma client not initialized');
}

const NAME_MAX = 100;

const createDesignationSchema = yup.object({
    name: yup.string().required('Name is required').max(NAME_MAX, `Designation name must not exceed ${NAME_MAX} characters`),
    department_id: yup.string().nullable().optional(),
    description: yup.string().nullable().optional(),
    status: yup.string().oneOf(['ACTIVE', 'INACTIVE']).default('ACTIVE').optional(),
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search')?.trim() || '';
        const sortField = searchParams.get('sortField') || 'name';
        const sortOrder = searchParams.get('sortOrder') || 'asc';
        const department_id = searchParams.get('department_id')?.trim() || '';
        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                console.error('No company ID found');
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const where: any = {};
            if (search) {
                where.name = { contains: search, mode: 'insensitive' };
            }
            if (department_id) {
                where.department_id = department_id;
            }

            const validSortFields = ['name', 'createdAt', 'updatedAt', 'status'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'name';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const [data, total] = await Promise.all([
                prisma.designation.findMany({
                    where,
                    orderBy: { [sortFieldToUse]: sortDirection },
                    skip: (page - 1) * limit,
                    take: limit,
                    include: {
                        department: {
                            select: { id: true, name: true },
                        },
                    },
                }),
                prisma.designation.count({ where }),
            ]);

            return NextResponse.json(
                successResponse('Designations fetched successfully', data, {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                })
            );
        });
    } catch (error: any) {
        console.error('Error fetching designations:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch designations'), { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        let validated: { name: string; department_id?: string | null; description?: string | null; status?: string };
        try {
            const validation = await createDesignationSchema.validate(body, { abortEarly: false });
            validated = validation;
        } catch (err: any) {
            const errorMessages = err.inner
                .map((issue: any) => `${issue.path}: ${issue.message}`)
                .join('; ');
            return NextResponse.json(errorResponse(errorMessages), { status: 400 });
        }

        const { name, department_id, description, status } = validated;
        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                console.error('No company ID found');
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            if (department_id) {
                const department = await prisma.department.findFirst({
                    where: { id: department_id },
                });
                if (!department) {
                    return NextResponse.json(
                        errorResponse('Selected department does not exist'),
                        { status: 400 }
                    );
                }
            }

            const existing = await prisma.designation.findFirst({
                where: {
                    name: { equals: name, mode: 'insensitive' },
                },
            });

            if (existing) {
                return NextResponse.json(
                    errorResponse('Designation with this name already exists'),
                    { status: 409 }
                );
            }

            const designation = await prisma.designation.create({
                data: {
                    name,
                    company_id,
                    department_id: department_id || null,
                    description: description || null,
                    status: status || 'ACTIVE',
                },
            });

            await createNotification({
                action: 'Created',
                entity: 'Designation',
                entityId: designation.id,
                entityName: designation.name,
                userId: (session?.user as any)?.id,
                link: `/hr/designations`,
            });

            return NextResponse.json(
                successResponse('Designation created successfully', designation),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error creating designation:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        if (error.code === 'P2002') {
            return NextResponse.json(
                errorResponse('Designation with this name already exists'),
                { status: 409 }
            );
        }
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to create designation';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
