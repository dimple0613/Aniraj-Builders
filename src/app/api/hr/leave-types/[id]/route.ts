import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const NAME_MAX = 100;

const updateLeaveTypeSchema = yup.object({
    name: yup.string().max(NAME_MAX, `Leave type name must not exceed ${NAME_MAX} characters`).optional(),
    days: yup.number().integer().min(0).optional(),
    carry_forward: yup.boolean().optional(),
});

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        return await withCompany(async (company) => {
            const leaveType = await prisma.leaveType.findFirst({
                where: { id },
            });

            if (!leaveType) {
                return NextResponse.json(
                    errorResponse('Leave type not found'),
                    { status: 404 }
                );
            }

            return NextResponse.json(
                successResponse('Leave type fetched successfully', leaveType)
            );
        });
    } catch (error: any) {
        console.error('Error fetching leave type:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch leave type'), { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        let validated: yup.InferType<typeof updateLeaveTypeSchema>;
        try {
            validated = await updateLeaveTypeSchema.validate(body, { abortEarly: false });
        } catch (err: any) {
            const errorMessages = err.inner
                .map((issue: any) => `${issue.path}: ${issue.message}`)
                .join('; ');
            return NextResponse.json(errorResponse(errorMessages), { status: 400 });
        }

        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const existing = await prisma.leaveType.findFirst({
                where: { id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Leave type not found'),
                    { status: 404 }
                );
            }

            if (validated.name && validated.name.toLowerCase() !== existing.name.toLowerCase()) {
                const duplicate = await prisma.leaveType.findFirst({
                    where: {
                        name: { equals: validated.name, mode: 'insensitive' },
                        id: { not: id },
                    },
                });
                if (duplicate) {
                    return NextResponse.json(
                        errorResponse('Leave type with this name already exists'),
                        { status: 409 }
                    );
                }
            }

            const leaveType = await prisma.leaveType.update({
                where: { id },
                data: {
                    ...(validated.name !== undefined && { name: validated.name }),
                    ...(validated.days !== undefined && { days: validated.days }),
                    ...(validated.carry_forward !== undefined && { carry_forward: validated.carry_forward }),
                },
            });

            await createNotification({
                action: 'Updated',
                entity: 'LeaveType',
                entityId: leaveType.id,
                entityName: leaveType.name,
                userId: (session?.user as any)?.id,
                link: `/hr/leave-types`,
            });

            return NextResponse.json(
                successResponse('Leave type updated successfully', leaveType)
            );
        });
    } catch (error: any) {
        console.error('Error updating leave type:', error);
        if (error.code === 'P2002') {
            return NextResponse.json(
                errorResponse('Leave type with this name already exists'),
                { status: 409 }
            );
        }
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to update leave type'), { status: 500 });
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
            const existing = await prisma.leaveType.findFirst({
                where: { id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Leave type not found'),
                    { status: 404 }
                );
            }

            const leaveRequestCount = await prisma.leaveRequest.count({
                where: { leave_type_id: id },
            });

            if (leaveRequestCount > 0) {
                return NextResponse.json(
                    errorResponse(`Cannot delete leave type. ${leaveRequestCount} leave request(s) are using this leave type.`),
                    { status: 409 }
                );
            }

            await prisma.leaveType.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'LeaveType',
                entityId: id,
                entityName: existing.name,
                userId: (session?.user as any)?.id,
                link: `/hr/leave-types`,
            });

            return NextResponse.json(
                successResponse('Leave type deleted successfully')
            );
        });
    } catch (error: any) {
        console.error('Error deleting leave type:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to delete leave type'), { status: 500 });
    }
}
