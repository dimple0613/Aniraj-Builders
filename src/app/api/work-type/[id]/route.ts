import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { createNotification } from '@/lib/notification-service';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const updateWorkTypeSchema = yup.object({
    name: yup.string().required('Name is required').max(100, 'Name must be less than 100 characters').optional(),
    is_active: yup.boolean().optional(),
});

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const workType = await prisma.workType.findFirst({
                where: { id },
                select: {
                    id: true,
                    name: true,
                    is_active: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });

            if (!workType) {
                return NextResponse.json(errorResponse('Work type not found'), { status: 404 });
            }

            return NextResponse.json(successResponse('Work type fetched successfully', workType));
        });
    } catch (error) {
        console.error('Error fetching work type:', error);
        return NextResponse.json(errorResponse('Failed to fetch work type'), { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const body = await request.json();

        const validation = await updateWorkTypeSchema.validate(body, { abortEarly: false })
            .catch(err => {
                const errorMessages = err.inner
                    .map((issue: any) => `${issue.path}: ${issue.message}`)
                    .join('; ');
                throw new Error(errorMessages);
            });

        const { name, is_active } = validation;

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existingWorkType = await prisma.workType.findFirst({
                where: { id },
            });

            if (!existingWorkType) {
                return NextResponse.json(errorResponse('Work type not found'), { status: 404 });
            }

            if (name && name !== existingWorkType.name) {
                const duplicateWorkType = await prisma.workType.findFirst({
                    where: {
                        name: { equals: name, mode: 'insensitive' },
                        id: { not: id },
                    },
                });

                if (duplicateWorkType) {
                    return NextResponse.json(
                        errorResponse('Work type with this name already exists'),
                        { status: 409 }
                    );
                }
            }

            const updatedWorkType = await prisma.workType.update({
                where: { id },
                data: {
                    ...(name && { name }),
                    ...(is_active !== undefined && { is_active }),
                },
                select: {
                    id: true,
                    name: true,
                    is_active: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });

            // Create notification for Work Type
            const session = await getServerSession(authOptions);
            await createNotification({
                action: 'Updated',
                entity: 'Work Type',
                entityId: id,
                entityName: updatedWorkType.name,
                userId: (session?.user as any)?.id,
                link: `/maintenance-sor`,
            });

            return NextResponse.json(successResponse('Work type updated successfully', updatedWorkType));
        });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json(
                errorResponse('Work type with this name already exists'),
                { status: 409 }
            );
        }
        console.error('Error updating work type:', error);
        const message = error?.message || 'Failed to update work type';
        const isValidationError = message.includes(':');
        return NextResponse.json(errorResponse(message), { status: isValidationError ? 400 : 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const { searchParams } = new URL(request.url);
        const permanent = searchParams.get('permanent') === 'true';

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existingWorkType = await prisma.workType.findFirst({
                where: { id },
            });

            if (!existingWorkType) {
                return NextResponse.json(errorResponse('Work type not found'), { status: 404 });
            }

            if (permanent) {
                const usageCount = await prisma.itemWorkTypePrice.count({
                    where: { work_type_id: id },
                });

                if (usageCount > 0) {
                    return NextResponse.json(
                        errorResponse(`Cannot delete work type. It is used in ${usageCount} item price configurations.`),
                        { status: 409 }
                    );
                }

                await prisma.workType.delete({
                    where: { id },
                });

                return NextResponse.json(successResponse('Work type permanently deleted'));
            }

            await prisma.workType.update({
                where: { id },
                data: { deletedAt: new Date(), is_active: false },
            });

            // Create notification for Work Type
            const session = await getServerSession(authOptions);
            await createNotification({
                action: 'Deleted',
                entity: 'Work Type',
                entityId: id,
                entityName: existingWorkType.name,
                userId: (session?.user as any)?.id,
                link: `/maintenance-sor`,
            });

            return NextResponse.json(successResponse('Work type deleted successfully'));
        });
    } catch (error) {
        console.error('Error deleting work type:', error);
        return NextResponse.json(errorResponse('Failed to delete work type'), { status: 500 });
    }
}
