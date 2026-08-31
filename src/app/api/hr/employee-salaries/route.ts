import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const componentSchema = yup.object({
    salary_component_id: yup.string().required('Salary component is required'),
    amount: yup.number().typeError('Amount must be a number').nullable().optional(),
    percentage: yup.number().typeError('Percentage must be a number').nullable().optional(),
    calculation_type: yup.string().oneOf(['FIXED', 'PERCENTAGE'], 'Calculation type must be FIXED or PERCENTAGE').required('Calculation type is required'),
});

const createSchema = yup.object({
    employee_id: yup.string().required('Employee is required'),
    effective_from: yup.date().transform((v, o) => (o === '' || o == null ? null : v)).nullable().typeError('Invalid date format').optional(),
    effective_to: yup.date().transform((v, o) => (o === '' || o == null ? null : v)).nullable().typeError('Invalid date format').optional(),
    gross_salary: yup.number().typeError('Gross salary must be a number').required('Gross salary is required').positive('Gross salary must be positive'),
    status: yup.string().oneOf(['ACTIVE', 'INACTIVE']).default('ACTIVE').optional(),
    components: yup.array().of(componentSchema).optional(),
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

            const validSortFields = ['effective_from', 'effective_to', 'gross_salary', 'status', 'createdAt', 'updatedAt'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'createdAt';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const [data, total] = await Promise.all([
                prisma.employeeSalary.findMany({
                    where,
                    orderBy: { [sortFieldToUse]: sortDirection },
                    skip: (page - 1) * limit,
                    take: limit,
                    include: {
                        employee: {
                            select: { id: true, name: true, employee_code: true },
                        },
                        components: {
                            include: {
                                salaryComponent: {
                                    select: { id: true, name: true, type: true, code: true },
                                },
                            },
                        },
                    },
                }),
                prisma.employeeSalary.count({ where }),
            ]);

            return NextResponse.json(
                successResponse('Employee salaries fetched successfully', data, {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                })
            );
        });
    } catch (error: any) {
        console.error('Error fetching employee salaries:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch employee salaries'), { status: 500 });
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

            if (validated.components && validated.components.length > 0) {
                for (const comp of validated.components) {
                    const salaryComponent = await prisma.payrollSalaryComponent.findFirst({
                        where: { id: comp.salary_component_id, company_id },
                    });
                    if (!salaryComponent) {
                        return NextResponse.json(
                            errorResponse(`Salary component ${comp.salary_component_id} does not exist`),
                            { status: 400 }
                        );
                    }
                }
            }

            let computedGross = 0;
            if (validated.components && validated.components.length > 0) {
                const compIds = validated.components.map((c: any) => c.salary_component_id);
                const comps = await prisma.payrollSalaryComponent.findMany({
                    where: { id: { in: compIds }, company_id },
                    select: { id: true, type: true },
                });
                const typeById: Record<string, string> = {};
                comps.forEach((c: any) => { typeById[c.id] = c.type; });
                computedGross = validated.components.reduce((sum: number, c: any) => {
                    return typeById[c.salary_component_id] === 'EARNING' ? sum + (Number(c.amount) || 0) : sum;
                }, 0);
            }
            const grossSalary = computedGross > 0 ? computedGross : (validated.gross_salary || 0);

            const employeeSalary = await prisma.employeeSalary.create({
                data: {
                    company_id,
                    employee_id: validated.employee_id,
                    effective_from: validated.effective_from,
                    effective_to: validated.effective_to || null,
                    gross_salary: grossSalary,
                    status: validated.status || 'ACTIVE',
                    components: validated.components && validated.components.length > 0
                        ? {
                            create: validated.components.map((comp: any) => ({
                                salary_component_id: comp.salary_component_id,
                                amount: comp.amount || null,
                                percentage: comp.percentage || null,
                                calculation_type: comp.calculation_type,
                            })),
                        }
                        : undefined,
                },
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
            });

            await createNotification({
                action: 'Created',
                entity: 'EmployeeSalary',
                entityId: employeeSalary.id,
                entityName: `Salary for ${employee.name}`,
                userId: (session?.user as any)?.id,
                link: `/hr/employee-salaries`,
            });

            return NextResponse.json(
                successResponse('Employee salary created successfully', employeeSalary),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error creating employee salary:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to create employee salary';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
