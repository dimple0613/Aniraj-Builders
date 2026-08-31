import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const componentSchema = yup.object({
    id: yup.string().optional(),
    salary_component_id: yup.string().optional(),
    amount: yup.number().typeError('Amount must be a number').nullable().optional(),
    percentage: yup.number().typeError('Percentage must be a number').nullable().optional(),
    calculation_type: yup.string().oneOf(['FIXED', 'PERCENTAGE'], 'Calculation type must be FIXED or PERCENTAGE').optional(),
});

const updateSchema = yup.object({
    employee_id: yup.string().optional(),
    effective_from: yup.date().transform((v, o) => (o === '' || o == null ? null : v)).nullable().typeError('Invalid date format').optional(),
    effective_to: yup.date().transform((v, o) => (o === '' || o == null ? null : v)).nullable().typeError('Invalid date format').optional(),
    gross_salary: yup.number().typeError('Gross salary must be a number').positive('Gross salary must be positive').optional(),
    status: yup.string().oneOf(['ACTIVE', 'INACTIVE']).optional(),
    components: yup.array().of(componentSchema).optional(),
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

            const employeeSalary = await prisma.employeeSalary.findFirst({
                where: { id, company_id },
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
            });

            if (!employeeSalary) {
                return NextResponse.json(
                    errorResponse('Employee salary not found'),
                    { status: 404 }
                );
            }

            return NextResponse.json(
                successResponse('Employee salary fetched successfully', employeeSalary)
            );
        });
    } catch (error: any) {
        console.error('Error fetching employee salary:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch employee salary'), { status: 500 });
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

            const existing = await prisma.employeeSalary.findFirst({
                where: { id, company_id },
                include: {
                    components: true,
                },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Employee salary not found'),
                    { status: 404 }
                );
            }

            if (validated.employee_id && validated.employee_id !== existing.employee_id) {
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
            if (validated.effective_from !== undefined) updateData.effective_from = validated.effective_from;
            if (validated.effective_to !== undefined) updateData.effective_to = validated.effective_to;
            if (validated.gross_salary !== undefined) updateData.gross_salary = validated.gross_salary;
            if (validated.status !== undefined) updateData.status = validated.status;

            if (validated.components) {
                await prisma.employeeSalaryComponent.deleteMany({
                    where: { employee_salary_id: id },
                });

                if (validated.components.length > 0) {
                    await prisma.employeeSalaryComponent.createMany({
                        data: validated.components.map((comp: any) => ({
                            employee_salary_id: id,
                            salary_component_id: comp.salary_component_id,
                            amount: comp.amount || null,
                            percentage: comp.percentage || null,
                            calculation_type: comp.calculation_type,
                        })),
                    });
                }

                const compIds = validated.components.map((c: any) => c.salary_component_id);
                const comps = await prisma.payrollSalaryComponent.findMany({
                    where: { id: { in: compIds }, company_id },
                    select: { id: true, type: true },
                });
                const typeById: Record<string, string> = {};
                comps.forEach((c: any) => { typeById[c.id] = c.type; });
                const computedGross = validated.components.reduce((sum: number, c: any) => {
                    return typeById[c.salary_component_id] === 'EARNING' ? sum + (Number(c.amount) || 0) : sum;
                }, 0);
                if (computedGross > 0) {
                    updateData.gross_salary = computedGross;
                }
            }

            const employeeSalary = await prisma.employeeSalary.update({
                where: { id },
                data: updateData,
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
                action: 'Updated',
                entity: 'EmployeeSalary',
                entityId: employeeSalary.id,
                entityName: `Employee salary`,
                userId: (session?.user as any)?.id,
                link: `/hr/employee-salaries`,
            });

            return NextResponse.json(
                successResponse('Employee salary updated successfully', employeeSalary)
            );
        });
    } catch (error: any) {
        console.error('Error updating employee salary:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to update employee salary';
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

            const existing = await prisma.employeeSalary.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Employee salary not found'),
                    { status: 404 }
                );
            }

            await prisma.employeeSalary.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'EmployeeSalary',
                entityId: id,
                entityName: `Employee salary`,
                userId: (session?.user as any)?.id,
                link: `/hr/employee-salaries`,
            });

            return NextResponse.json(
                successResponse('Employee salary deleted successfully')
            );
        });
    } catch (error: any) {
        console.error('Error deleting employee salary:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to delete employee salary';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
