import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { createNotification } from '@/lib/notification-service';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const createEmployeeSchema = yup.object({
    name: yup.string().required('Name is required').max(255, 'Name must be less than 255 characters'),
    salary: yup.number().min(0, 'Salary must be 0 or greater').required('Salary is required'),
});

const updateEmployeeSchema = yup.object({
    id: yup.string().required('Employee ID is required'),
    name: yup.string().required('Name is required').max(255, 'Name must be less than 255 characters'),
    updateSalary: yup.boolean().optional(),
    newSalary: yup.number().min(0, 'New salary must be 0 or greater').optional(),
});

type CreateEmployeeInput = yup.InferType<typeof createEmployeeSchema>;
type UpdateEmployeeInput = yup.InferType<typeof updateEmployeeSchema>;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search')?.trim() || '';
        const sortField = searchParams.get('sortField') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc';

        const orderBy: any = {};
        if (['name', 'createdAt', 'updatedAt'].includes(sortField)) {
            orderBy[sortField] = sortOrder;
        } else {
            orderBy.createdAt = 'desc';
        }

        const [data, total] = await withCompany(async (company) => {
            const company_id = company?.company_id;

            const where: any = {};

            if (company_id) {
                where.company_id = company_id;
            }

            if (search) {
                where.name = { contains: search, mode: 'insensitive' };
            }

            const employees = await prisma.employee.findMany({
                where,
                include: {
                    prices: {
                        select: {
                            id: true,
                            price: true,
                            start_date: true,
                            expiry_date: true,
                        },
                        orderBy: { start_date: 'desc' }, // latest first
                    },
                },
                orderBy,
                skip: (page - 1) * limit,
                take: limit,
            });

            const formattedEmployees = employees.map((emp: any) => {
                const salaryHistory = emp.prices || [];

                const current = salaryHistory.find(
                    (p: any) => p.expiry_date === null
                );

                return {
                    id: emp.id,
                    name: emp.name,
                    currentSalary: current?.price?.toString() || '0',
                    prices: salaryHistory,
                    createdAt: emp.createdAt,
                    updatedAt: emp.updatedAt,
                };
            });



            const totalCount = await prisma.employee.count({ where });

            return [formattedEmployees, totalCount];
        });

        return NextResponse.json(
            successResponse('Employee data fetched successfully', data, {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            })
        );
    } catch (error) {
        console.error('Error fetching employees:', error);
        return NextResponse.json(
            errorResponse('Failed to fetch employees'),
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const validation = await createEmployeeSchema.validate(body, { abortEarly: false })
            .catch(err => {
                const errorMessages = err.inner
                    .map((issue: any) => `${issue.path}: ${issue.message}`)
                    .join('; ');
                throw new Error(errorMessages);
            });

        const { name, salary } = validation as CreateEmployeeInput;

        const response = await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(
                    unauthorizedResponse(),
                    { status: 401 }
                );
            }

            const existingEmployee = await prisma.employee.findFirst({
                where: {
                    company_id,
                    name: { equals: name.trim(), mode: 'insensitive' },
                },
            });

            if (existingEmployee) {
                return NextResponse.json(
                    errorResponse('An employee with this name already exists'),
                    { status: 409 }
                );
            }

            const employee: any = await prisma.$transaction(async (tx) => {
                const newEmployee = await tx.employee.create({
                    data: {
                        name: name.trim(),
                        company_id,
                    },
                });

                await tx.employeePrice.create({
                    data: {
                        employee_id: newEmployee.id,
                        company_id,
                        price: new Prisma.Decimal(salary),
                        start_date: new Date(),
                        expiry_date: null
                    }
                });

                return tx.employee.findUnique({
                    where: { id: newEmployee.id },
                    include: {
                        prices: {
                            where: { expiry_date: null },
                            take: 1,
                            orderBy: { start_date: 'desc' }
                        }
                    },
                });
            });

            // Create notification for Employee
            const session = await getServerSession(authOptions);
            await createNotification({
                action: 'Created',
                entity: 'Employee',
                entityId: employee?.id,
                entityName: employee?.name,
                userId: (session?.user as any)?.id,
                link: `/employee-management`,
            });

            return NextResponse.json(
                successResponse('Employee created successfully', {
                    id: employee?.id,
                    name: employee?.name,
                    currentSalary: employee?.prices[0]?.price?.toString() || '0',
                    createdAt: employee?.createdAt,
                    updatedAt: employee?.updatedAt
                }),
                { status: 201 }
            );
        });
 
        if (!response) {
            return NextResponse.json(
                errorResponse('Unexpected server error'),
                { status: 500 }
            );
        }

        return response;

    } catch (error: any) {
        console.error('Error creating employee:', error);
        const message = error?.message || 'Failed to create employee';
        const isValidationError = message.includes(':');

        return NextResponse.json(
            errorResponse(message),
            { status: isValidationError ? 400 : 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        const validation = await updateEmployeeSchema.validate(body, { abortEarly: false })
            .catch(err => {
                const errorMessages = err.inner
                    .map((issue: any) => `${issue.path}: ${issue.message}`)
                    .join('; ');
                throw new Error(errorMessages);
            });

        const { id, name, updateSalary, newSalary } = validation as UpdateEmployeeInput;

        const response = await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(
                    unauthorizedResponse(),
                    { status: 401 }
                );
            }

            const existingEmployee = await prisma.employee.findFirst({
                where: {
                    id,
                    company_id,
                },
            });

            if (!existingEmployee) {
                return NextResponse.json(
                    errorResponse('Employee not found'),
                    { status: 404 }
                );
            }

            const employee: any = await prisma.$transaction(async (tx) => {
                await tx.employee.update({
                    where: { id },
                    data: { name: name.trim() }
                });

                if (updateSalary && newSalary !== undefined && newSalary !== null) {
                    await tx.employeePrice.updateMany({
                        where: {
                            employee_id: id,
                            expiry_date: null
                        },
                        data: {
                            expiry_date: new Date()
                        }
                    });

                    await tx.employeePrice.create({
                        data: {
                            employee_id: id,
                            company_id,
                            price: new Prisma.Decimal(newSalary),
                            start_date: new Date(),
                            expiry_date: null
                        }
                    });
                }

                return tx.employee.findUnique({
                    where: { id },
                    include: {
                        prices: {
                            where: { expiry_date: null },
                            take: 1,
                            orderBy: { start_date: 'desc' }
                        }
                    },
                });
            });

            // Create notification for Employee
            const session = await getServerSession(authOptions);
            await createNotification({
                action: 'Updated',
                entity: 'Employee',
                entityId: employee?.id,
                entityName: employee?.name,
                userId: (session?.user as any)?.id,
                link: `/employee-management`,
            });

            return NextResponse.json(
                successResponse('Employee updated successfully', {
                    id: employee?.id,
                    name: employee?.name,
                    currentSalary: employee?.prices[0]?.price?.toString() || '0',
                    createdAt: employee?.createdAt,
                    updatedAt: employee?.updatedAt
                })
            );
        });
 
        if (!response) {
            return NextResponse.json(
                errorResponse('Unexpected server error'),
                { status: 500 }
            );
        }
 
        return response;

    } catch (error: any) {
        console.error('Error updating employee:', error);
        const message = error?.message || 'Failed to update employee';
        const isValidationError = message.includes(':');

        return NextResponse.json(
            errorResponse(message),
            { status: isValidationError ? 400 : 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json(
                errorResponse('Employee ID is required'),
                { status: 400 }
            );
        }

        const response = await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(
                    unauthorizedResponse(),
                    { status: 401 }
                );
            }

            const existingEmployee = await prisma.employee.findFirst({
                where: {
                    id,
                    company_id,
                },
            });

            if (!existingEmployee) {
                return NextResponse.json(
                    errorResponse('Employee not found'),
                    { status: 404 }
                );
            }

            await prisma.$transaction(async (tx) => {
                await tx.employeePrice.deleteMany({
                    where: { employee_id: id }
                });

                await tx.employee.delete({
                    where: { id }
                });
            });

            // Create notification for Employee
            const session = await getServerSession(authOptions);
            await createNotification({
                action: 'Deleted',
                entity: 'Employee',
                entityId: id,
                entityName: existingEmployee.name,
                userId: (session?.user as any)?.id,
                link: `/employee-management`,
            });

            return NextResponse.json(
                successResponse('Employee deleted successfully')
            );
        });
 
        if (!response) {
            return NextResponse.json(
                errorResponse('Unexpected server error'),
                { status: 500 }
            );
        }

        return response;

    } catch (error: any) {
        console.error('Error deleting employee:', error);
        return NextResponse.json(
            errorResponse('Failed to delete employee'),
            { status: 500 }
        );
    }
}
