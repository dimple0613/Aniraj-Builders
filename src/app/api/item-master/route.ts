import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const createItemMasterSchema = yup.object({
    item_name: yup.string().required('Item name is required').max(255),
    searching_preference: yup.string().max(255).optional().nullable(),
    uom: yup.string().required('Unit is required').max(50),
    gst_master: yup.string().max(50).optional().nullable(),
    is_subcontractor: yup.boolean().default(false),
    subcontractor_id: yup.string().uuid('Invalid subcontractor ID').optional().nullable(),
    other_item_ids: yup.string().optional().nullable(),
    sorId: yup.string().uuid('Invalid SOR ID').required('SOR is required').transform((value) => value === '' ? null : value),
    departmentId: yup.string().uuid('Invalid Department ID').required('Department is required').transform((value) => value === '' ? null : value),
    itemMasterId: yup.string().uuid('Invalid ItemMaster ID').optional().nullable().transform((value) => value === '' ? null : value),
    srNo: yup.string().required('Sr No. is required').max(50),
    itemNo: yup.string().required('Item No. is required').max(50),
    rate: yup.number().required('Rate is required').min(0, 'Rate must be 0 or greater'),
});

const updateItemMasterSchema = yup.object({
    id: yup.string().uuid('Invalid ID format').required('ID is required'),
    item_name: yup.string().min(1).optional(),
    searching_preference: yup.string().max(255).optional().nullable(),
    uom: yup.string().required('Unit is required').max(50),
    gst_master: yup.string().max(50).optional().nullable(),
    is_subcontractor: yup.boolean().optional(),
    subcontractor_id: yup.string().uuid('Invalid subcontractor ID').optional().nullable(),
    other_item_ids: yup.string().optional().nullable(),
    sorId: yup.string().uuid('Invalid SOR ID').optional().nullable().transform((value) => value === '' ? null : value),
    departmentId: yup.string().uuid('Invalid Department ID').optional().nullable().transform((value) => value === '' ? null : value),
    srNo: yup.string().required('Sr No. is required').max(50),
    itemNo: yup.string().required('Item No. is required').max(50),
    rate: yup.number().required('Rate is required').min(0),
});

const addPriceSchema = yup.object({
    capitalSorId: yup.string().uuid('Invalid CapitalSOR ID').required('CapitalSOR ID is required'),
    price: yup.number().min(0, 'Price must be 0 or greater').required('Price is required'),
    start_date: yup.date().default(() => new Date()),
    expiry_date: yup.date().nullable().optional(),
});

type CreateItemMasterInput = yup.InferType<typeof createItemMasterSchema>;
type UpdateItemMasterInput = yup.InferType<typeof updateItemMasterSchema>;
type AddPriceInput = yup.InferType<typeof addPriceSchema>;

