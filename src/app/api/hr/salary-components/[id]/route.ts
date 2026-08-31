import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const updateSchema = yup.object({
    name: yup.string().max(100, 'Name must not exceed 100 characters').optional(),
    type: yup.string().oneOf(['EARNING', 'DEDUCTION'], 'Type must be EARNING or DEDUCTION').optional(),
    calculation_type: yup.string().oneOf(['FIXED', 'PERCENTAGE'], 'Calculation type must be FIXED or PERCENTAGE').optional(),
    default_value: yup.number().typeError('Default value must be a number').nullable().optional(),
    percentage_of_id: yup.string().nullable().optional(),
    is_active: yup.boolean().optional(),
    sort_order: yup.number().typeError('Sort order must be a number').nullable().optional(),
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

            const component = await prisma.payrollSalaryComponent.findFirst({
                where: { id, company_id },
                include: {
                    percentageOf: {
                        select: { id: true, name: true },
                    },
                },
            });

            if (!component) {
                return NextResponse.json(
                    errorResponse('Salary component not found'),
                    { status: 404 }
                );
            }

            return NextResponse.json(
                successResponse('Salary component fetched successfully', component)
            );
        });
    } catch (error: any) {
        console.error('Error fetching salary component:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch salary component'), { status: 500 });
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

            const existing = await prisma.payrollSalaryComponent.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Salary component not found'),
                    { status: 404 }
                );
            }

            if (validated.percentage_of_id && validated.percentage_of_id !== existing.percentage_of_id) {
                const parent = await prisma.payrollSalaryComponent.findFirst({
                    where: { id: validated.percentage_of_id, company_id },
                });
                if (!parent) {
                    return NextResponse.json(
                        errorResponse('Referenced salary component does not exist'),
                        { status: 400 }
                    );
                }
            }

            const updateData: any = {};
            if (validated.name !== undefined) updateData.name = validated.name;
            if (validated.type !== undefined) updateData.type = validated.type;
            if (validated.calculation_type !== undefined) updateData.calculation_type = validated.calculation_type;
            if (validated.default_value !== undefined) updateData.default_value = validated.default_value;
            if (validated.percentage_of_id !== undefined) updateData.percentage_of_id = validated.percentage_of_id;
            if (validated.is_active !== undefined) updateData.is_active = validated.is_active;
            if (validated.sort_order !== undefined) updateData.sort_order = validated.sort_order;

            const component = await prisma.payrollSalaryComponent.update({
                where: { id },
                data: updateData,
                include: {
                    percentageOf: {
                        select: { id: true, name: true },
                    },
                },
            });

            await createNotification({
                action: 'Updated',
                entity: 'SalaryComponent',
                entityId: component.id,
                entityName: component.name,
                userId: (session?.user as any)?.id,
                link: `/hr/salary-components`,
            });

            return NextResponse.json(
                successResponse('Salary component updated successfully', component)
            );
        });
    } catch (error: any) {
        console.error('Error updating salary component:', error);
        if (error.code === 'P2002') {
            return NextResponse.json(
                errorResponse('Salary component with this name already exists'),
                { status: 409 }
            );
        }
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to update salary component';
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

            const existing = await prisma.payrollSalaryComponent.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Salary component not found'),
                    { status: 404 }
                );
            }

            await prisma.payrollSalaryComponent.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'SalaryComponent',
                entityId: id,
                entityName: existing.name,
                userId: (session?.user as any)?.id,
                link: `/hr/salary-components`,
            });

            return NextResponse.json(
                successResponse('Salary component deleted successfully')
            );
        });
    } catch (error: any) {
        console.error('Error deleting salary component:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to delete salary component';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
