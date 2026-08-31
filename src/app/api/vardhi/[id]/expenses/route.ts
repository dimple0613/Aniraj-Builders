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

            const expenses = await prisma.vardhiExpense.findMany({
                where: {
                    vardhi_id: id,
                },
                orderBy: { created_at: 'desc' },
            });

            return NextResponse.json(
                successResponse('Expenses fetched successfully', expenses)
            );
        });

        return response;

    } catch (error) {
        console.error('Error fetching expenses:', error);
        return NextResponse.json(
            errorResponse('Failed to fetch expenses'),
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
        const { particular, amount } = body;

        if (!particular || !amount || parseFloat(amount) <= 0) {
            return NextResponse.json(
                { success: false, message: "Particular and positive amount are required" },
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

            const result = await prisma.$transaction(async (tx) => {
                const expense = await tx.vardhiExpense.create({
                    data: {
                        vardhi_id,
                        company_id: company.company_id,
                        particular,
                        amount: new Prisma.Decimal(amount),
                    },
                });

                await recalculateVardhiTotals(tx, vardhi_id);

                return expense;
            });

            return NextResponse.json(
                successResponse('Expense added successfully', result)
            );
        });

        return response;

    } catch (error: any) {
        console.error('Error creating expense:', error);
        return NextResponse.json(
            errorResponse(error.message || 'Failed to create expense'),
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
        const expenseId = searchParams.get('expenseId');

        if (!expenseId) {
            return NextResponse.json(
                { success: false, message: "Expense ID is required" },
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
                await tx.vardhiExpense.delete({
                    where: { id: expenseId },
                });

                await recalculateVardhiTotals(tx, vardhi_id);
            });

            return NextResponse.json(
                successResponse('Expense deleted successfully')
            );
        });

        return response;

    } catch (error: any) {
        console.error('Error deleting expense:', error);
        return NextResponse.json(
            errorResponse(error.message || 'Failed to delete expense'),
            { status: 500 }
        );
    }
}
