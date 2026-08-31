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

// Natural/alphanumeric sorting function
function naturalCompare(a: string, b: string): number {
    const partsA = a.match(/\d+|[^\d]+/g) || [];
    const partsB = b.match(/\d+|[^\d]+/g) || [];

    const maxLen = Math.max(partsA.length, partsB.length);

    for (let i = 0; i < maxLen; i++) {
        if (i >= partsA.length) return -1;
        if (i >= partsB.length) return 1;

        const partA = partsA[i];
        const partB = partsB[i];

        const numA = parseInt(partA, 10);
        const numB = parseInt(partB, 10);

        if (!isNaN(numA) && !isNaN(numB)) {
            if (numA !== numB) return numA - numB;
        } else {
            const cmp = partA.localeCompare(partB, undefined, { sensitivity: 'base' });
            if (cmp !== 0) return cmp;
        }
    }

    return 0;
}

const MAX_PRICE = 999999999999999;

async function enrichItemsWithGroup(items: any[]) {
    const groupIds = items.map(item => item.group_id).filter(Boolean);
    if (groupIds.length === 0) return items;

    const groups = await prisma.sORGroup.findMany({
        where: { id: { in: groupIds } },
        select: { id: true, name: true },
    });
    const groupMap = new Map(groups.map(g => [g.id, g]));

    return items.map(item => ({
        ...item,
        group: item.group_id ? (groupMap.get(item.group_id) || null) : null,
    }));
}

const createItemSchema = yup.object({
    item_name: yup.string().required('Item name is required').max(255, 'Item name must be less than 255 characters'),
    unit_id: yup.string().required('Unit is required'),
    ay_id: yup.string().required('Item number is required'),
    group_id: yup.string().nullable().optional(),
    work_type: yup.boolean().optional(),
    is_active: yup.boolean().optional(),
    workTypePrices: yup.array(yup.object({
        work_type_id: yup.string().required(),
        price: yup.number().min(0).required(),
    })).optional(),
    searchPreferences: yup.array(yup.string()).optional(),
});

