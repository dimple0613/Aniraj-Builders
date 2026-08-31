import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const updateSchema = yup.object({
    employee_id: yup.string().optional(),
    loan_type: yup.string().oneOf(['LOAN', 'ADVANCE'], 'Loan type must be LOAN or ADVANCE').optional(),
    amount: yup.number().typeError('Amount must be a number').positive('Amount must be positive').optional(),
    emi_amount: yup.number().typeError('EMI amount must be a number').positive('EMI amount must be positive').optional(),
    total_installments: yup.number().typeError('Total installments must be a number').integer('Total installments must be an integer').positive('Total installments must be positive').optional(),
    paid_installments: yup.number().typeError('Paid installments must be a number').integer('Paid installments must be an integer').min(0, 'Paid installments cannot be negative').optional(),
    remaining_amount: yup.number().typeError('Remaining amount must be a number').min(0, 'Remaining amount cannot be negative').optional(),
    status: yup.string().oneOf(['ACTIVE', 'CLOSED'], 'Status must be ACTIVE or CLOSED').optional(),
    start_date: yup.date().typeError('Invalid date format').optional(),
    end_date: yup.date().nullable().typeError('Invalid date format').optional(),
    notes: yup.string().nullable().optional(),
});

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const loan = await prisma.loan.findFirst({
                where: { id, company_id },
                include: {
                    employee: {
                        select: { id: true, name: true, employee_code: true },
                    },
                    repayments: {
                        orderBy: { month: 'asc' },
                    },
                },
            });

            if (!loan) {
                return NextResponse.json(
                    errorResponse('Loan not found'),
                    { status: 404 }
                );
            }

            return NextResponse.json(
                successResponse('Loan fetched successfully', loan)
            );
        });
    } catch (error: any) {
        console.error('Error fetching loan:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch loan'), { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        let validated: yup.InferType<typeof updateSchema>;
        try {
            validated = await updateSchema.validate(body, { abortEarly: false });
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

            const existing = await prisma.loan.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Loan not found'),
                    { status: 404 }
                );
            }

            if (validated.employee_id) {
                const employee = await prisma.employee.findFirst({
                    where: { id: validated.employee_id, company_id },
                });
                if (!employee) {
                    return NextResponse.json(
                        errorResponse('Selected employee does not exist'),
                        { status: 400 }
                    );
                }
            }

            const updateData: any = {};
            if (validated.employee_id !== undefined) updateData.employee_id = validated.employee_id;
            if (validated.loan_type !== undefined) updateData.loan_type = validated.loan_type;
            if (validated.amount !== undefined) updateData.amount = validated.amount;
            if (validated.emi_amount !== undefined) updateData.emi_amount = validated.emi_amount;
            if (validated.total_installments !== undefined) updateData.total_installments = validated.total_installments;
            if (validated.paid_installments !== undefined) updateData.paid_installments = validated.paid_installments;
            if (validated.remaining_amount !== undefined) updateData.remaining_amount = validated.remaining_amount;
            if (validated.status !== undefined) updateData.status = validated.status;
            if (validated.start_date !== undefined) updateData.start_date = validated.start_date;
            if (validated.end_date !== undefined) updateData.end_date = validated.end_date;
            if (validated.notes !== undefined) updateData.notes = validated.notes;

            const loan = await prisma.loan.update({
                where: { id },
                data: updateData,
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
                action: 'Updated',
                entity: 'Loan',
                entityId: loan.id,
                entityName: `${loan.loan_type}`,
                userId: (session?.user as any)?.id,
                link: `/hr/loans`,
            });

            return NextResponse.json(
                successResponse('Loan updated successfully', loan)
            );
        });
    } catch (error: any) {
        console.error('Error updating loan:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to update loan';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existing = await prisma.loan.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Loan not found'),
                    { status: 404 }
                );
            }

            await prisma.loan.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'Loan',
                entityId: id,
                entityName: `${existing.loan_type}`,
                userId: (session?.user as any)?.id,
                link: `/hr/loans`,
            });

            return NextResponse.json(
                successResponse('Loan deleted successfully')
            );
        });
    } catch (error: any) {
        console.error('Error deleting loan:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to delete loan';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
