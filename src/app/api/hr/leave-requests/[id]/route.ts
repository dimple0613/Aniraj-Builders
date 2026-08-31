import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';
import { parseDateOnly } from '@/lib/date-utils';

const updateLeaveRequestSchema = yup.object({
    employee_id: yup.string().optional(),
    leave_type_id: yup.string().optional(),
    from_date: yup.string().optional(),
    to_date: yup.string().optional(),
    reason: yup.string().nullable().optional(),
    status: yup.string().oneOf(['PENDING', 'APPROVED', 'REJECTED']).optional(),
    approved_by: yup.string().nullable().optional(),
    remarks: yup.string().nullable().optional(),
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

            const leaveRequest = await prisma.leaveRequest.findFirst({
                where: { id, company_id },
                include: {
                    employee: {
                        select: { id: true, name: true, employee_code: true },
                    },
                    leaveType: {
                        select: { id: true, name: true, days: true },
                    },
                },
            });

            if (!leaveRequest) {
                return NextResponse.json(
                    errorResponse('Leave request not found'),
                    { status: 404 }
                );
            }

            return NextResponse.json(
                successResponse('Leave request fetched successfully', leaveRequest)
            );
        });
    } catch (error: any) {
        console.error('Error fetching leave request:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch leave request'), { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        let validated: yup.InferType<typeof updateLeaveRequestSchema>;
        try {
            validated = await updateLeaveRequestSchema.validate(body, { abortEarly: false });
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

            const existing = await prisma.leaveRequest.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Leave request not found'),
                    { status: 404 }
                );
            }

            if (existing.status !== 'PENDING') {
                return NextResponse.json(
                    errorResponse('Only pending leave requests can be updated'),
                    { status: 400 }
                );
            }

            if (validated.employee_id) {
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

            if (validated.leave_type_id) {
                const leaveType = await prisma.leaveType.findFirst({
                    where: { id: validated.leave_type_id, company_id },
                });
                if (!leaveType) {
                    return NextResponse.json(
                        errorResponse('Selected leave type does not exist'),
                        { status: 400 }
                    );
                }
            }

            const updateData: any = {};
            if (validated.employee_id !== undefined) updateData.employee_id = validated.employee_id;
            if (validated.leave_type_id !== undefined) updateData.leave_type_id = validated.leave_type_id;
            if (validated.from_date !== undefined) updateData.from_date = parseDateOnly(validated.from_date);
            if (validated.to_date !== undefined) updateData.to_date = parseDateOnly(validated.to_date);
            if (validated.reason !== undefined) updateData.reason = validated.reason;
            if (validated.status !== undefined) updateData.status = validated.status;
            if (validated.approved_by !== undefined) updateData.approved_by = validated.approved_by;
            if (validated.remarks !== undefined) updateData.remarks = validated.remarks;

            const leaveRequest = await prisma.leaveRequest.update({
                where: { id },
                data: updateData,
            });

            await createNotification({
                action: 'Updated',
                entity: 'LeaveRequest',
                entityId: leaveRequest.id,
                entityName: `Leave request`,
                userId: (session?.user as any)?.id,
                link: `/hr/leave-requests`,
            });

            return NextResponse.json(
                successResponse('Leave request updated successfully', leaveRequest)
            );
        });
    } catch (error: any) {
        console.error('Error updating leave request:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to update leave request'), { status: 500 });
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

            const existing = await prisma.leaveRequest.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Leave request not found'),
                    { status: 404 }
                );
            }

            await prisma.leaveRequest.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'LeaveRequest',
                entityId: id,
                entityName: `Leave request`,
                userId: (session?.user as any)?.id,
                link: `/hr/leave-requests`,
            });

            return NextResponse.json(
                successResponse('Leave request deleted successfully')
            );
        });
    } catch (error: any) {
        console.error('Error deleting leave request:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to delete leave request'), { status: 500 });
    }
}
