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

const DEPARTMENT_NAME_MAX = 100;

const createDepartmentSchema = yup.object({
    name: yup.string().required('Name is required').max(DEPARTMENT_NAME_MAX, `Department name must not exceed ${DEPARTMENT_NAME_MAX} characters`),
    code: yup.string().nullable().max(50, 'Code must not exceed 50 characters'),
    manager_name: yup.string().nullable().max(100, 'Manager name must not exceed 100 characters'),
    phone: yup.string().nullable().max(20, 'Phone must not exceed 20 characters'),
    email: yup.string().nullable().email('Invalid email format'),
    description: yup.string().nullable(),
    status: yup.string().nullable().oneOf(['ACTIVE', 'INACTIVE'], 'Status must be ACTIVE or INACTIVE').default('ACTIVE'),
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
            const includeHidden = searchParams.get('includeHidden') === 'true';
            if (!includeHidden) {
                where.AND = [
                    { NOT: { name: { equals: 'PURCHASE', mode: 'insensitive' } } },
                ];
            }
            if (search) {
                if (!where.AND) where.AND = [];
                where.AND.push({ name: { contains: search, mode: 'insensitive' } });
            }

            const validSortFields = ['name', 'code', 'manager_name', 'phone', 'email', 'status', 'createdAt', 'updatedAt'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'name';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const [data, total] = await Promise.all([
                prisma.department.findMany({
                    where,
                    orderBy: { [sortFieldToUse]: sortDirection },
                    skip: (page - 1) * limit,
                    take: limit,
                    select: {
                        id: true,
                        name: true,
                        code: true,
                        manager_name: true,
                        phone: true,
                        email: true,
                        description: true,
                        status: true,
                        createdAt: true,
                        updatedAt: true,
                    },
                }),
                prisma.department.count({ where }),
            ]);


            return NextResponse.json(
                successResponse('Departments fetched successfully', data, {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                })
            );
        });
    } catch (error: any) {
        console.error('Error fetching departments:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch departments'), { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        // Validate request body
        let validated: yup.InferType<typeof createDepartmentSchema>;
        try {
            validated = await createDepartmentSchema.validate(body, { abortEarly: false });
        } catch (err: any) {
            const errorMessages = err.inner
                .map((issue: any) => `${issue.path}: ${issue.message}`)
                .join('; ');
            console.error('Validation error:', errorMessages, 'body:', JSON.stringify(body));
            return NextResponse.json(errorResponse(`${errorMessages} (body: ${JSON.stringify(body)})`), { status: 400 });
        }

        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                console.error('No company ID found');
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existingDepartment = await prisma.department.findFirst({
                where: {
                    name: { equals: validated.name, mode: 'insensitive' },
                },
            });

            if (existingDepartment) {
                return NextResponse.json(
                    errorResponse('Department with this name already exists'),
                    { status: 409 }
                );
            }

            const department = await prisma.department.create({
                data: {
                    name: validated.name,
                    code: validated.code || null,
                    manager_name: validated.manager_name || null,
                    phone: validated.phone || null,
                    email: validated.email || null,
                    description: validated.description || null,
                    status: validated.status || 'ACTIVE',
                    company_id,
                },
                select: {
                    id: true,
                    name: true,
                    code: true,
                    manager_name: true,
                    phone: true,
                    email: true,
                    description: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });

            await createNotification({
                action: 'Created',
                entity: 'Department',
                entityId: department.id,
                entityName: department.name,
                userId: (session?.user as any)?.id,
                link: `/departments`,
            });

            return NextResponse.json(
                successResponse('Department created successfully', department),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error creating department:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        if (error.code === 'P2002') {
            return NextResponse.json(
                errorResponse('Department with this name already exists'),
                { status: 409 }
            );
        }
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to create department';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