// GET - List grouped by SOR + Department
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search')?.trim() || '';
        const sortOrder = searchParams.get('sortOrder') === 'desc' ? 'desc' : 'asc';
        const sorId = searchParams.get('sorId') || '';
        const departmentId = searchParams.get('departmentId') || '';
        const asOfDate = searchParams.get('asOfDate') || '';

        return await withCompany(async (company) => {
            const company_id = company?.company_id;
            if (!company_id) return NextResponse.json(unauthorizedResponse(), { status: 401 });

            const where: any = {};
            if (sorId) where.sorId = sorId;
            if (departmentId) where.departmentId = departmentId;

            const itemMasters = await prisma.itemMaster.findMany({
                where,
                include: {
                    sor: true,
                    department: true,
                },
                orderBy: [
                    { sor: { name: sortOrder as 'asc' | 'desc' } },
                    { department: { name: sortOrder as 'asc' | 'desc' } },
                ],
            });

            const groups = await Promise.all(
                itemMasters.map(async (im) => {
                    const priceWhere = asOfDate
                        ? {
                            start_date: { lte: new Date(asOfDate) },
                            OR: [
                                { expiry_date: null },
                                { expiry_date: { gte: new Date(asOfDate) } },
                            ],
                          }
                        : {
                            start_date: { lte: new Date() },
                            OR: [
                                { expiry_date: null },
                                { expiry_date: { gte: new Date() } },
                            ],
                          };

                    const items = await prisma.capitalSOR.findMany({
                        where: { itemMasterId: im.id },
                        include: {
                            subcontractor: { select: { id: true, name: true } },
                            prices: {
                                where: priceWhere,
                                orderBy: { start_date: 'desc' },
                                take: 1,
                            },
                        },
                    });

                    return {
                        id: im.id,
                        sorId: im.sorId,
                        sorName: im.sor?.name || null,
                        departmentId: im.departmentId,
                        departmentName: im.department?.name || null,
                        items: items.map((cs) => ({
                            id: cs.id,
                            item_name: cs.item_name,
                            searching_preference: cs.searching_preference,
                            uom: cs.uom,
                            gst_master: cs.gst_master,
                            is_subcontractor: cs.is_subcontractor,
                            subcontractor_id: cs.subcontractor_id,
                            subcontractor_name: cs.subcontractor?.name || null,
                            other_item_ids: cs.other_item_ids,
                            srNo: cs.srNo,
                            itemNo: cs.itemNo,
                            rate: cs.rate,
                            current_price: cs.prices?.[0]?.price || cs.rate || null,
                            is_active: cs.is_active,
                            createdAt: cs.createdAt,
                        })),
                        itemsCount: items.length,
                        createdAt: items.length > 0 ? items[0].createdAt : im.createdAt,
                    };
                })
            );

            let filtered = groups;
            if (search) {
                const s = search.toLowerCase();
                filtered = groups.filter((im: any) =>
                    im.sorName?.toLowerCase().includes(s) ||
                    im.departmentName?.toLowerCase().includes(s) ||
                    im.items.some((cs: any) =>
                        cs.item_name.toLowerCase().includes(s) ||
                        cs.srNo?.toLowerCase().includes(s) ||
                        cs.itemNo?.toLowerCase().includes(s)
                    )
                );
            }

            const totalCount = filtered.length;
            const paginated = filtered.slice((page - 1) * limit, page * limit);

            return NextResponse.json({
                success: true,
                message: 'Item Master groups fetched successfully',
                data: paginated,
                pagination: {
                    page,
                    limit,
                    total: Number(totalCount),
                    pages: Math.ceil(Number(totalCount) / limit),
                },
            });
        });
    } catch (error: any) {
        console.error('Error fetching Item Master:', error);
        return NextResponse.json(errorResponse('Failed to fetch items'), { status: 500 });
    }
}

