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
    description: yup.string().nullable().optional(),
    is_active: yup.boolean().optional(),
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

            const reimbursementType = await prisma.reimbursementType.findFirst({
                where: { id, company_id },
                include: {
                    _count: {
                        select: { reimbursementRequests: true },
                    },
                },
            });

            if (!reimbursementType) {
                return NextResponse.json(
                    errorResponse('Reimbursement type not found'),
                    { status: 404 }
                );
            }

            return NextResponse.json(
                successResponse('Reimbursement type fetched successfully', reimbursementType)
            );
        });
    } catch (error: any) {
        console.error('Error fetching reimbursement type:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch reimbursement type'), { status: 500 });
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

            const existing = await prisma.reimbursementType.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Reimbursement type not found'),
                    { status: 404 }
                );
            }

            const updateData: any = {};
            if (validated.name !== undefined) updateData.name = validated.name;
            if (validated.description !== undefined) updateData.description = validated.description;
            if (validated.is_active !== undefined) updateData.is_active = validated.is_active;

            const reimbursementType = await prisma.reimbursementType.update({
                where: { id },
                data: updateData,
            });

            await createNotification({
                action: 'Updated',
                entity: 'ReimbursementType',
                entityId: reimbursementType.id,
                entityName: reimbursementType.name,
                userId: (session?.user as any)?.id,
                link: `/hr/reimbursement-types`,
            });

            return NextResponse.json(
                successResponse('Reimbursement type updated successfully', reimbursementType)
            );
        });
    } catch (error: any) {
        console.error('Error updating reimbursement type:', error);
        if (error.code === 'P2002') {
            return NextResponse.json(
                errorResponse('Reimbursement type with this name already exists'),
                { status: 409 }
            );
        }
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to update reimbursement type';
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

            const existing = await prisma.reimbursementType.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Reimbursement type not found'),
                    { status: 404 }
                );
            }

            await prisma.reimbursementType.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'ReimbursementType',
                entityId: id,
                entityName: existing.name,
                userId: (session?.user as any)?.id,
                link: `/hr/reimbursement-types`,
            });

            return NextResponse.json(
                successResponse('Reimbursement type deleted successfully')
            );
        });
    } catch (error: any) {
        console.error('Error deleting reimbursement type:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to delete reimbursement type';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
