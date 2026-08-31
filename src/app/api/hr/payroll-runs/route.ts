import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const createSchema = yup.object({
    financial_year_id: yup.string().required('Financial year is required'),
    period_id: yup.string().required('Period is required'),
    process_date: yup.date().required('Process date is required').typeError('Invalid date format'),
    notes: yup.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const sortField = searchParams.get('sortField') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';
        const period_id = searchParams.get('period_id')?.trim() || '';
        const status = searchParams.get('status')?.trim() || '';

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const where: any = { company_id };

            if (period_id) {
                where.period_id = period_id;
            }

            if (status) {
                where.status = status;
            }

            const validSortFields = ['process_date', 'total_employees', 'total_gross', 'total_net', 'status', 'createdAt', 'updatedAt'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'createdAt';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const [data, total] = await Promise.all([
                prisma.payrollRun.findMany({
                    where,
                    orderBy: { [sortFieldToUse]: sortDirection },
                    skip: (page - 1) * limit,
                    take: limit,
                    include: {
                        financialYear: {
                            select: { id: true, name: true, start_date: true, end_date: true },
                        },
                        period: {
                            select: { id: true, month: true, year: true, start_date: true, end_date: true },
                        },
                    },
                }),
                prisma.payrollRun.count({ where }),
            ]);

            return NextResponse.json(
                successResponse('Payroll runs fetched successfully', data, {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                })
            );
        });
    } catch (error: any) {
        console.error('Error fetching payroll runs:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch payroll runs'), { status: 500 });
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

            const financialYear = await prisma.payrollFinancialYear.findFirst({
                where: { id: validated.financial_year_id, company_id },
            });

            if (!financialYear) {
                return NextResponse.json(
                    errorResponse('Financial year does not exist'),
                    { status: 400 }
                );
            }

            const period = await prisma.payrollPeriod.findFirst({
                where: { id: validated.period_id },
                include: { financialYear: true },
            });

            if (!period || period.financialYear.company_id !== company_id) {
                return NextResponse.json(
                    errorResponse('Payroll period does not exist'),
                    { status: 400 }
                );
            }

            const existingRun = await prisma.payrollRun.findFirst({
                where: { period_id: validated.period_id, company_id },
            });

            if (existingRun) {
                return NextResponse.json(
                    errorResponse('Payroll run already exists for this period'),
                    { status: 409 }
                );
            }

            const activeEmployees = await prisma.employee.findMany({
                where: {
                    company_id,
                    status: 'ACTIVE',
                },
                select: { id: true, name: true, employee_code: true },
            });

            const employeeSalaries = await prisma.employeeSalary.findMany({
                where: {
                    company_id,
                    status: 'ACTIVE',
                    employee_id: { in: activeEmployees.map(e => e.id) },
                    AND: [
                        {
                            OR: [
                                { effective_from: { lte: validated.process_date } },
                                { effective_from: null },
                            ],
                        },
                        {
                            OR: [
                                { effective_to: null },
                                { effective_to: { gte: validated.process_date } },
                            ],
                        },
                    ],
                },
                include: {
                    components: {
                        include: {
                            salaryComponent: true,
                        },
                    },
                },
            });

            const salaryMap = new Map(employeeSalaries.map(s => [s.employee_id, s]));

            // Fetch active loans for all employees being processed
            const employeeIds = activeEmployees.map(e => e.id);
            const activeLoans = await prisma.loan.findMany({
                where: {
                    company_id,
                    status: 'ACTIVE',
                    employee_id: { in: employeeIds },
                    start_date: { lte: validated.process_date },
                },
            });
            const loansByEmployee = new Map<string, typeof activeLoans>();
            for (const loan of activeLoans) {
                const existing = loansByEmployee.get(loan.employee_id) || [];
                existing.push(loan);
                loansByEmployee.set(loan.employee_id, existing);
            }

            // Find or create LOAN_EMI salary component for this company
            let loanEmiComponent = await prisma.payrollSalaryComponent.findFirst({
                where: { company_id, code: 'LOAN_EMI' },
            });
            if (!loanEmiComponent) {
                loanEmiComponent = await prisma.payrollSalaryComponent.create({
                    data: {
                        company_id,
                        code: 'LOAN_EMI',
                        name: 'Loan EMI',
                        type: 'DEDUCTION',
                        calculation_type: 'FIXED',
                        default_value: 0,
                        is_standard: true,
                        is_active: true,
                        sort_order: 12,
                    },
                });
            }

            let totalEmployees = 0;
            let totalGross = 0;
            let totalEarnings = 0;
            let totalDeductions = 0;
            let totalNet = 0;

            const payrollItemsData: any[] = [];

            for (const employee of activeEmployees) {
                const salary = salaryMap.get(employee.id);
                if (!salary) continue;

                totalEmployees++;
                const gross = salary.gross_salary;
                totalGross += Number(gross);

                let earnings = 0;
                let deductions = 0;
                const itemComponents: any[] = [];

                for (const comp of salary.components) {
                    let amount = 0;
                    if (comp.calculation_type === 'FIXED') {
                        amount = Number(comp.amount || 0);
                    } else if (comp.calculation_type === 'PERCENTAGE' && comp.percentage) {
                        const baseComp = comp.salaryComponent?.percentageOfId
                            ? salary.components.find(c => c.salary_component_id === comp.salaryComponent.percentageOfId)
                            : null;
                        const baseAmount = baseComp ? Number(baseComp.amount || 0) : gross;
                        amount = (Number(comp.percentage) / 100) * baseAmount;
                    }

                    if (comp.salaryComponent?.type === 'EARNING') {
                        earnings += amount;
                    } else {
                        deductions += amount;
                    }

                    itemComponents.push({
                        salary_component_id: comp.salary_component_id,
                        amount,
                        type: comp.salaryComponent?.type || 'EARNING',
                    });
                }

                // Auto-deduct loan EMIs for active loans
                const employeeLoans = loansByEmployee.get(employee.id) || [];
                let totalLoanEmi = 0;
                for (const loan of employeeLoans) {
                    const emiAmount = Math.min(Number(loan.emi_amount), Number(loan.remaining_amount));
                    if (emiAmount > 0) {
                        totalLoanEmi += emiAmount;
                    }
                }
                if (totalLoanEmi > 0) {
                    deductions += totalLoanEmi;
                    itemComponents.push({
                        salary_component_id: loanEmiComponent.id,
                        amount: totalLoanEmi,
                        type: 'DEDUCTION',
                    });
                }

                totalEarnings += earnings;
                totalDeductions += deductions;
                const netPay = gross - deductions;
                totalNet += netPay;

                payrollItemsData.push({
                    employee_id: employee.id,
                    employee_salary_id: salary.id,
                    gross_salary: gross,
                    total_earnings: earnings,
                    total_deductions: deductions,
                    net_pay: netPay,
                    components: {
                        create: itemComponents,
                    },
                });
            }

            const payrollRun = await prisma.payrollRun.create({
                data: {
                    company_id,
                    financial_year_id: validated.financial_year_id,
                    period_id: validated.period_id,
                    process_date: validated.process_date,
                    total_employees: totalEmployees,
                    total_gross: totalGross,
                    total_earnings: totalEarnings,
                    total_deductions: totalDeductions,
                    total_net: totalNet,
                    status: 'DRAFT',
                    notes: validated.notes || null,
                    payrollItems: {
                        create: payrollItemsData,
                    },
                },
                include: {
                    financialYear: {
                        select: { id: true, name: true },
                    },
                    period: {
                        select: { id: true, month: true, year: true },
                    },
                    payrollItems: {
                        include: {
                            employee: {
                                select: { id: true, name: true, employee_code: true },
                            },
                            components: {
                                include: {
                                    salaryComponent: true,
                                },
                            },
                        },
                    },
                },
            });

            await prisma.payrollPeriod.update({
                where: { id: validated.period_id },
                data: { is_processed: true },
            });

            // Record loan repayments for employees with active loans
            for (const employee of activeEmployees) {
                const employeeLoans = loansByEmployee.get(employee.id) || [];
                for (const loan of employeeLoans) {
                    const emiAmount = Math.min(Number(loan.emi_amount), Number(loan.remaining_amount));
                    if (emiAmount <= 0) continue;

                    // Check if repayment already recorded for this loan + month/year
                    const existing = await prisma.loanRepayment.findFirst({
                        where: {
                            loan_id: loan.id,
                            month: period.month,
                            year: period.year,
                        },
                    });
                    if (existing) continue;

                    await prisma.loanRepayment.create({
                        data: {
                            loan_id: loan.id,
                            payroll_run_id: payrollRun.id,
                            amount: emiAmount,
                            month: period.month,
                            year: period.year,
                        },
                    });

                    const newPaidInstallments = loan.paid_installments + 1;
                    const newRemainingAmount = loan.remaining_amount - emiAmount;

                    await prisma.loan.update({
                        where: { id: loan.id },
                        data: {
                            paid_installments: newPaidInstallments,
                            remaining_amount: newRemainingAmount,
                            status: newRemainingAmount <= 0 ? 'CLOSED' : 'ACTIVE',
                        },
                    });
                }
            }

            await createNotification({
                action: 'Created',
                entity: 'PayrollRun',
                entityId: payrollRun.id,
                entityName: `Payroll run for ${financialYear.name}`,
                userId: (session?.user as any)?.id,
                link: `/hr/payroll-runs`,
            });

            return NextResponse.json(
                successResponse('Payroll processed successfully', payrollRun),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error processing payroll:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to process payroll';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
