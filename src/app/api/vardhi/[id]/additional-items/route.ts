import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Prisma } from '@prisma/client';

async function recalculateVardhiTotals(tx: any, vardhiId: string) {
    const existingItemsTotal = await tx.vardhiItem.aggregate({
        where: { vardhi_id: vardhiId },
        _sum: { amount: true },
    });

    const additionalItemsTotal = await tx.vardhiAdditionalItem.aggregate({
        where: { vardhi_id: vardhiId },
        _sum: { total: true },
    });

    const existingTotal = existingItemsTotal._sum.amount || new Prisma.Decimal(0);
    const additionalTotal = additionalItemsTotal._sum.total || new Prisma.Decimal(0);
    const grandTotal = existingTotal.plus(additionalTotal);
    const differenceTotal = additionalTotal.minus(existingTotal);

    await tx.vardhi.update({
        where: { id: vardhiId },
        data: {
            existing_items_total: existingTotal,
            additional_items_total: additionalTotal,
            grand_total: grandTotal,
            difference_total: differenceTotal,
        },
    });
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const response = await withCompany(async (company) => {
            if (!company?.company_id) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 }
                );
            }

            const items = await prisma.vardhiAdditionalItem.findMany({
                where: {
                    vardhi_id: id,
                },
                orderBy: { created_at: 'desc' },
            });

            return NextResponse.json(
                successResponse('Additional items fetched successfully', items)
            );
        });

        return response;

    } catch (error) {
        console.error('Error fetching additional items:', error);
        return NextResponse.json(
            errorResponse('Failed to fetch additional items'),
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: vardhi_id } = await params;
        const body = await request.json();
        const { item_name, qty, rate, size } = body;

        if (!item_name || !qty || !rate || parseFloat(qty) <= 0 || parseFloat(rate) <= 0) {
            return NextResponse.json(
                { success: false, message: "Item name, qty, and rate are required. Values must be positive." },
                { status: 400 }
            );
        }

        const response = await withCompany(async (company) => {
            if (!company?.company_id) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 }
                );
            }

            const vardhi = await prisma.vardhi.findFirst({
                where: {
                    id: vardhi_id,
                    company_id: company.company_id,
                },
            });

            if (!vardhi) {
                return NextResponse.json(
                    { success: false, message: "Vardhi not found" },
                    { status: 404 }
                );
            }

            const qtyNum = parseFloat(qty);
            const rateNum = parseFloat(rate);
            const total = qtyNum * rateNum;

            const result = await prisma.$transaction(async (tx) => {
                const item = await tx.vardhiAdditionalItem.create({
                    data: {
                        company_id: company.company_id,
                        vardhi_id,
                        item_name,
                        size: size || "",
                        qty: new Prisma.Decimal(qtyNum),
                        rate: new Prisma.Decimal(rateNum),
                        amount: new Prisma.Decimal(total),
                        total: new Prisma.Decimal(total),
                    },
                });

                await recalculateVardhiTotals(tx, vardhi_id);

                return item;
            });

            return NextResponse.json(
                successResponse('Additional item added successfully', result)
            );
        });

        return response;

    } catch (error: any) {
        console.error('Error creating additional item:', error);
        return NextResponse.json(
            errorResponse(error.message || 'Failed to create additional item'),
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: vardhi_id } = await params;
        const body = await request.json();
        const { item_id, item_name, qty, rate, size } = body;

        if (!item_id) {
            return NextResponse.json(
                { success: false, message: "Item ID is required" },
                { status: 400 }
            );
        }

        if (!item_name || !qty || !rate || parseFloat(qty) <= 0 || parseFloat(rate) <= 0) {
            return NextResponse.json(
                { success: false, message: "Item name, qty, and rate are required. Values must be positive." },
                { status: 400 }
            );
        }

        const response = await withCompany(async (company) => {
            if (!company?.company_id) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 }
                );
            }

            const vardhi = await prisma.vardhi.findFirst({
                where: {
                    id: vardhi_id,
                    company_id: company.company_id,
                },
            });

            if (!vardhi) {
                return NextResponse.json(
                    { success: false, message: "Vardhi not found" },
                    { status: 404 }
                );
            }

            const qtyNum = parseFloat(qty);
            const rateNum = parseFloat(rate);
            const total = qtyNum * rateNum;

            const result = await prisma.$transaction(async (tx) => {
                const item = await tx.vardhiAdditionalItem.update({
                    where: { id: item_id },
                    data: {
                        item_name,
                        size: size || "",
                        qty: new Prisma.Decimal(qtyNum),
                        rate: new Prisma.Decimal(rateNum),
                        amount: new Prisma.Decimal(total),
                        total: new Prisma.Decimal(total),
                    },
                });

                await recalculateVardhiTotals(tx, vardhi_id);

                return item;
            });

            return NextResponse.json(
                successResponse('Additional item updated successfully', result)
            );
        });

        return response;

    } catch (error: any) {
        console.error('Error updating additional item:', error);
        return NextResponse.json(
            errorResponse(error.message || 'Failed to update additional item'),
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: vardhi_id } = await params;
        const { searchParams } = new URL(request.url);
        const itemId = searchParams.get('itemId');

        if (!itemId) {
            return NextResponse.json(
                { success: false, message: "Item ID is required" },
                { status: 400 }
            );
        }

        const response = await withCompany(async (company) => {
            if (!company?.company_id) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 }
                );
            }

            const vardhi = await prisma.vardhi.findFirst({
                where: {
                    id: vardhi_id,
                    company_id: company.company_id,
                },
            });

            if (!vardhi) {
                return NextResponse.json(
                    { success: false, message: "Vardhi not found" },
                    { status: 404 }
                );
            }

            await prisma.$transaction(async (tx) => {
                await tx.vardhiAdditionalItem.delete({
                    where: { id: itemId },
                });

                await recalculateVardhiTotals(tx, vardhi_id);
            });

            return NextResponse.json(
                successResponse('Additional item deleted successfully')
            );
        });

        return response;

    } catch (error: any) {
        console.error('Error deleting additional item:', error);
        return NextResponse.json(
            errorResponse(error.message || 'Failed to delete additional item'),
            { status: 500 }
        );
    }
}