// POST - Create new CapitalSOR item
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Support single item or array of items
        const items = Array.isArray(body) ? body : [body];
        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;
            if (!company_id) return NextResponse.json(unauthorizedResponse(), { status: 401 });

            // Check for duplicate item names within the request
            const itemNames = items.map((item: any) => item.item_name?.trim().toLowerCase()).filter(Boolean);
            const uniqueNames = new Set(itemNames);
            if (uniqueNames.size !== itemNames.length) {
                return NextResponse.json(errorResponse('Duplicate item names in request'), { status: 400 });
            }

            // Check if SOR + Department combination already exists (skip if adding to existing group)
            const firstItem = items[0];
            const newItemMasterId = firstItem.itemMasterId || null;
            const newSorId = firstItem.sorId || null;
            const newDeptId = firstItem.departmentId || null;

            if (!newItemMasterId && newSorId && newDeptId) {
                const existingItemMaster = await prisma.itemMaster.findFirst({
                    where: { sorId: newSorId, departmentId: newDeptId },
                });
                if (existingItemMaster) {
                    return NextResponse.json(errorResponse('This SOR and Department combination already exists. Please edit the existing entry instead.'), { status: 409 });
                }
            }

            // Check if any item name already exists in DB
            for (const item of items) {
                const existingItem = await prisma.capitalSOR.findFirst({
                    where: { item_name: { equals: item.item_name?.trim(), mode: 'insensitive' } },
                });
                if (existingItem) {
                    return NextResponse.json(errorResponse(`Item "${item.item_name}" already exists`), { status: 409 });
                }
            }

            const newItems = await prisma.$transaction(async (tx) => {
                let itemMasterId: string | null = newItemMasterId;

                // Get sorId and departmentId from first item (all items share same group)
                const sorId = firstItem.sorId || undefined;
                const departmentId = firstItem.departmentId || undefined;

                // Create itemMaster for the new group (only if no existing itemMasterId provided)
                if (!itemMasterId && sorId && departmentId) {
                    // Validate department exists
                    const department = await tx.department.findFirst({ where: { id: departmentId } });
                    if (!department) {
                        throw new Error('departmentId: Department not found');
                    }
                    const createData: any = { company_id };
                    createData.sorId = sorId;
                    createData.departmentId = departmentId;
                    const itemMaster = await tx.itemMaster.create({
                        data: createData,
                    });
                    itemMasterId = itemMaster.id;
                }

                // Create all capitalSOR items linked to the same itemMaster
                const createdItems = [];
                for (const item of items) {
                    const cleanedItem = { ...item };
                    if (cleanedItem.sorId === "") delete cleanedItem.sorId;
                    if (cleanedItem.departmentId === "") delete cleanedItem.departmentId;

                    const validation = await createItemMasterSchema.validate(cleanedItem, { abortEarly: false }).catch((err) => {
                        throw new Error(err.inner.map((issue: any) => `${issue.path}: ${issue.message}`).join('; '));
                    });

                    const validatedData = validation as CreateItemMasterInput;

                    const capitalSor = await tx.capitalSOR.create({
                        data: {
                            company_id,
                            item_name: validatedData.item_name.trim(),
                            searching_preference: validatedData.searching_preference?.trim() || null,
                            uom: validatedData.uom || '',
                            gst_master: validatedData.gst_master?.trim() || null,
                            is_subcontractor: validatedData.is_subcontractor || false,
                            subcontractor_id: validatedData.is_subcontractor ? validatedData.subcontractor_id : null,
                            other_item_ids: validatedData.other_item_ids?.trim() || null,
                            srNo: validatedData.srNo || null,
                            itemNo: validatedData.itemNo || null,
                            rate: validatedData.rate || null,
                            itemMasterId,
                        },
                        include: {
                            itemMaster: { include: { sor: true, department: true } },
                            subcontractor: { select: { id: true, name: true } },
                        },
                    });

                    if (validatedData.rate !== null && validatedData.rate !== undefined) {
                        await tx.capitalSORPrice.create({
                            data: {
                                company_id,
                                capitalSor_id: capitalSor.id,
                                price: validatedData.rate,
                                start_date: new Date(),
                                expiry_date: null,
                            },
                        });
                    }

                    createdItems.push(capitalSor);
                }

                return createdItems;
            });

            if (newItems.length > 0) {
                await createNotification({
                    action: 'Created',
                    entity: 'Item Master',
                    entityId: newItems[0].id,
                    entityName: `${newItems[0].itemMaster?.sor?.name || ''} / ${newItems[0].itemMaster?.department?.name || ''}`,
                    userId: (session?.user as any)?.id,
                    link: `/item-master`,
                });
            }

            return NextResponse.json(successResponse(
                `${newItems.length} item(s) created successfully`,
                newItems.map((item) => ({
                    id: item.id,
                    item_name: item.item_name,
                    searching_preference: item.searching_preference,
                    uom: item.uom,
                    gst_master: item.gst_master,
                    itemMasterId: item.itemMasterId,
                    sorName: item.itemMaster?.sor?.name || null,
                    departmentName: item.itemMaster?.department?.name || null,
                    srNo: item.srNo,
                    itemNo: item.itemNo,
                    rate: item.rate,
                    subcontractor_name: item.subcontractor?.name || null,
                }))
            ), { status: 201 });
        });
    } catch (error: any) {
        console.error('Error creating CapitalSOR:', error);
        const message = error?.message || 'Failed to create item';
        return NextResponse.json(errorResponse(message), { status: message.includes(':') ? 400 : 500 });
    }
}

