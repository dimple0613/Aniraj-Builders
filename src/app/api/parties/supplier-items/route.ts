import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const partyId = searchParams.get('partyId');
        const partySupplierItemId = searchParams.get('partySupplierItemId');

        if (partySupplierItemId) {
            return await withCompany(async (company) => {
                const prices = await prisma.partySupplierItemPrice.findMany({
                    where: { party_supplier_item_id: partySupplierItemId },
                    orderBy: { start_date: 'desc' },
                });
                const history = prices.map((p) => ({
                    id: p.id,
                    price: Number(p.price),
                    start_date: p.start_date,
                    expiry_date: p.expiry_date,
                }));
                return NextResponse.json({ success: true, data: history });
            });
        }

        if (!partyId) {
            return NextResponse.json({ success: false, message: 'partyId or partySupplierItemId is required' }, { status: 400 });
        }

        return await withCompany(async (company) => {
            const dateParam = searchParams.get('date');
            const lookupDate = dateParam ? new Date(dateParam) : new Date();
            const items = await prisma.partySupplierItem.findMany({
                where: {
                    party_id: partyId,
                    party: { company_id: company?.company_id },
                },
                include: {
                    capitalSor: {
                        select: {
                            id: true,
                            item_name: true,
                            uom: true,
                            rate: true,
                            gst_master: true,
                        },
                    },
                    prices: {
                        where: {
                            start_date: { lte: lookupDate },
                            OR: [
                                { expiry_date: null },
                                { expiry_date: { gt: lookupDate } },
                            ],
                        },
                        orderBy: { start_date: 'desc' },
                        take: 1,
                    },
                },
                orderBy: { createdAt: 'desc' },
            });

            const result = items.map((item) => ({
                ...item,
                rate: item.prices?.[0]?.price ?? item.rate,
            }));

            return NextResponse.json({ success: true, data: result });
        });
    } catch (error) {
        console.error('Error fetching supplier items:', error);
        return NextResponse.json({ success: false, message: 'Failed to fetch supplier items' }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { party_id, capital_sor_id, rate, effective_date } = body;

        if (!party_id || !capital_sor_id || rate === undefined) {
            return NextResponse.json({ success: false, message: 'party_id, capital_sor_id, and rate are required' }, { status: 400 });
        }

        return await withCompany(async (company) => {
            const party = await prisma.party.findFirst({
                where: { id: party_id, company_id: company?.company_id },
            });
            if (!party) {
                return NextResponse.json({ success: false, message: 'Party not found' }, { status: 404 });
            }

            const existing = await prisma.partySupplierItem.findUnique({
                where: { party_id_capital_sor_id: { party_id, capital_sor_id } },
            });
            if (existing) {
                return NextResponse.json({ success: false, message: 'Item already exists for this party' }, { status: 400 });
            }

            const item = await prisma.partySupplierItem.create({
                data: {
                    party_id,
                    capital_sor_id,
                    rate: parseFloat(rate),
                    effective_date: effective_date ? new Date(effective_date) : new Date(),
                },
                include: {
                    capitalSor: {
                        select: { id: true, item_name: true, uom: true, rate: true },
                    },
                },
            });

            await prisma.partySupplierItemPrice.create({
                data: {
                    company_id: company?.company_id!,
                    party_supplier_item_id: item.id,
                    price: parseFloat(rate),
                    start_date: effective_date ? new Date(effective_date) : new Date(),
                    expiry_date: null,
                },
            });

            return NextResponse.json({ success: true, data: item });
        });
    } catch (error) {
        console.error('Error creating supplier item:', error);
        return NextResponse.json({ success: false, message: 'Failed to create supplier item' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { id, rate, effective_date } = body;

        if (!id || rate === undefined) {
            return NextResponse.json({ success: false, message: 'id and rate are required' }, { status: 400 });
        }

        return await withCompany(async (company) => {
            const existing = await prisma.partySupplierItem.findFirst({
                where: {
                    id,
                    party: { company_id: company?.company_id },
                },
            });
            if (!existing) {
                return NextResponse.json({ success: false, message: 'Supplier item not found' }, { status: 404 });
            }

            const now = new Date();
            const effectiveDateTime = effective_date ? new Date(effective_date) : now;
            const isFuture = effectiveDateTime > now;

            if (isFuture) {
                const currentPrice = await prisma.partySupplierItemPrice.findFirst({
                    where: {
                        party_supplier_item_id: id,
                        start_date: { lte: now },
                        OR: [{ expiry_date: null }, { expiry_date: { gt: now } }],
                    },
                    orderBy: { start_date: 'desc' },
                });
                if (currentPrice) {
                    await prisma.partySupplierItemPrice.update({
                        where: { id: currentPrice.id },
                        data: { expiry_date: effectiveDateTime },
                    });
                }

                await prisma.partySupplierItemPrice.updateMany({
                    where: {
                        party_supplier_item_id: id,
                        start_date: { gt: now },
                        expiry_date: null,
                    },
                    data: {
                        expiry_date: effectiveDateTime,
                    },
                });
            } else {
                const currentPrice = await prisma.partySupplierItemPrice.findFirst({
                    where: {
                        party_supplier_item_id: id,
                        start_date: { lte: now },
                        OR: [{ expiry_date: null }, { expiry_date: { gt: now } }],
                    },
                    orderBy: { start_date: 'desc' },
                });
                if (currentPrice) {
                    await prisma.partySupplierItemPrice.update({
                        where: { id: currentPrice.id },
                        data: { expiry_date: effectiveDateTime },
                    });
                }
            }

            const item = await prisma.partySupplierItem.update({
                where: { id },
                data: {
                    rate: parseFloat(rate),
                    effective_date: effectiveDateTime,
                },
                include: {
                    capitalSor: {
                        select: { id: true, item_name: true, uom: true, rate: true },
                    },
                },
            });

            await prisma.partySupplierItemPrice.create({
                data: {
                    company_id: company?.company_id!,
                    party_supplier_item_id: id,
                    price: parseFloat(rate),
                    start_date: effectiveDateTime,
                    expiry_date: null,
                },
            });

            return NextResponse.json({ success: true, data: item });
        });
    } catch (error) {
        console.error('Error updating supplier item:', error);
        return NextResponse.json({ success: false, message: 'Failed to update supplier item' }, { status: 500 });
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json({ success: false, message: 'id is required' }, { status: 400 });
        }

        return await withCompany(async (company) => {
            const existing = await prisma.partySupplierItem.findFirst({
                where: {
                    id,
                    party: { company_id: company?.company_id },
                },
                include: { capitalSor: true },
            });
            if (!existing) {
                return NextResponse.json({ success: false, message: 'Supplier item not found' }, { status: 404 });
            }

            const usedInPurchaseEntry = await prisma.purchaseEntryMaterial.findFirst({
                where: {
                    company_id: company?.company_id,
                    material_id: existing.capital_sor_id,
                    purchaseEntry: { party_id: existing.party_id },
                },
            });
            if (usedInPurchaseEntry) {
                return NextResponse.json(
                    { success: false, message: 'This item cannot be deleted because it is being used in a Purchase Entry.' },
                    { status: 400 },
                );
            }

            await prisma.partySupplierItem.delete({ where: { id } });
            return NextResponse.json({ success: true, message: 'Supplier item deleted' });
        });
    } catch (error) {
        console.error('Error deleting supplier item:', error);
        return NextResponse.json({ success: false, message: 'Failed to delete supplier item' }, { status: 500 });
    }
}
