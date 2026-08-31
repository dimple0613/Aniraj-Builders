import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';
import { parseDateOnly } from '@/lib/date-utils';

const TITLE_MAX = 200;

const updateAnnouncementSchema = yup.object({
    title: yup.string().max(TITLE_MAX, `Title must not exceed ${TITLE_MAX} characters`).optional(),
    description: yup.string().nullable().optional(),
    publish_date: yup.string().nullable().optional(),
    expiry_date: yup.string().nullable().optional(),
    priority: yup.string().oneOf(['LOW', 'MEDIUM', 'HIGH', 'NORMAL']).optional(),
    status: yup.string().oneOf(['ACTIVE', 'ARCHIVED', 'DRAFT']).optional(),
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

            const announcement = await prisma.announcement.findFirst({
                where: { id, company_id },
            });

            if (!announcement) {
                return NextResponse.json(
                    errorResponse('Announcement not found'),
                    { status: 404 }
                );
            }

            return NextResponse.json(
                successResponse('Announcement fetched successfully', announcement)
            );
        });
    } catch (error: any) {
        console.error('Error fetching announcement:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch announcement'), { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        let validated: yup.InferType<typeof updateAnnouncementSchema>;
        try {
            validated = await updateAnnouncementSchema.validate(body, { abortEarly: false });
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

            const existing = await prisma.announcement.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Announcement not found'),
                    { status: 404 }
                );
            }

            const announcement = await prisma.announcement.update({
                where: { id },
                data: {
                    ...(validated.title !== undefined && { title: validated.title }),
                    ...(validated.description !== undefined && { description: validated.description }),
                    ...(validated.publish_date !== undefined && { publish_date: validated.publish_date ? parseDateOnly(validated.publish_date) : null }),
                    ...(validated.expiry_date !== undefined && { expiry_date: validated.expiry_date ? parseDateOnly(validated.expiry_date) : null }),
                    ...(validated.priority !== undefined && { priority: validated.priority }),
                    ...(validated.status !== undefined && { status: validated.status }),
                },
            });

            await createNotification({
                action: 'Updated',
                entity: 'Announcement',
                entityId: announcement.id,
                entityName: announcement.title,
                userId: (session?.user as any)?.id,
                link: `/hr/announcements`,
            });

            return NextResponse.json(
                successResponse('Announcement updated successfully', announcement)
            );
        });
    } catch (error: any) {
        console.error('Error updating announcement:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to update announcement'), { status: 500 });
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

            const existing = await prisma.announcement.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Announcement not found'),
                    { status: 404 }
                );
            }

            if (existing.status !== 'DRAFT') {
                return NextResponse.json(
                    errorResponse('Only draft announcements can be deleted'),
                    { status: 400 }
                );
            }

            await prisma.announcement.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'Announcement',
                entityId: id,
                entityName: existing.title,
                userId: (session?.user as any)?.id,
                link: `/hr/announcements`,
            });

            return NextResponse.json(
                successResponse('Announcement deleted successfully')
            );
        });
    } catch (error: any) {
        console.error('Error deleting announcement:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to delete announcement'), { status: 500 });
    }
}