// PUT - Update CapitalSOR item
export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();

        // Clean empty strings - remove fields entirely if empty
        const cleanedBody = { ...body };
        if (cleanedBody.sorId === "") delete cleanedBody.sorId;
        if (cleanedBody.departmentId === "") delete cleanedBody.departmentId;
        if (cleanedBody.subcontractor_id === "") delete cleanedBody.subcontractor_id;

        const validation = await updateItemMasterSchema.validate(cleanedBody, { abortEarly: false }).catch((err) => {
            const errorMessages = err.inner.map((issue: any) => `${issue.path}: ${issue.message}`).join('; ');
            throw new Error(errorMessages);
        });

        const {
            id, item_name, searching_preference, uom, gst_master, is_subcontractor,
            subcontractor_id, other_item_ids, sorId, departmentId, srNo, itemNo, rate,
        } = validation as UpdateItemMasterInput;

        if (!id) return NextResponse.json(errorResponse('ID is required'), { status: 400 });
        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;
            if (!company_id) return NextResponse.json(unauthorizedResponse(), { status: 401 });

            const existingItem = await prisma.capitalSOR.findFirst({ where: { id } });
            if (!existingItem) return NextResponse.json(errorResponse('Item not found'), { status: 404 });

            if (item_name) {
                const duplicate = await prisma.capitalSOR.findFirst({
                    where: { item_name: { equals: item_name.trim(), mode: 'insensitive' }, id: { not: id } },
                });
                if (duplicate) return NextResponse.json(errorResponse('An item with this name already exists'), { status: 409 });
            }

            if (is_subcontractor && subcontractor_id) {
                const subExists = await prisma.subcontractor.findFirst({ where: { id: subcontractor_id, company_id } });
                if (!subExists) return NextResponse.json(errorResponse('Invalid subcontractor selected'), { status: 400 });
            }

            const updatedItem = await prisma.$transaction(async (tx) => {
                const updateData: any = {};
                if (item_name !== undefined) updateData.item_name = item_name.trim();
                if (searching_preference !== undefined) updateData.searching_preference = searching_preference?.trim() || null;
                if (uom !== undefined) updateData.uom = uom || '';
                if (gst_master !== undefined) updateData.gst_master = gst_master?.trim() || null;
                if (is_subcontractor !== undefined) {
                    updateData.is_subcontractor = is_subcontractor;
                    updateData.subcontractor_id = is_subcontractor ? subcontractor_id : null;
                }
                if (srNo !== undefined) updateData.srNo = srNo;
                if (itemNo !== undefined) updateData.itemNo = itemNo;
                if (rate !== undefined) updateData.rate = rate;
                if (other_item_ids !== undefined) updateData.other_item_ids = other_item_ids?.trim() || null;

                const capitalSor = await tx.capitalSOR.update({
                    where: { id },
                    data: updateData,
                    include: {
                        itemMaster: { include: { sor: true, department: true } },
                        subcontractor: { select: { id: true, name: true } },
                    },
                });

                if (sorId !== undefined || departmentId !== undefined) {
                    const newSorId = sorId !== undefined ? sorId : capitalSor.itemMaster?.sorId;
                    const newDeptId = departmentId !== undefined ? departmentId : capitalSor.itemMaster?.departmentId;

                    const whereClause: any = {};
                    if (newSorId !== undefined) whereClause.sorId = newSorId as any;
                    if (newDeptId !== undefined) whereClause.departmentId = newDeptId as any;

                    let itemMaster = await tx.itemMaster.findFirst({
                        where: whereClause,
                    });
                    if (!itemMaster) {
                        const createData: any = { company_id };
                        if (newSorId !== undefined) createData.sorId = newSorId as any;
                        if (newDeptId !== undefined) createData.departmentId = newDeptId as any;
                        itemMaster = await tx.itemMaster.create({ data: createData });
                    }
                    await tx.capitalSOR.update({
                        where: { id },
                        data: { itemMasterId: itemMaster.id },
                    });
                    capitalSor.itemMasterId = itemMaster.id;
                    capitalSor.itemMaster = await tx.itemMaster.findFirst({
                        where: { id: itemMaster.id },
                        include: { sor: true, department: true },
                    });
                }

                return capitalSor;
            });

            await createNotification({
                action: 'Updated',
                entity: 'Item Master',
                entityId: updatedItem.id,
                entityName: `${updatedItem.itemMaster?.sor?.name || ''} / ${updatedItem.itemMaster?.department?.name || ''}`,
                userId: (session?.user as any)?.id,
                link: `/item-master`,
            });

            return NextResponse.json(successResponse('Item updated successfully', {
                id: updatedItem.id,
                item_name: updatedItem.item_name,
                searching_preference: updatedItem.searching_preference,
                uom: updatedItem.uom,
                gst_master: updatedItem.gst_master,
                itemMasterId: updatedItem.itemMasterId,
                sorName: updatedItem.itemMaster?.sor?.name || null,
                departmentName: updatedItem.itemMaster?.department?.name || null,
                srNo: updatedItem.srNo,
                itemNo: updatedItem.itemNo,
                rate: updatedItem.rate,
                subcontractor_name: updatedItem.subcontractor?.name || null,
            }));
        });
    } catch (error: any) {
        console.error('Error updating CapitalSOR:', error);
        const message = error?.message || 'Failed to update item';
        return NextResponse.json(errorResponse(message), { status: message.includes(':') ? 400 : 500 });
    }
}

