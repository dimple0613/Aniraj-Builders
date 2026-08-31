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
    loan_type: yup.string().required('Loan type is required').oneOf(['LOAN', 'ADVANCE'], 'Loan type must be LOAN or ADVANCE'),
    amount: yup.number().typeError('Amount must be a number').required('Amount is required').positive('Amount must be positive'),
    emi_amount: yup.number().typeError('EMI amount must be a number').required('EMI amount is required').positive('EMI amount must be positive'),
    total_installments: yup.number().typeError('Total installments must be a number').required('Total installments is required').integer('Total installments must be an integer').positive('Total installments must be positive'),
    start_date: yup.date().required('Start date is required').typeError('Invalid date format'),
    end_date: yup.date().nullable().typeError('Invalid date format').optional(),
    notes: yup.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search')?.trim() || '';
        const sortField = searchParams.get('sortField') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';
        const employee_id = searchParams.get('employee_id')?.trim() || '';
        const status = searchParams.get('status')?.trim() || '';
        const loan_type = searchParams.get('loan_type')?.trim() || '';

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const where: any = { company_id };

            if (search) {
                where.employee = {
                    OR: [
                        { name: { contains: search, mode: 'insensitive' } },
                        { employee_code: { contains: search, mode: 'insensitive' } },
                    ],
                };
            }

            if (employee_id) {
                where.employee_id = employee_id;
            }

            if (status) {
                where.status = status;
            }

            if (loan_type) {
                where.loan_type = loan_type;
            }

            const validSortFields = ['amount', 'emi_amount', 'total_installments', 'paid_installments', 'remaining_amount', 'status', 'loan_type', 'start_date', 'end_date', 'createdAt', 'updatedAt'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'createdAt';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const [data, total] = await Promise.all([
                prisma.loan.findMany({
                    where,
                    orderBy: { [sortFieldToUse]: sortDirection },
                    skip: (page - 1) * limit,
                    take: limit,
                    include: {
                        employee: {
                            select: { id: true, name: true, employee_code: true },
                        },
                        repayments: {
                            orderBy: { month: 'asc' },
                        },
                    },
                }),
                prisma.loan.count({ where }),
            ]);

            return NextResponse.json(
                successResponse('Loans fetched successfully', data, {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                })
            );
        });
    } catch (error: any) {
        console.error('Error fetching loans:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch loans'), { status: 500 });
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

            if (validated.emi_amount > validated.amount) {
                return NextResponse.json(
                    errorResponse('EMI amount cannot be greater than total loan amount'),
                    { status: 400 }
                );
            }

            const repaymentAmount = validated.emi_amount * validated.total_installments;
            if (repaymentAmount < validated.amount) {
                return NextResponse.json(
                    errorResponse('Total repayment (EMI x installments) must be at least equal to the loan amount'),
                    { status: 400 }
                );
            }

            const repaymentSchedule: any[] = [];
            const startDate = new Date(validated.start_date);
            for (let i = 0; i < validated.total_installments; i++) {
                const repaymentDate = new Date(startDate);
                repaymentDate.setMonth(repaymentDate.getMonth() + i + 1);
                repaymentSchedule.push({
                    amount: validated.emi_amount,
                    month: repaymentDate.getMonth() + 1,
                    year: repaymentDate.getFullYear(),
                });
            }

            const loan = await prisma.loan.create({
                data: {
                    company_id,
                    employee_id: validated.employee_id,
                    loan_type: validated.loan_type,
                    amount: validated.amount,
                    emi_amount: validated.emi_amount,
                    total_installments: validated.total_installments,
                    paid_installments: 0,
                    remaining_amount: validated.amount,
                    status: 'ACTIVE',
                    start_date: validated.start_date,
                    end_date: validated.end_date || null,
                    notes: validated.notes || null,
                    repayments: {
                        create: repaymentSchedule,
                    },
                },
                include: {
                    employee: {
                        select: { id: true, name: true, employee_code: true },
                    },
                    repayments: {
                        orderBy: { month: 'asc' },
                    },
                },
            });

            await createNotification({
                action: 'Created',
                entity: 'Loan',
                entityId: loan.id,
                entityName: `${validated.loan_type} for ${employee.name}`,
                userId: (session?.user as any)?.id,
                link: `/hr/loans`,
            });

            return NextResponse.json(
                successResponse('Loan created successfully', loan),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error creating loan:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to create loan';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
