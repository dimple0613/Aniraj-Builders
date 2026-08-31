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
    type: yup.string().required('Type is required').oneOf(['EARNING', 'DEDUCTION'], 'Type must be EARNING or DEDUCTION'),
    calculation_type: yup.string().required('Calculation type is required').oneOf(['FIXED', 'PERCENTAGE'], 'Calculation type must be FIXED or PERCENTAGE'),
    default_value: yup.number().typeError('Default value must be a number').nullable().optional(),
    percentage_of_id: yup.string().nullable().optional(),
    is_active: yup.boolean().optional().default(true),
    sort_order: yup.number().typeError('Sort order must be a number').nullable().optional(),
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
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const where: any = { company_id };

            if (search) {
                where.name = { contains: search, mode: 'insensitive' };
            }

            const validSortFields = ['name', 'type', 'calculation_type', 'default_value', 'sort_order', 'is_active', 'createdAt', 'updatedAt'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'name';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const [data, total] = await Promise.all([
                prisma.payrollSalaryComponent.findMany({
                    where,
                    orderBy: { [sortFieldToUse]: sortDirection },
                    skip: (page - 1) * limit,
                    take: limit,
                    include: {
                        percentageOf: {
                            select: { id: true, name: true },
                        },
                    },
                }),
                prisma.payrollSalaryComponent.count({ where }),
            ]);

            return NextResponse.json(
                successResponse('Salary components fetched successfully', data, {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                })
            );
        });
    } catch (error: any) {
        console.error('Error fetching salary components:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch salary components'), { status: 500 });
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

            if (validated.percentage_of_id) {
                const parent = await prisma.payrollSalaryComponent.findFirst({
                    where: { id: validated.percentage_of_id, company_id },
                });
                if (!parent) {
                    return NextResponse.json(
                        errorResponse('Referenced salary component does not exist'),
                        { status: 400 }
                    );
                }
            }

            const component = await prisma.payrollSalaryComponent.create({
                data: {
                    name: validated.name,
                    type: validated.type,
                    calculation_type: validated.calculation_type,
                    default_value: validated.default_value || null,
                    percentage_of_id: validated.percentage_of_id || null,
                    is_active: validated.is_active ?? true,
                    sort_order: validated.sort_order ?? undefined,
                    company_id,
                },
                include: {
                    percentageOf: {
                        select: { id: true, name: true },
                    },
                },
            });

            await createNotification({
                action: 'Created',
                entity: 'SalaryComponent',
                entityId: component.id,
                entityName: component.name,
                userId: (session?.user as any)?.id,
                link: `/hr/salary-components`,
            });

            return NextResponse.json(
                successResponse('Salary component created successfully', component),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error creating salary component:', error);
        if (error.code === 'P2002') {
            return NextResponse.json(
                errorResponse('Salary component with this name already exists'),
                { status: 409 }
            );
        }
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to create salary component';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
