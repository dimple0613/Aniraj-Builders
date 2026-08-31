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

const updateHolidaySchema = yup.object({
    title: yup.string().max(TITLE_MAX, `Title must not exceed ${TITLE_MAX} characters`).optional(),
    date: yup.string().optional(),
    type: yup.string().oneOf(['PUBLIC', 'OBSERVANCE', 'OPTIONAL']).optional(),
    description: yup.string().nullable().optional(),
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

            const holiday = await prisma.holiday.findFirst({
                where: { id, company_id },
            });

            if (!holiday) {
                return NextResponse.json(
                    errorResponse('Holiday not found'),
                    { status: 404 }
                );
            }

            return NextResponse.json(
                successResponse('Holiday fetched successfully', holiday)
            );
        });
    } catch (error: any) {
        console.error('Error fetching holiday:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch holiday'), { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        let validated: yup.InferType<typeof updateHolidaySchema>;
        try {
            validated = await updateHolidaySchema.validate(body, { abortEarly: false });
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

            const existing = await prisma.holiday.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Holiday not found'),
                    { status: 404 }
                );
            }

            if (validated.title || validated.date) {
                const title = validated.title || existing.title;
                const date = validated.date ? parseDateOnly(validated.date) : existing.date;

                if (validated.date && isNaN(date.getTime())) {
                    return NextResponse.json(
                        errorResponse('Invalid date format'),
                        { status: 400 }
                    );
                }

                const duplicate = await prisma.holiday.findFirst({
                    where: {
                        title: { equals: title, mode: 'insensitive' },
                        date: date,
                        company_id,
                        id: { not: id },
                    },
                });
                if (duplicate) {
                    return NextResponse.json(
                        errorResponse('Holiday with this title and date already exists'),
                        { status: 409 }
                    );
                }
            }

            const updateData: any = {};
            if (validated.title !== undefined) updateData.title = validated.title;
            if (validated.date !== undefined) updateData.date = parseDateOnly(validated.date);
            if (validated.type !== undefined) updateData.type = validated.type;
            if (validated.description !== undefined) updateData.description = validated.description;

            const holiday = await prisma.holiday.update({
                where: { id },
                data: updateData,
            });

            await createNotification({
                action: 'Updated',
                entity: 'Holiday',
                entityId: holiday.id,
                entityName: holiday.title,
                userId: (session?.user as any)?.id,
                link: `/hr/holidays`,
            });

            return NextResponse.json(
                successResponse('Holiday updated successfully', holiday)
            );
        });
    } catch (error: any) {
        console.error('Error updating holiday:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to update holiday'), { status: 500 });
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

            const existing = await prisma.holiday.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Holiday not found'),
                    { status: 404 }
                );
            }

            await prisma.holiday.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'Holiday',
                entityId: id,
                entityName: existing.title,
                userId: (session?.user as any)?.id,
                link: `/hr/holidays`,
            });

            return NextResponse.json(
                successResponse('Holiday deleted successfully')
            );
        });
    } catch (error: any) {
        console.error('Error deleting holiday:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to delete holiday'), { status: 500 });
    }
}
