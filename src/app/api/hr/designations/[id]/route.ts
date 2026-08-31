import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

if (!prisma) {
    throw new Error('Prisma client not initialized');
}

const NAME_MAX = 100;

const updateDesignationSchema = yup.object({
    name: yup.string().max(NAME_MAX, `Designation name must not exceed ${NAME_MAX} characters`).optional(),
    department_id: yup.string().nullable().optional(),
    description: yup.string().nullable().optional(),
    status: yup.string().oneOf(['ACTIVE', 'INACTIVE']).optional(),
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
                console.error('No company ID found');
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const designation = await prisma.designation.findFirst({
                where: { id },
                include: {
                    department: {
                        select: { id: true, name: true },
                    },
                },
            });

            if (!designation) {
                return NextResponse.json(
                    errorResponse('Designation not found'),
                    { status: 404 }
                );
            }

            return NextResponse.json(
                successResponse('Designation fetched successfully', designation)
            );
        });
    } catch (error: any) {
        console.error('Error fetching designation:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch designation'), { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        let validated: yup.InferType<typeof updateDesignationSchema>;
        try {
            validated = await updateDesignationSchema.validate(body, { abortEarly: false });
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
                console.error('No company ID found');
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existing = await prisma.designation.findFirst({
                where: { id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Designation not found'),
                    { status: 404 }
                );
            }

            if (validated.department_id) {
                const department = await prisma.department.findFirst({
                    where: { id: validated.department_id },
                });
                if (!department) {
                    return NextResponse.json(
                        errorResponse('Selected department does not exist'),
                        { status: 400 }
                    );
                }
            }

            if (validated.name && validated.name.toLowerCase() !== existing.name.toLowerCase()) {
                const duplicate = await prisma.designation.findFirst({
                    where: {
                        name: { equals: validated.name, mode: 'insensitive' },
                        id: { not: id },
                    },
                });
                if (duplicate) {
                    return NextResponse.json(
                        errorResponse('Designation with this name already exists'),
                        { status: 409 }
                    );
                }
            }

            const designation = await prisma.designation.update({
                where: { id },
                data: {
                    ...(validated.name !== undefined && { name: validated.name }),
                    ...(validated.department_id !== undefined && { department_id: validated.department_id }),
                    ...(validated.description !== undefined && { description: validated.description }),
                    ...(validated.status !== undefined && { status: validated.status }),
                },
            });

            await createNotification({
                action: 'Updated',
                entity: 'Designation',
                entityId: designation.id,
                entityName: designation.name,
                userId: (session?.user as any)?.id,
                link: `/hr/designations`,
            });

            return NextResponse.json(
                successResponse('Designation updated successfully', designation)
            );
        });
    } catch (error: any) {
        console.error('Error updating designation:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        if (error.code === 'P2002') {
            return NextResponse.json(
                errorResponse('Designation with this name already exists'),
                { status: 409 }
            );
        }
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to update designation';
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
                console.error('No company ID found');
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existing = await prisma.designation.findFirst({
                where: { id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Designation not found'),
                    { status: 404 }
                );
            }

            const employeeCount = await prisma.employee.count({
                where: { designation_id: id },
            });

            if (employeeCount > 0) {
                return NextResponse.json(
                    errorResponse(`Cannot delete designation. Currently in use.`),
                    { status: 409 }
                );
            }

            await prisma.designation.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'Designation',
                entityId: id,
                entityName: existing.name,
                userId: (session?.user as any)?.id,
                link: `/hr/designations`,
            });

            return NextResponse.json(
                successResponse('Designation deleted successfully')
            );
        });
    } catch (error: any) {
        console.error('Error deleting designation:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to delete designation';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
