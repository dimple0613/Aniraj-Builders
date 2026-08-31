import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';
import * as yup from 'yup';

const updateDepartmentSchema = yup.object({
    name: yup.string().max(100, 'Department name must not exceed 100 characters'),
    code: yup.string().nullable().max(50, 'Code must not exceed 50 characters'),
    manager_name: yup.string().nullable().max(100, 'Manager name must not exceed 100 characters'),
    phone: yup.string().nullable().max(20, 'Phone must not exceed 20 characters'),
    email: yup.string().nullable().email('Invalid email format'),
    description: yup.string().nullable(),
    status: yup.string().nullable().oneOf(['ACTIVE', 'INACTIVE'], 'Status must be ACTIVE or INACTIVE'),
});

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        let validated: yup.InferType<typeof updateDepartmentSchema>;
        try {
            validated = await updateDepartmentSchema.validate(body, { abortEarly: false });
        } catch (err: any) {
            const errorMessages = err.inner
                .map((issue: any) => `${issue.path}: ${issue.message}`)
                .join('; ');
            console.error('Validation error:', errorMessages, 'body:', JSON.stringify(body));
            return NextResponse.json(errorResponse(`${errorMessages} (body: ${JSON.stringify(body)})`), { status: 400 });
        }

        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                console.error('No company ID found');
                return NextResponse.json(errorResponse('Unauthorized'), { status: 401 });
            }

            const existingDepartment = await prisma.department.findFirst({
                where: { id },
            });

            if (!existingDepartment) {
                return NextResponse.json(
                    errorResponse('Department not found'),
                    { status: 404 }
                );
            }

            const department = await prisma.department.update({
                where: { id },
                data: {
                    ...(validated.name !== undefined && { name: validated.name }),
                    ...(validated.code !== undefined && { code: validated.code || null }),
                    ...(validated.manager_name !== undefined && { manager_name: validated.manager_name || null }),
                    ...(validated.phone !== undefined && { phone: validated.phone || null }),
                    ...(validated.email !== undefined && { email: validated.email || null }),
                    ...(validated.description !== undefined && { description: validated.description || null }),
                    ...(validated.status !== undefined && { status: validated.status }),
                },
                select: {
                    id: true,
                    name: true,
                    code: true,
                    manager_name: true,
                    phone: true,
                    email: true,
                    description: true,
                    status: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });

            await createNotification({
                action: 'Updated',
                entity: 'Department',
                entityId: id,
                entityName: department.name,
                userId: (session?.user as any)?.id,
                link: `/departments`,
            });

            return NextResponse.json(
                successResponse('Department updated successfully', department)
            );
        });
    } catch (error: any) {
        console.error('Error updating department:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        if (error.code === 'P2002') {
            return NextResponse.json(
                errorResponse('Department with this name already exists'),
                { status: 409 }
            );
        }
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(errorResponse('Unauthorized'), { status: 401 });
        }
        const message = error?.message || 'Failed to update department';
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
            const department = await prisma.department.findFirst({
                where: { id },
            });

            if (!department) {
                return NextResponse.json(
                    errorResponse('Department not found'),
                    { status: 404 }
                );
            }

            // Check if any ItemMaster records reference this department
            const itemMasterUsingDept = await prisma.itemMaster.findFirst({
                where: { departmentId: id }
            });

            if (itemMasterUsingDept) {
                return NextResponse.json(
                    errorResponse('This record cannot be deleted because it is currently in use.'),
                    { status: 400 }
                );
            }

            // Check if any Employee records reference this department
            const employeeUsingDept = await prisma.employee.findFirst({
                where: { department_id: id }
            });

            if (employeeUsingDept) {
                return NextResponse.json(
                    errorResponse('This record cannot be deleted because it is currently in use.'),
                    { status: 400 }
                );
            }

            // Check if any project uses this department
            const projectUsingDept = await prisma.project.findFirst({
                where: { department: id },
                select: { name: true }
            });

            if (projectUsingDept) {
                return NextResponse.json(
                    errorResponse('This record cannot be deleted because it is currently in use.'),
                    { status: 400 }
                );
            }

            await prisma.department.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'Department',
                entityId: id,
                entityName: department.name,
                userId: (session?.user as any)?.id,
                link: `/departments`,
            });

            return NextResponse.json(
                successResponse('Department deleted successfully')
            );
        });
    } catch (error: any) {
        console.error('Error deleting department:', error);
        // Fallback to Prisma foreign key error handling
        if (error.code === 'P2003') {
            return NextResponse.json(
                errorResponse('Cannot delete department that is in use by projects'),
                { status: 400 }
            );
        }
        return NextResponse.json(
            errorResponse('Failed to delete department'),
            { status: 500 }
        );
    }
}