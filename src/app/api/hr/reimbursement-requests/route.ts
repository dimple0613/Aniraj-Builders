import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const createSchema = yup.object({
    employee_id: yup.string().required('Employee is required'),
    reimbursement_type_id: yup.string().required('Reimbursement type is required'),
    amount: yup.number().typeError('Amount must be a number').required('Amount is required').positive('Amount must be positive'),
    description: yup.string().nullable().optional(),
    expense_date: yup.date().required('Expense date is required').typeError('Invalid date format'),
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
        const employee_id = searchParams.get('employee_id')?.trim() || '';

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const where: any = { company_id };

            if (search) {
                where.OR = [
                    { description: { contains: search, mode: 'insensitive' } },
                    { employee: { name: { contains: search, mode: 'insensitive' } } },
                ];
            }

            if (status) {
                where.status = status;
            }

            if (employee_id) {
                where.employee_id = employee_id;
            }

            const validSortFields = ['amount', 'expense_date', 'status', 'createdAt', 'updatedAt'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'createdAt';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const [data, total] = await Promise.all([
                prisma.reimbursementRequest.findMany({
                    where,
                    orderBy: { [sortFieldToUse]: sortDirection },
                    skip: (page - 1) * limit,
                    take: limit,
                    include: {
                        employee: {
                            select: { id: true, name: true, employee_code: true },
                        },
                        reimbursementType: {
                            select: { id: true, name: true },
                        },
                    },
                }),
                prisma.reimbursementRequest.count({ where }),
            ]);

            return NextResponse.json(
                successResponse('Reimbursement requests fetched successfully', data, {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                })
            );
        });
    } catch (error: any) {
        console.error('Error fetching reimbursement requests:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch reimbursement requests'), { status: 500 });
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

            const employee = await prisma.employee.findFirst({
                where: { id: validated.employee_id, company_id },
            });

            if (!employee) {
                return NextResponse.json(
                    errorResponse('Selected employee does not exist'),
                    { status: 400 }
                );
            }

            const reimbursementType = await prisma.reimbursementType.findFirst({
                where: { id: validated.reimbursement_type_id, company_id, is_active: true },
            });

            if (!reimbursementType) {
                return NextResponse.json(
                    errorResponse('Selected reimbursement type does not exist or is inactive'),
                    { status: 400 }
                );
            }

            const reimbursementRequest = await prisma.reimbursementRequest.create({
                data: {
                    company_id,
                    employee_id: validated.employee_id,
                    reimbursement_type_id: validated.reimbursement_type_id,
                    amount: validated.amount,
                    description: validated.description || null,
                    expense_date: validated.expense_date,
                    status: 'PENDING',
                },
                include: {
                    employee: {
                        select: { id: true, name: true, employee_code: true },
                    },
                    reimbursementType: {
                        select: { id: true, name: true },
                    },
                },
            });

            await createNotification({
                action: 'Created',
                entity: 'ReimbursementRequest',
                entityId: reimbursementRequest.id,
                entityName: `Reimbursement for ${employee.name}`,
                userId: (session?.user as any)?.id,
                link: `/hr/reimbursement-requests`,
            });

            return NextResponse.json(
                successResponse('Reimbursement request created successfully', reimbursementRequest),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error creating reimbursement request:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to create reimbursement request';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
