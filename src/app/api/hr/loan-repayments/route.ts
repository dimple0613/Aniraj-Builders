import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const createSchema = yup.object({
    loan_id: yup.string().required('Loan is required'),
    payroll_run_id: yup.string().required('Payroll run is required'),
    amount: yup.number().typeError('Amount must be a number').required('Amount is required').positive('Amount must be positive'),
    month: yup.number().required('Month is required').min(1, 'Month must be between 1 and 12').max(12, 'Month must be between 1 and 12'),
    year: yup.number().required('Year is required'),
});

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

            const loan = await prisma.loan.findFirst({
                where: { id: validated.loan_id, company_id },
            });

            if (!loan) {
                return NextResponse.json(
                    errorResponse('Loan does not exist'),
                    { status: 400 }
                );
            }

            if (loan.status !== 'ACTIVE') {
                return NextResponse.json(
                    errorResponse('Loan is not active'),
                    { status: 400 }
                );
            }

            const payrollRun = await prisma.payrollRun.findFirst({
                where: { id: validated.payroll_run_id, company_id },
            });

            if (!payrollRun) {
                return NextResponse.json(
                    errorResponse('Payroll run does not exist'),
                    { status: 400 }
                );
            }

            if (validated.amount > loan.remaining_amount) {
                return NextResponse.json(
                    errorResponse('Repayment amount exceeds remaining loan amount'),
                    { status: 400 }
                );
            }

            const existingRepayment = await prisma.loanRepayment.findFirst({
                where: {
                    loan_id: validated.loan_id,
                    month: validated.month,
                    year: validated.year,
                },
            });

            if (existingRepayment) {
                return NextResponse.json(
                    errorResponse('Repayment already recorded for this month/year'),
                    { status: 409 }
                );
            }

            const repayment = await prisma.loanRepayment.create({
                data: {
                    loan_id: validated.loan_id,
                    payroll_run_id: validated.payroll_run_id,
                    amount: validated.amount,
                    month: validated.month,
                    year: validated.year,
                },
                include: {
                    loan: {
                        select: { id: true, loan_type: true, remaining_amount: true, paid_installments: true, total_installments: true },
                    },
                },
            });

            const newPaidInstallments = loan.paid_installments + 1;
            const newRemainingAmount = loan.remaining_amount - validated.amount;
            const newStatus = newRemainingAmount <= 0 ? 'CLOSED' : 'ACTIVE';

            await prisma.loan.update({
                where: { id: validated.loan_id },
                data: {
                    paid_installments: newPaidInstallments,
                    remaining_amount: newRemainingAmount,
                    status: newStatus,
                },
            });

            await createNotification({
                action: 'Created',
                entity: 'LoanRepayment',
                entityId: repayment.id,
                entityName: `Repayment for ${loan.loan_type}`,
                userId: (session?.user as any)?.id,
                link: `/hr/loans`,
            });

            return NextResponse.json(
                successResponse('Loan repayment recorded successfully', repayment),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error recording loan repayment:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to record loan repayment';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