// DELETE - Delete CapitalSOR item or entire ItemMaster group
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const itemMasterId = searchParams.get('itemMasterId');
        if (!id && !itemMasterId) return NextResponse.json(errorResponse('ID or ItemMaster ID is required'), { status: 400 });
        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;
            if (!company_id) return NextResponse.json(unauthorizedResponse(), { status: 401 });

            if (itemMasterId) {
                return await handleGroupDelete(prisma, itemMasterId, session, request);
            }

            const existingItem = await prisma.capitalSOR.findFirst({
                where: { id },
                include: { itemMaster: { include: { sor: true, department: true } } },
            });
            if (!existingItem) return NextResponse.json(errorResponse('Item not found'), { status: 404 });

            // Check usage before deleting
            const usedInProject = await prisma.projectItem.findFirst({
                where: { capital_sor_id: id },
                select: { id: true },
            });
            if (usedInProject) {
                return NextResponse.json(
                    errorResponse('This record cannot be deleted because it is currently in use.'),
                    { status: 400 },
                );
            }
            const usedInPurchase = await prisma.purchaseEntryMaterial.findFirst({
                where: { material_id: id },
                select: { id: true },
            });
            if (usedInPurchase) {
                return NextResponse.json(
                    errorResponse('This record cannot be deleted because it is currently in use.'),
                    { status: 400 },
                );
            }
            const referencedAsOtherItem = await prisma.capitalSOR.findFirst({
                where: { other_item_ids: { contains: id } },
                select: { id: true },
            });
            if (referencedAsOtherItem) {
                return NextResponse.json(
                    errorResponse('This Other Item cannot be deleted because it is currently in use.'),
                    { status: 400 },
                );
            }

            await prisma.$transaction(async (tx) => {
                await tx.capitalSORPrice.deleteMany({ where: { capitalSor_id: id } });
                await tx.capitalSOR.delete({ where: { id } });
                if (existingItem.itemMasterId) {
                    const remaining = await tx.capitalSOR.count({ where: { itemMasterId: existingItem.itemMasterId } });
                    if (remaining === 0) {
                        await tx.itemMaster.delete({ where: { id: existingItem.itemMasterId } });
                    }
                }
            });

            await createNotification({
                action: 'Deleted',
                entity: 'Item Master',
                entityId: id,
                entityName: `${existingItem.itemMaster?.sor?.name || ''} / ${existingItem.itemMaster?.department?.name || ''}`,
                userId: (session?.user as any)?.id,
                link: `/item-master`,
            });

            return NextResponse.json(successResponse('Item deleted successfully'));
        });
    } catch (error: any) {
        console.error('Error deleting CapitalSOR:', error);
        return NextResponse.json(errorResponse('Failed to delete item'), { status: 500 });
    }
}

