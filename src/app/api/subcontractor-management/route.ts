import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const createSubcontractorSchema = yup.object({
    name: yup.string().required('Name is required').max(255, 'Name must be less than 255 characters'),
    rate: yup.number().required('Rate is required').positive('Rate must be greater than 0'),
    unit_id: yup.string().nullable().optional(),
});

const updateSubcontractorSchema = yup.object({
    id: yup.string().uuid('Invalid ID format').required('ID is required'),
    name: yup.string().min(1).optional(),
    updateRate: yup.boolean().optional(),
    newRate: yup.number().when('updateRate', {
        is: true,
        then: (schema) => schema.required('New rate is required when updating rate').positive('New rate must be greater than 0'),
        otherwise: (schema) => schema.notRequired(),
    }),
    unit_id: yup.string().nullable().optional(),
});

type CreateSubcontractorInput = yup.InferType<typeof createSubcontractorSchema>;
type UpdateSubcontractorInput = yup.InferType<typeof updateSubcontractorSchema>;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search')?.trim() || '';
        const sortField = searchParams.get('sortField') || 'name';
        const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc';

        const where: any = {};

        if (search) {
            where.name = { contains: search, mode: 'insensitive' };
        }

        const orderBy: any = {};
        if (['name', 'createdAt'].includes(sortField)) {
            orderBy[sortField] = sortOrder;
        } else {
            orderBy.name = sortOrder;
        }

        const [data, total] = await withCompany(async () => {
            const subcontractors = await prisma.subcontractor.findMany({
                where,
                include: {
                    rates: {
                        select: {
                            id: true,
                            rate: true,
                            start_date: true,
                            expiry_date: true,
                        },
                        orderBy: { start_date: 'desc' },
                    },
                    unit: {
                        select: {
                            id: true,
                            unit_name: true,
                        },
                    },
                },
                orderBy,
                skip: (page - 1) * limit,
                take: limit,
            });

            const formattedData = subcontractors.map((sub: any) => {
                const rateHistory = sub.rates || [];
                const currentRate = rateHistory.find((r: any) => r.expiry_date === null);

                return {
                    ...sub,
                    currentRate: currentRate?.rate?.toString() || '0',
                    rates: rateHistory,
                };
            });

            const totalCount = await prisma.subcontractor.count({ where });

            return [formattedData, totalCount];
        });

        return NextResponse.json(
            successResponse('Subcontractors fetched successfully', data, {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            })
        );
    } catch (error) {
        console.error('Error fetching subcontractors:', error);
        return NextResponse.json(
            errorResponse('Failed to fetch subcontractors'),
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const validation = await createSubcontractorSchema.validate(body, { abortEarly: false })
            .catch(err => {
                const errorMessages = err.inner
                    .map((issue: any) => `${issue.path}: ${issue.message}`)
                    .join('; ');
                throw new Error(errorMessages);
            });

        const { name, rate, unit_id } = validation as CreateSubcontractorInput;

        const response = await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existingSubcontractor = await prisma.subcontractor.findFirst({
                where: {
                    company_id,
                    name: { equals: name.trim(), mode: 'insensitive' },
                },
            });

            if (existingSubcontractor) {
                return NextResponse.json(
                    errorResponse('A subcontractor with this name already exists'),
                    { status: 409 }
                );
            }

            const newSubcontractor: any = await prisma.$transaction(async (tx) => {
                const created = await tx.subcontractor.create({
                    data: {
                        name: name.trim(),
                        company_id,
                        unit_id: unit_id || null,
                    },
                });

                await tx.subcontractorRate.create({
                    data: {
                        subcontractor_id: created.id,
                        company_id,
                        rate: new Prisma.Decimal(rate),
                        start_date: new Date(),
                        expiry_date: null,
                    },
                });

                return tx.subcontractor.findUnique({
                    where: { id: created.id },
                    include: {
                        rates: {
                            select: {
                                id: true,
                                rate: true,
                                start_date: true,
                                expiry_date: true,
                            },
                            orderBy: { start_date: 'desc' },
                        },
                    },
                });
            });

            const rateHistory = newSubcontractor.rates || [];
            const currentRate = rateHistory.find((r: any) => r.expiry_date === null);

            const session = await getServerSession(authOptions);
            await createNotification({
                action: 'Created',
                entity: 'Subcontractor',
                entityId: newSubcontractor.id,
                entityName: newSubcontractor.name,
                userId: (session?.user as any)?.id,
                link: `/subcontractor`,
            });

            return NextResponse.json(
                successResponse('Subcontractor created successfully', {
                    ...newSubcontractor,
                    currentRate: currentRate?.rate?.toString() || '0',
                    rates: rateHistory,
                }),
                { status: 201 }
            );
        });

        if (!response) {
            return NextResponse.json(errorResponse('Unexpected server error'), { status: 500 });
        }

        return response;

    } catch (error: any) {
        console.error('Error creating subcontractor:', error);
        const message = error?.message || 'Failed to create subcontractor';
        const isValidationError = message.includes(':');

        return NextResponse.json(
            errorResponse(message),
            { status: isValidationError ? 400 : 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        const validation = await updateSubcontractorSchema.validate(body, { abortEarly: false })
            .catch(err => {
                const errorMessages = err.inner
                    .map((issue: any) => `${issue.path}: ${issue.message}`)
                    .join('; ');
                throw new Error(errorMessages);
            });

        const { id, name, updateRate, newRate, unit_id } = validation as UpdateSubcontractorInput;

        if (!id) {
            return NextResponse.json(errorResponse('Subcontractor ID is required'), { status: 400 });
        }

        const response = await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existingSubcontractor = await prisma.subcontractor.findFirst({
                where: { id },
            });

            if (!existingSubcontractor) {
                return NextResponse.json(errorResponse('Subcontractor not found'), { status: 404 });
            }

            if (name && name !== existingSubcontractor.name) {
                const duplicateSubcontractor = await prisma.subcontractor.findFirst({
                    where: {
                        name: { equals: name.trim(), mode: 'insensitive' },
                        id: { not: id },
                    },
                });

                if (duplicateSubcontractor) {
                    return NextResponse.json(
                        errorResponse('A subcontractor with this name already exists'),
                        { status: 409 }
                    );
                }
            }

            const updatedSubcontractor: any = await prisma.$transaction(async (tx) => {
                const updateData: any = {};
                if (name !== undefined) updateData.name = name.trim();
                if (unit_id !== undefined) updateData.unit_id = unit_id || null;

                await tx.subcontractor.update({
                    where: { id },
                    data: updateData,
                });

                if (updateRate && newRate !== undefined && newRate !== null) {
                    await tx.subcontractorRate.updateMany({
                        where: {
                            subcontractor_id: id,
                            expiry_date: null,
                        },
                        data: {
                            expiry_date: new Date(),
                        },
                    });

                    await tx.subcontractorRate.create({
                        data: {
                            subcontractor_id: id,
                            company_id,
                            rate: new Prisma.Decimal(newRate),
                            start_date: new Date(),
                            expiry_date: null,
                        },
                    });
                }

                return tx.subcontractor.findUnique({
                    where: { id },
                    include: {
                        rates: {
                            select: {
                                id: true,
                                rate: true,
                                start_date: true,
                                expiry_date: true,
                            },
                            orderBy: { start_date: 'desc' },
                        },
                    },
                });
            });

            const rateHistory = updatedSubcontractor.rates || [];
            const currentRate = rateHistory.find((r: any) => r.expiry_date === null);

            const session = await getServerSession(authOptions);
            await createNotification({
                action: 'Updated',
                entity: 'Subcontractor',
                entityId: id,
                entityName: updatedSubcontractor.name || id,
                userId: (session?.user as any)?.id,
                link: `/subcontractor`,
            });

            return NextResponse.json(
                successResponse('Subcontractor updated successfully', {
                    ...updatedSubcontractor,
                    currentRate: currentRate?.rate?.toString() || '0',
                    rates: rateHistory,
                })
            );
        });

        if (!response) {
            return NextResponse.json(errorResponse('Unexpected server error'), { status: 500 });
        }

        return response;

    } catch (error: any) {
        console.error('Error updating subcontractor:', error);
        const message = error?.message || 'Failed to update subcontractor';
        const isValidationError = message.includes(':');

        return NextResponse.json(
            errorResponse(message),
            { status: isValidationError ? 400 : 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const body = await request.json();
        const { id } = body;

        if (!id) {
            return NextResponse.json(errorResponse('Subcontractor ID is required'), { status: 400 });
        }

        const response = await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existingSubcontractor = await prisma.subcontractor.findFirst({
                where: { id },
            });

            if (!existingSubcontractor) {
                return NextResponse.json(errorResponse('Subcontractor not found'), { status: 404 });
            }

            const capitalSORCount = await prisma.capitalSOR.count({
                where: {
                    subcontractor_id: id,
                    is_subcontractor: true,
                },
            });

            if (capitalSORCount > 0) {
                return NextResponse.json(
                    errorResponse(`Cannot delete subcontractor. It is used in ${capitalSORCount} Item Master item(s).`),
                    { status: 409 }
                );
            }

            await prisma.$transaction(async (tx) => {
                await tx.subcontractorRate.deleteMany({
                    where: { subcontractor_id: id },
                });

                await tx.subcontractor.delete({
                    where: { id },
                });
            });

            const session = await getServerSession(authOptions);
            await createNotification({
                action: 'Deleted',
                entity: 'Subcontractor',
                entityId: id,
                entityName: existingSubcontractor.name || id,
                userId: (session?.user as any)?.id,
                link: `/subcontractor`,
            });

            return NextResponse.json(successResponse('Subcontractor deleted successfully'));
        });

        if (!response) {
            return NextResponse.json(errorResponse('Unexpected server error'), { status: 500 });
        }

        return response;

    } catch (error: any) {
        console.error('Error deleting subcontractor:', error);
        if (error.code === 'P2003') {
            return NextResponse.json(
                errorResponse('Cannot delete subcontractor that is in use'),
                { status: 400 }
            );
        }
        return NextResponse.json(errorResponse('Failed to delete subcontractor'), { status: 500 });
    }
}
