import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const updateSchema = yup.object({
    employee_id: yup.string().optional(),
    reimbursement_type_id: yup.string().optional(),
    amount: yup.number().typeError('Amount must be a number').positive('Amount must be positive').optional(),
    description: yup.string().nullable().optional(),
    expense_date: yup.date().typeError('Invalid date format').optional(),
    status: yup.string().oneOf(['PENDING', 'APPROVED', 'REJECTED', 'PAID'], 'Invalid status').optional(),
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

            const reimbursementRequest = await prisma.reimbursementRequest.findFirst({
                where: { id, company_id },
                include: {
                    employee: {
                        select: { id: true, name: true, employee_code: true },
                    },
                    reimbursementType: {
                        select: { id: true, name: true },
                    },
                    attachments: true,
                },
            });

            if (!reimbursementRequest) {
                return NextResponse.json(
                    errorResponse('Reimbursement request not found'),
                    { status: 404 }
                );
            }

            return NextResponse.json(
                successResponse('Reimbursement request fetched successfully', reimbursementRequest)
            );
        });
    } catch (error: any) {
        console.error('Error fetching reimbursement request:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch reimbursement request'), { status: 500 });
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

            const existing = await prisma.reimbursementRequest.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Reimbursement request not found'),
                    { status: 404 }
                );
            }

            if (validated.status && validated.status !== existing.status) {
                const validTransitions: Record<string, string[]> = {
                    PENDING: ['APPROVED', 'REJECTED'],
                    APPROVED: ['PAID', 'REJECTED'],
                    REJECTED: ['PENDING'],
                    PAID: [],
                };

                const allowed = validTransitions[existing.status] || [];
                if (!allowed.includes(validated.status)) {
                    return NextResponse.json(
                        errorResponse(`Cannot change status from ${existing.status} to ${validated.status}`),
                        { status: 400 }
                    );
                }

                if (validated.status === 'APPROVED' || validated.status === 'REJECTED') {
                    validated.approved_by = (session?.user as any)?.id || null;
                }

                if (validated.status === 'PAID') {
                    validated.approved_by = validated.approved_by || existing.approved_by;
                }
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

            if (validated.reimbursement_type_id) {
                const rt = await prisma.reimbursementType.findFirst({
                    where: { id: validated.reimbursement_type_id, company_id },
                });
                if (!rt) {
                    return NextResponse.json(
                        errorResponse('Selected reimbursement type does not exist'),
                        { status: 400 }
                    );
                }
            }

            const updateData: any = {};
            if (validated.employee_id !== undefined) updateData.employee_id = validated.employee_id;
            if (validated.reimbursement_type_id !== undefined) updateData.reimbursement_type_id = validated.reimbursement_type_id;
            if (validated.amount !== undefined) updateData.amount = validated.amount;
            if (validated.description !== undefined) updateData.description = validated.description;
            if (validated.expense_date !== undefined) updateData.expense_date = validated.expense_date;
            if (validated.status !== undefined) updateData.status = validated.status;
            if (validated.approved_by !== undefined) updateData.approved_by = validated.approved_by;
            if (validated.remarks !== undefined) updateData.remarks = validated.remarks;

            if (validated.status === 'APPROVED') {
                updateData.approved_at = new Date();
            }

            if (validated.status === 'PAID') {
                updateData.paid_date = new Date();
            }

            const reimbursementRequest = await prisma.reimbursementRequest.update({
                where: { id },
                data: updateData,
                include: {
                    employee: {
                        select: { id: true, name: true, employee_code: true },
                    },
                    reimbursementType: {
                        select: { id: true, name: true },
                    },
                },
            });

            await createNotification({
                action: 'Updated',
                entity: 'ReimbursementRequest',
                entityId: reimbursementRequest.id,
                entityName: `Reimbursement request`,
                userId: (session?.user as any)?.id,
                link: `/hr/reimbursement-requests`,
            });

            return NextResponse.json(
                successResponse('Reimbursement request updated successfully', reimbursementRequest)
            );
        });
    } catch (error: any) {
        console.error('Error updating reimbursement request:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to update reimbursement request';
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

            const existing = await prisma.reimbursementRequest.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Reimbursement request not found'),
                    { status: 404 }
                );
            }

            await prisma.reimbursementRequest.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'ReimbursementRequest',
                entityId: id,
                entityName: `Reimbursement request`,
                userId: (session?.user as any)?.id,
                link: `/hr/reimbursement-requests`,
            });

            return NextResponse.json(
                successResponse('Reimbursement request deleted successfully')
            );
        });
    } catch (error: any) {
        console.error('Error deleting reimbursement request:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to delete reimbursement request';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