async function handleGroupDelete(prisma: any, itemMasterId: string, session: any, request: NextRequest) {
    const itemMaster = await prisma.itemMaster.findFirst({
        where: { id: itemMasterId },
        include: {
            sor: true,
            department: true,
            capitalSors: {
                include: { itemMaster: true },
            },
        },
    });

    if (!itemMaster) {
        return NextResponse.json(errorResponse('Item Master group not found'), { status: 404 });
    }

    const items = itemMaster.capitalSors || [];

    const usedItemIds = await prisma.projectItem.findMany({
        where: { capital_sor_id: { in: items.map((i: any) => i.id) } },
        select: { capital_sor_id: true },
    });

    const usedInPurchase = await prisma.purchaseEntryMaterial.findMany({
        where: { material_id: { in: items.map((i: any) => i.id) } },
        select: { material_id: true },
    });

    const usedIds = new Set([
        ...usedItemIds.map((u: any) => u.capital_sor_id),
        ...usedInPurchase.map((u: any) => u.material_id),
    ]);

    if (usedIds.size > 0) {
        const usedNames = items
            .filter((i: any) => usedIds.has(i.id))
            .map((i: any) => i.item_name);
        return NextResponse.json(
            errorResponse(`Cannot delete. Item(s) in use: ${usedNames.join(', ')}`),
            { status: 409 },
        );
    }

    await prisma.$transaction(async (tx: any) => {
        const itemIds = items.map((i: any) => i.id);
        await tx.capitalSORPrice.deleteMany({ where: { capitalSor_id: { in: itemIds } } });
        await tx.capitalSOR.deleteMany({ where: { itemMasterId } });
        await tx.itemMaster.delete({ where: { id: itemMasterId } });
    });

    const sorsDept = `${itemMaster.sor?.name || ''} / ${itemMaster.department?.name || ''}`;
    await createNotification({
        action: 'Deleted',
        entity: 'Item Master',
        entityId: itemMasterId,
        entityName: sorsDept,
        userId: (session?.user as any)?.id,
        link: `/item-master`,
    });

    return NextResponse.json(successResponse('Group deleted successfully'));
}

// GET prices for a CapitalSOR
export async function GET_PRICES(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const capitalSorId = searchParams.get('capitalSorId');
        if (!capitalSorId) return NextResponse.json(errorResponse('CapitalSOR ID is required'), { status: 400 });

        return await withCompany(async (company) => {
            const company_id = company?.company_id;
            if (!company_id) return NextResponse.json(unauthorizedResponse(), { status: 401 });

            const prices = await prisma.capitalSORPrice.findMany({
                where: { capitalSor_id: capitalSorId },
                orderBy: { start_date: 'desc' },
            });

            return NextResponse.json(successResponse('Prices fetched successfully', prices));
        });
    } catch (error: any) {
        console.error('Error fetching prices:', error);
        return NextResponse.json(errorResponse('Failed to fetch prices'), { status: 500 });
    }
}

// POST - Add price for CapitalSOR
export async function ADD_PRICE(request: NextRequest) {
    try {
        const body = await request.json();
        const validation = await addPriceSchema.validate(body, { abortEarly: false }).catch((err) => {
            const errorMessages = err.inner.map((issue: any) => `${issue.path}: ${issue.message}`).join('; ');
            throw new Error(errorMessages);
        });

        const { capitalSorId, price, start_date, expiry_date } = validation as AddPriceInput;

        return await withCompany(async (company) => {
            const company_id = company?.company_id;
            if (!company_id) return NextResponse.json(unauthorizedResponse(), { status: 401 });

            const capitalSor = await prisma.capitalSOR.findFirst({ where: { id: capitalSorId } });
            if (!capitalSor) return NextResponse.json(errorResponse('Item not found'), { status: 404 });

            const newPrice = await prisma.capitalSORPrice.create({
                data: { company_id, capitalSor_id: capitalSorId, price, start_date, expiry_date },
            });

            return NextResponse.json(successResponse('Price added successfully', newPrice), { status: 201 });
        });
    } catch (error: any) {
        console.error('Error adding price:', error);
        const message = error?.message || 'Failed to add price';
        return NextResponse.json(errorResponse(message), { status: message.includes(':') ? 400 : 500 });
    }
}
