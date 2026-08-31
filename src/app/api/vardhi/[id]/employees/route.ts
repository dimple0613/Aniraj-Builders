import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Prisma } from '@prisma/client';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const response = await withCompany(async (company) => {
            if (!company?.company_id) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 }
                );
            }

            const employees = await prisma.vardhiEmployee.findMany({
                where: {
                    vardhi_id: id,
                },
                include: {
                    employee: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: { created_at: 'desc' },
            });

            const employeesWithTotal = employees.map(emp => {
                const baseRate = emp.rate || new Prisma.Decimal(0);
                let total = baseRate;

                if (emp.is_overtime && emp.overtime_hours) {
                    const overtimeRate = baseRate.div(8);
                    const overtimeAmount = overtimeRate.times(emp.overtime_hours);
                    total = total.plus(overtimeAmount);
                }

                return {
                    ...emp,
                    rate: emp.rate?.toString() || '0',
                    overtime_hours: emp.overtime_hours?.toString() || null,
                    total: total.toString(),
                };
            });

            return NextResponse.json(
                successResponse('Employees fetched successfully', employeesWithTotal)
            );
        });

        return response;

    } catch (error) {
        console.error('Error fetching vardhi employees:', error);
        return NextResponse.json(
            errorResponse('Failed to fetch vardhi employees'),
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: vardhi_id } = await params;
        const body = await request.json();
        const { employee_id, is_overtime, overtime_hours } = body;

        if (!employee_id) {
            return NextResponse.json(
                { success: false, message: "Employee ID is required" },
                { status: 400 }
            );
        }

        const response = await withCompany(async (company) => {
            if (!company?.company_id) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 }
                );
            }

            const vardhi = await prisma.vardhi.findFirst({
                where: {
                    id: vardhi_id,
                    company_id: company.company_id,
                },
            });

            if (!vardhi) {
                return NextResponse.json(
                    { success: false, message: "Vardhi not found" },
                    { status: 404 }
                );
            }

            const existingEmployee = await prisma.vardhiEmployee.findFirst({
                where: {
                    vardhi_id,
                    employee_id,
                },
            });

            if (existingEmployee) {
                return NextResponse.json(
                    { success: false, message: "Employee already added" },
                    { status: 409 }
                );
            }

            const employeePrice = await prisma.employeePrice.findFirst({
                where: {
                    employee_id,
                    expiry_date: null,
                },
                orderBy: { start_date: 'desc' },
            });

            const rate = employeePrice?.price || new Prisma.Decimal(0);

            const vardhiEmployee = await prisma.vardhiEmployee.create({
                data: {
                    vardhi_id,
                    employee_id,
                    company_id: company.company_id,
                    is_overtime: is_overtime || false,
                    overtime_hours: overtime_hours ? new Prisma.Decimal(overtime_hours) : null,
                    rate,
                },
                include: {
                    employee: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });

            let total = rate;
            if (vardhiEmployee.is_overtime && vardhiEmployee.overtime_hours) {
                const overtimeRate = rate.div(8);
                const overtimeAmount = overtimeRate.times(vardhiEmployee.overtime_hours);
                total = total.plus(overtimeAmount);
            }

            return NextResponse.json(
                successResponse('Employee added successfully', {
                    ...vardhiEmployee,
                    rate: vardhiEmployee.rate.toString(),
                    overtime_hours: vardhiEmployee.overtime_hours?.toString() || null,
                    total: total.toString(),
                })
            );
        });

        return response;

    } catch (error: any) {
        console.error('Error adding vardhi employee:', error);
        return NextResponse.json(
            errorResponse(error.message || 'Failed to add employee'),
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: vardhi_id } = await params;
        const body = await request.json();
        const { vardhi_employee_id, is_overtime, overtime_hours } = body;

        if (!vardhi_employee_id) {
            return NextResponse.json(
                { success: false, message: "Vardhi employee ID is required" },
                { status: 400 }
            );
        }

        const response = await withCompany(async (company) => {
            if (!company?.company_id) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 }
                );
            }

            const vardhi = await prisma.vardhi.findFirst({
                where: {
                    id: vardhi_id,
                    company_id: company.company_id,
                },
            });

            if (!vardhi) {
                return NextResponse.json(
                    { success: false, message: "Vardhi not found" },
                    { status: 404 }
                );
            }

            const vardhiEmployee = await prisma.vardhiEmployee.update({
                where: { id: vardhi_employee_id },
                data: {
                    is_overtime: is_overtime,
                    overtime_hours: overtime_hours ? new Prisma.Decimal(overtime_hours) : null,
                },
                include: {
                    employee: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            });

let total = vardhiEmployee.rate;
            if (vardhiEmployee.is_overtime && vardhiEmployee.overtime_hours) {
                const overtimeRate = vardhiEmployee.rate.div(8);
                const overtimeAmount = overtimeRate.times(vardhiEmployee.overtime_hours);
                total = total.plus(vardhiEmployee.rate);
            }

            return NextResponse.json(
                successResponse('Employee updated successfully', {
                    ...vardhiEmployee,
                    rate: vardhiEmployee.rate.toString(),
                    overtime_hours: vardhiEmployee.overtime_hours?.toString() || null,
                    total: total.toString(),
                })
            );
        });

        return response;

    } catch (error: any) {
        console.error('Error updating vardhi employee:', error);
        return NextResponse.json(
            errorResponse(error.message || 'Failed to update employee'),
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: vardhi_id } = await params;
        const { searchParams } = new URL(request.url);
        const vardhiEmployeeId = searchParams.get('employeeId');

        if (!vardhiEmployeeId) {
            return NextResponse.json(
                { success: false, message: "Employee ID is required" },
                { status: 400 }
            );
        }

        const response = await withCompany(async (company) => {
            if (!company?.company_id) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 }
                );
            }

            const vardhi = await prisma.vardhi.findFirst({
                where: {
                    id: vardhi_id,
                    company_id: company.company_id,
                },
            });

            if (!vardhi) {
                return NextResponse.json(
                    { success: false, message: "Vardhi not found" },
                    { status: 404 }
                );
            }

            await prisma.vardhiEmployee.delete({
                where: { id: vardhiEmployeeId },
            });

            return NextResponse.json(
                successResponse('Employee removed successfully')
            );
        });

        return response;

    } catch (error: any) {
        console.error('Error removing vardhi employee:', error);
        return NextResponse.json(
            errorResponse(error.message || 'Failed to remove employee'),
            { status: 500 }
        );
    }
}
