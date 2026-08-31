import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { createNotification } from '@/lib/notification-service';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const FIELD_LABELS: Record<string, string> = {
    item_name: 'Item Name',
    unit_id: 'Unit',
    ay_id: 'Financial Year',
    group_id: 'Group',
    work_type: 'Work Type',
    is_active: 'Active Status',
    workTypePrices: 'Work Type Prices',
    work_type_id: 'Work Type',
    price: 'Price',
    add_new: 'Add New',
    searchPreferences: 'Search Preferences',
};

function formatValidationErrors(err: any): string {
    return err.inner
        .map((issue: any) => {
            const label = FIELD_LABELS[issue.path] || issue.path;
            let message = issue.message;
            if (message.includes('cannot be null') || message.includes('is a required field')) {
                message = `${label} is required`;
            } else {
                message = message.replace(issue.path, label);
            }
            return message;
        })
        .join('; ');
}

class ValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ValidationError';
    }
}

const MAX_PRICE = 999999999999999;
const updateItemSchema = yup.object({
    item_name: yup.string().min(1).optional(),
    unit_id: yup.string().min(1).optional(),
    ay_id: yup.string().required('Item number is required'),
    group_id: yup.string().nullable().optional(),
    work_type: yup.boolean().optional(),
    is_active: yup.boolean().optional(),
    workTypePrices: yup.array(yup.object({
        work_type_id: yup.string().required(),
        price: yup.number().min(0, 'Price must be 0 or greater').max(MAX_PRICE, `Price must be less than ${MAX_PRICE.toLocaleString()}`).required(),
        add_new: yup.boolean(),
        update_all_vardhis: yup.boolean().default(false),
    })).optional(),
    searchPreferences: yup.array(yup.string()).optional(),
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

            const item = await prisma.itemManagement.findUnique({
                where: { id },
                include: {
                    unit: { select: { id: true, unit_name: true } },
                    ay: { select: { id: true, ay_no: true } },
                    workTypePrices: {
                        select: {
                            id: true,
                            work_type_id: true,
                            price: true,
                            start_date: true,
                            expiry_date: true,
                            createdAt: true,
                        },
                        orderBy: { start_date: 'desc' },
                    },
                    searchPreferences: { select: { id: true, value: true } },
                },
            });

            if (!item) {
                return NextResponse.json(errorResponse('Item not found'), { status: 404 });
            }

            return NextResponse.json(successResponse('Item fetched successfully', item));
        });
    } catch (error) {
        console.error('Error fetching item master:', error);
        return NextResponse.json(errorResponse('Failed to fetch item master'), { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const body = await request.json();

        const updateAllVardhisFlags: Record<string, boolean> = {};
        if (body.workTypePrices && Array.isArray(body.workTypePrices)) {
            for (const wtp of body.workTypePrices) {
                if (wtp.work_type_id && wtp.update_all_vardhis) {
                    updateAllVardhisFlags[wtp.work_type_id] = true;
                }
            }
        } 
        const validation = await updateItemSchema.validate(body, { abortEarly: false, stripUnknown: false })
            .catch(err => {
                throw new ValidationError(formatValidationErrors(err));
            });

        const { item_name, unit_id, ay_id, group_id, work_type, is_active, workTypePrices, searchPreferences } = validation;

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existingItem = await prisma.itemManagement.findUnique({
                where: { id },
                select: { company_id: true }
            });

            if (!existingItem) {
                return NextResponse.json(errorResponse('Item not found'), { status: 404 });
            }

            if (item_name) {
                const trimmedItemName = item_name.trim();
                const duplicateItem = await prisma.itemManagement.findFirst({
                    where: {
                        item_name: { equals: trimmedItemName, mode: 'insensitive' },
                        id: { not: id },
                    },
                });

                if (duplicateItem) {
                    return NextResponse.json(errorResponse('An item with this name already exists'), { status: 409 });
                }
            }

            const updatedItem = await prisma.$transaction(async (tx) => {
                const updateData: any = {};
                if (item_name) updateData.item_name = item_name.trim();
                if (unit_id) updateData.unit_id = unit_id;
                updateData.ay_id = ay_id;
                if (group_id !== undefined) updateData.group_id = group_id || null;
                if (work_type !== undefined) updateData.work_type = work_type;
                if (is_active !== undefined) updateData.is_active = is_active;

                await tx.itemManagement.update({ where: { id }, data: updateData });

                if (workTypePrices !== undefined) {
                    const currentDate = new Date();

                    for (const wtp of workTypePrices) {
                        const existingActivePrice = await tx.itemWorkTypePrice.findFirst({
                            where: {
                                item_id: id,
                                work_type_id: wtp.work_type_id,
                                expiry_date: null,
                            },
                        });
                        if (wtp.add_new) {
                            if (existingActivePrice) {
                                await tx.itemWorkTypePrice.update({
                                    where: { id: existingActivePrice.id },
                                    data: {
                                        expiry_date: currentDate,
                                    },
                                });
                            }

                            await tx.itemWorkTypePrice.create({
                                data: {
                                    company_id,
                                    item_id: id,
                                    work_type_id: wtp.work_type_id,
                                    price: wtp.price,
                                    start_date: currentDate,
                                    expiry_date: null,
                                },
                            });

                            if (updateAllVardhisFlags[wtp.work_type_id]) {
                                const matchingVardhis = await tx.vardhi.findMany({
                                    where: {
                                        company_id,
                                        work_type: wtp.work_type_id,
                                    },
                                    select: { id: true },
                                });
                                if (matchingVardhis.length > 0) {
                                    const vardhiIds = matchingVardhis.map(v => v.id);

                                    const affectedItems = await tx.vardhiItem.findMany({
                                        where: {
                                            item_id: id,
                                            vardhi_id: { in: vardhiIds },
                                        },
                                        select: { id: true, qty: true },
                                    });

                                    for (const vi of affectedItems) {
                                        const amount = Number(vi.qty) * wtp.price;
                                        await tx.vardhiItem.update({
                                            where: { id: vi.id },
                                            data: { rate: wtp.price, amount },
                                        });
                                    }

                                    const affectedAdditionalItems = await tx.vardhiAdditionalItem.findMany({
                                        where: {
                                            item_id: id,
                                            vardhi_id: { in: vardhiIds },
                                        },
                                        select: { id: true, qty: true },
                                    });

                                    for (const vai of affectedAdditionalItems) {
                                        const amount = Number(vai.qty) * wtp.price;
                                        await tx.vardhiAdditionalItem.update({
                                            where: { id: vai.id },
                                            data: { rate: wtp.price, amount, total: amount },
                                        });
                                    }

                                    for (const vId of vardhiIds) {
                                        const [itemsAgg, additionalAgg] = await Promise.all([
                                            tx.vardhiItem.aggregate({
                                                where: { vardhi_id: vId },
                                                _sum: { amount: true },
                                            }),
                                            tx.vardhiAdditionalItem.aggregate({
                                                where: { vardhi_id: vId },
                                                _sum: { amount: true },
                                            }),
                                        ]);

                                        const existingItemsTotal = itemsAgg._sum.amount || 0;
                                        const additionalItemsTotal = additionalAgg._sum.amount || 0;
                                        const grandTotal = Number(existingItemsTotal) + Number(additionalItemsTotal);

                                        await tx.vardhi.update({
                                            where: { id: vId },
                                            data: {
                                                existing_items_total: existingItemsTotal,
                                                additional_items_total: additionalItemsTotal,
                                                grand_total: grandTotal,
                                            },
                                        });
                                    }
                                }
                            }
                        }
                    }
                }

                if (searchPreferences !== undefined) {
                    await tx.itemSearchPreference.deleteMany({ where: { item_id: id } });
                    const prefs = searchPreferences as string[];
                    if (prefs.length > 0) {
                        await tx.itemSearchPreference.createMany({
                            data: prefs.map((value: string) => ({
                                item_id: id,
                                company_id,
                                value: value.trim(),
                            })),
                        });
                    }
                }

                return tx.itemManagement.findUnique({
                    where: { id },
                    include: {
                        unit: { select: { id: true, unit_name: true } },
                        ay: { select: { id: true, ay_no: true } },
                        workTypePrices: {
                            select: {
                                id: true,
                                work_type_id: true,
                                price: true,
                                start_date: true,
                                expiry_date: true,
                                createdAt: true,
                            },
                            orderBy: { start_date: 'desc' },
                        },
                        searchPreferences: { select: { id: true, value: true } },
                    },
                });
            });

            // Create notification for Item Management - Update
            const session = await getServerSession(authOptions);
            await createNotification({
                action: 'Updated',
                entity: 'Item Management',
                entityId: id,
                entityName: updatedItem?.item_name,
                userId: (session?.user as any)?.id,
                link: `/maintenance-sor`,
            });

            return NextResponse.json(successResponse('Item updated successfully', updatedItem));
        });
    } catch (error: any) {
        if (error instanceof ValidationError) {
            return NextResponse.json(errorResponse(error.message), { status: 400 });
        }
        if (error.code === 'P2002') {
            return NextResponse.json(errorResponse('An item with this name already exists'), { status: 409 });
        }
        console.error('Error updating item master:', error);
        return NextResponse.json(errorResponse('Failed to update item master'), { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        if (!id) {
            return NextResponse.json(errorResponse('Invalid item ID'), { status: 400 });
        }

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existingItem = await prisma.itemManagement.findUnique({
                where: { id },
                select: {
                    company_id: true,
                    _count: {
                        select: { vardhiItems: true, vardhiEstimationItems: true },
                    },
                },
            });

            if (!existingItem) {
                return NextResponse.json(errorResponse('Item not found'), { status: 404 });
            }

            if (existingItem._count.vardhiItems > 0 || existingItem._count.vardhiEstimationItems > 0) {
                return NextResponse.json(
                    errorResponse(`Cannot delete item. It is used in ${existingItem._count.vardhiItems} Vardhi items and ${existingItem._count.vardhiEstimationItems} estimation items.`),
                    { status: 409 }
                );
            }

            await prisma.itemWorkTypePrice.deleteMany({ where: { item_id: id } });
            await prisma.itemSearchPreference.deleteMany({ where: { item_id: id } });
            await prisma.itemManagement.delete({ where: { id } });

            // Create notification for Item Management - Delete
            const session = await getServerSession(authOptions);
            await createNotification({
                action: 'Deleted',
                entity: 'Item Management',
                entityId: id,
                entityName: existingItem ? 'Item' : 'Unknown',
                userId: (session?.user as any)?.id,
                link: `/maintenance-sor`,
            });

            return NextResponse.json(successResponse('Item deleted successfully'));
        });
    } catch (error) {
        console.error('Error deleting item master:', error);
        return NextResponse.json(errorResponse('Failed to delete item master'), { status: 500 });
    }
}