type CreateItemInput = yup.InferType<typeof createItemSchema>;

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search')?.trim() || '';
        const sortBy = searchParams.get('sortField') || 'item_name';
        const sortOrder = searchParams.get('sortOrder') || 'asc';

        let unitIds = searchParams.getAll('unit_id');
        if (unitIds.length === 0) {
            unitIds = searchParams.getAll('unit_id[]');
        }

        let ayIds = searchParams.getAll('ay_id');
        if (ayIds.length === 0) {
            ayIds = searchParams.getAll('ay_id[]');
        }

        let groupIds = searchParams.getAll('group_id');
        if (groupIds.length === 0) {
            groupIds = searchParams.getAll('group_id[]');
        }

        const where: any = {};

        if (search) {
            where.OR = [
                { item_name: { contains: search, mode: 'insensitive' } },
                {
                    searchPreferences: {
                        some: {
                            value: { contains: search, mode: 'insensitive' }
                        }
                    }
                },
            ];
        }

        if (unitIds.length > 0) {
            where.unit_id = { in: unitIds };
        }

        if (ayIds.length > 0) {
            where.ay_id = { in: ayIds };
        }

        if (groupIds.length > 0) {
            where.group_id = { in: groupIds };
        }

        const [data, total] = await withCompany(async (companyId) => {
            // If no sort field is specified or sorting by item_name (default), 
            // we need to sort by Item Number (ay_no) with natural sorting
            if (!sortBy || sortBy === 'item_name') {
                // Fetch all items that match the filters (without limit for sorting)
                const allItems = await prisma.itemManagement.findMany({
                    where,
                    include: {
                        unit: { select: { id: true, unit_name: true } },
                        ay: { select: { id: true, ay_no: true } },
                        workTypePrices: {
                            include: {
                                workType: { select: { id: true, name: true } },
                            },
                        },
                        searchPreferences: {
                            select: { id: true, value: true },
                            orderBy: { createdAt: 'asc' },
                        },
                    },
                });
                
                // Sort by Item Number (ay_no) using natural sorting
                const sortedItems = allItems.sort((a, b) => {
                    const ayNoA = a.ay?.ay_no || '';
                    const ayNoB = b.ay?.ay_no || '';
                    return naturalCompare(ayNoA, ayNoB);
                });
                
                // Apply pagination to the sorted results
                const startIndex = (page - 1) * limit;
                const endIndex = startIndex + limit;
                const paginatedItems = sortedItems.slice(startIndex, endIndex);
                
                // Enrich with group data
                const enrichedWithGroups = await enrichItemsWithGroup(paginatedItems);
                
                return [enrichedWithGroups, await prisma.itemManagement.count({ where })];
            } else {
                // Use Prisma's orderBy for specified sort fields (other than item_name)
                const items = await prisma.itemManagement.findMany({
                    where,
                    include: {
                        unit: { select: { id: true, unit_name: true } },
                        ay: { select: { id: true, ay_no: true } },
                        workTypePrices: {
                            include: {
                                workType: { select: { id: true, name: true } },
                            },
                        },
                        searchPreferences: {
                            select: { id: true, value: true },
                            orderBy: { createdAt: 'asc' },
                        },
                    },
                    orderBy: { [sortBy]: sortOrder },
                    skip: (page - 1) * limit,
                    take: limit,
                });

                const itemsWithSearchPrefs = items.map(item => ({
                    ...item
                }));

                const enrichedWithGroups = await enrichItemsWithGroup(itemsWithSearchPrefs);

                return [enrichedWithGroups, await prisma.itemManagement.count({ where })];
            }
        });

        return NextResponse.json(
            successResponse('Item management data fetched successfully', data, {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            })
        );
    } catch (error) {
        console.error('Error fetching item masters:', error);
        return NextResponse.json(errorResponse('Failed to fetch item masters'), { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const validation = await createItemSchema.validate(body, { abortEarly: false })
            .catch(err => {
                throw new ValidationError(formatValidationErrors(err));
            });

        const {
            item_name,
            unit_id,
            ay_id,
            group_id,
            work_type,
            is_active,
            workTypePrices,
            searchPreferences
        } = validation as CreateItemInput;

        const response = await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(
                    unauthorizedResponse(),
                    { status: 401 }
                );
            }

            const existingItem = await prisma.itemManagement.findFirst({
                where: {
                    item_name: { equals: item_name.trim(), mode: 'insensitive' },
                },
            });

            if (existingItem) {
                return NextResponse.json(
                    errorResponse('An item with this name already exists'),
                    { status: 409 }
                );
            }

            const unitExists = await prisma.unit.findFirst({
                where: { id: unit_id },
            });

            if (!unitExists) {
                return NextResponse.json(
                    errorResponse('Invalid unit selected'),
                    { status: 400 }
                );
            }

            if (ay_id) {
                const ayExists = await prisma.aYMaster.findFirst({
                    where: { id: ay_id },
                });

                if (!ayExists) {
                    return NextResponse.json(
                        errorResponse('Invalid financial year selected'),
                        { status: 400 }
                    );
                }
            }

            const validSearchPreferences =
                (searchPreferences || []).filter((pref) => pref && pref.trim().length > 0) as string[];

            const seen = new Set<string>();
            const duplicatePreferences = validSearchPreferences.filter(pref => {
                if (seen.has(pref)) return true;
                seen.add(pref);
                return false;
            });

            if (duplicatePreferences.length > 0) {
                return NextResponse.json(
                    errorResponse('Duplicate search preferences are not allowed'),
                    { status: 409 }
                );
            }

            const item: any = await prisma.$transaction(async (tx) => {
                const newItem = await tx.itemManagement.create({
                    data: {
                        item_name: item_name.trim(),
                        unit_id,
                        ay_id,
                        group_id: group_id || null,
                        work_type: work_type || false,
                        is_active: is_active ?? true,
                        company_id,
                    },
                });

                if (workTypePrices?.length) {
                    await tx.itemWorkTypePrice.createMany({
                        data: workTypePrices.map((wtp: { work_type_id: string; price: number }) => ({
                            company_id,
                            item_id: newItem.id,
                            work_type_id: wtp.work_type_id,
                            price: wtp.price,
                        })),
                    });
                }

                if (validSearchPreferences.length > 0) {
                    await tx.itemSearchPreference.createMany({
                        data: validSearchPreferences.map((value: string) => ({
                            item_id: newItem.id,
                            company_id,
                            value: value.trim(),
                        })),
                    });
                }

                return tx.itemManagement.findUnique({
                    where: { id: newItem.id },
                    include: {
                        unit: { select: { id: true, unit_name: true } },
                        ay: { select: { id: true, ay_no: true } },
                        workTypePrices: {
                            include: {
                                workType: { select: { id: true, name: true } },
                            },
                        },
                        searchPreferences: {
                            select: { id: true, value: true },
                        },
                    },
                });
            });

            // Create notification for Item Management - Create
            const session = await getServerSession(authOptions);
            await createNotification({
                action: 'Created',
                entity: 'Item Management',
                entityId: item?.id,
                entityName: item?.item_name,
                userId: (session?.user as any)?.id,
                link: `/maintenance-sor`,
            });

            return NextResponse.json(
                successResponse(item),
                { status: 201 }
            );
        });

        if (!response) {
            return NextResponse.json(
                errorResponse('Unexpected server error'),
                { status: 500 }
            );
        }

        return response;
    } catch (error: any) {
        if (error instanceof ValidationError) {
            return NextResponse.json(errorResponse(error.message), { status: 400 });
        }
        console.error('Error creating item master:', error);
        return NextResponse.json(errorResponse('Failed to create item master'), { status: 500 });
    }
}