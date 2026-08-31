import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const generateSchema = yup.object({
    payroll_run_id: yup.string().required('Payroll run ID is required'),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        let validated: yup.InferType<typeof generateSchema>;
        try {
            validated = await generateSchema.validate(body, { abortEarly: false });
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

            const payrollRun = await prisma.payrollRun.findFirst({
                where: { id: validated.payroll_run_id, company_id },
                include: {
                    period: { select: { month: true, year: true } },
                    payrollItems: true,
                },
            });

            if (!payrollRun) {
                return NextResponse.json(
                    errorResponse('Payroll run not found'),
                    { status: 404 }
                );
            }

            if (payrollRun.status === 'DRAFT') {
                return NextResponse.json(
                    errorResponse('Cannot generate payslips for a draft payroll run. Process it first.'),
                    { status: 400 }
                );
            }

            const existingPayslips = await prisma.payslip.count({
                where: { payroll_run_id: payrollRun.id },
            });

            if (existingPayslips > 0) {
                return NextResponse.json(
                    successResponse(`Payslips already generated for this run (${existingPayslips} payslips)`, null)
                );
            }

            const employees = await prisma.employee.findMany({
                where: { company_id },
                select: { id: true, employee_code: true },
            });

            const empMap = new Map(employees.map(e => [e.id, e]));

            const payslipData = payrollRun.payrollItems.map((item, index) => {
                const emp = empMap.get(item.employee_id);
                const slipNumber = `PS-${payrollRun.period.year}-${String(payrollRun.period.month).padStart(2, '0')}-${String(index + 1).padStart(3, '0')}`;
                return {
                    payroll_item_id: item.id,
                    employee_id: item.employee_id,
                    payroll_run_id: payrollRun.id,
                    payslip_number: slipNumber,
                    generated_date: new Date(),
                };
            });

            await prisma.payslip.createMany({
                data: payslipData,
                skipDuplicates: true,
            });

            await createNotification({
                action: 'Created',
                entity: 'Payslip',
                entityId: payrollRun.id,
                entityName: `Payslips for ${payrollRun.period.month}/${payrollRun.period.year}`,
                userId: (session?.user as any)?.id,
                link: `/hr/payslips`,
            });

            return NextResponse.json(
                successResponse(`${payslipData.length} payslip(s) generated successfully`),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error generating payslips:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to generate payslips';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const sortField = searchParams.get('sortField') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';
        const employee_id = searchParams.get('employee_id')?.trim() || '';
        const payroll_run_id = searchParams.get('payroll_run_id')?.trim() || '';

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const where: any = {
                payrollRun: { company_id },
            };

            if (employee_id) {
                where.employee_id = employee_id;
            }

            if (payroll_run_id) {
                where.payroll_run_id = payroll_run_id;
            }

            const validSortFields = ['payslip_number', 'generated_date', 'createdAt', 'updatedAt'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'createdAt';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const [data, total] = await Promise.all([
                prisma.payslip.findMany({
                    where,
                    orderBy: { [sortFieldToUse]: sortDirection },
                    skip: (page - 1) * limit,
                    take: limit,
                    include: {
                        employee: {
                            select: { id: true, name: true, employee_code: true },
                        },
                        payrollRun: {
                            select: {
                                id: true,
                                process_date: true,
                                status: true,
                                financialYear: {
                                    select: { name: true },
                                },
                                period: {
                                    select: { id: true, month: true, year: true, start_date: true, end_date: true },
                                },
                            },
                        },
                        payrollItem: {
                            select: { id: true, gross_salary: true, total_earnings: true, total_deductions: true, net_pay: true },
                        },
                    },
                }),
                prisma.payslip.count({ where }),
            ]);

            return NextResponse.json(
                successResponse('Payslips fetched successfully', data, {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                })
            );
        });
    } catch (error: any) {
        console.error('Error fetching payslips:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch payslips'), { status: 500 });
    }
}
