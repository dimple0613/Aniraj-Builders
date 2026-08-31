import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { Decimal } from '@prisma/client/runtime/library';

interface PaymentRequest {
    purchase_entry_id: string;
    amount: number;
    payment_type: 'BANK' | 'CASH';
    account_id: string;
}

async function validatePurchasePayment(
    companyId: string,
    purchaseEntryId: string,
    amount: number
): Promise<{ valid: boolean; error?: string; purchaseEntry?: any; paidAmount?: number }> {
    const purchaseEntry = await prisma.purchaseEntry.findFirst({
        where: {
            id: purchaseEntryId,
            company_id: companyId,
        },
        include: {
            materials: true,
        },
    });

    if (!purchaseEntry) {
        return { valid: false, error: 'Purchase entry not found' };
    }

    const materialTotal = purchaseEntry.materials.reduce(
        (sum: number, m: any) => sum + Number(m.total || 0),
        0
    );
    const purchaseTotal = materialTotal + Number(purchaseEntry.gst_total || 0);

    if (amount > purchaseTotal) {
        return {
            valid: false,
            error: `Payment amount (₹${amount.toLocaleString()}) exceeds purchase total (₹${purchaseTotal.toLocaleString()})`,
        };
    }

            const bankTransactions = await prisma.bankBookTransaction.findMany({
                where: {
                    company_id: companyId,
                    narration: {
                        contains: `Payment for Purchase Entry #${purchaseEntryId}`,
                    },
                    is_deleted: false,
                },
            });

            const cashTransactions = await prisma.cashBookTransaction.findMany({
                where: {
                    company_id: companyId,
                    particular: {
                        contains: `Payment for Purchase Entry #${purchaseEntryId}`,
                    },
                    is_deleted: false,
                },
            });

    const totalPaid = [...bankTransactions, ...cashTransactions].reduce(
        (sum: number, t: any) => sum + Number(t.debit_amount || 0),
        0
    );

    return {
        valid: true,
        purchaseEntry,
        paidAmount: totalPaid,
    };
}

export async function POST(request: NextRequest) {
    try {
        const body: PaymentRequest = await request.json();
        const { purchase_entry_id, amount, payment_type, account_id } = body;

        if (!purchase_entry_id) {
            return NextResponse.json(
                { success: false, message: 'Purchase entry ID is required' },
                { status: 400 }
            );
        }

        if (!amount || amount <= 0) {
            return NextResponse.json(
                { success: false, message: 'Payment amount must be greater than 0' },
                { status: 400 }
            );
        }

        if (!account_id) {
            return NextResponse.json(
                { success: false, message: 'Account ID is required' },
                { status: 400 }
            );
        }

        return await withCompany(async (company) => {
            const companyId = company?.company_id!;

            const account = await prisma.account.findFirst({
                where: {
                    id: account_id,
                    company_id: companyId,
                },
            });

            if (!account) {
                return NextResponse.json(
                    { success: false, message: 'Account not found' },
                    { status: 404 }
                );
            }

            if (account.type !== payment_type) {
                return NextResponse.json(
                    {
                        success: false,
                        message: `Invalid account type. Expected ${payment_type} account but got ${account.type}`
                    },
                    { status: 400 }
                );
            }

            const validation = await validatePurchasePayment(companyId, purchase_entry_id, amount);

            if (!validation.valid) {
                return NextResponse.json(
                    { success: false, message: validation.error },
                    { status: 400 }
                );
            }

            const materialTotal = validation.purchaseEntry!.materials.reduce(
                (sum: number, m: any) => sum + Number(m.total || 0),
                0
            );
            const purchaseTotal = materialTotal + Number(validation.purchaseEntry!.gst_total || 0);
            const totalPaid = (validation.paidAmount || 0) + amount;

            let paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
            if (totalPaid >= purchaseTotal) {
                paymentStatus = 'PAID';
            } else if (totalPaid > 0) {
                paymentStatus = 'PARTIAL';
            } else {
                paymentStatus = 'UNPAID';
            }

            await prisma.purchaseEntry.update({
                where: { id: purchase_entry_id },
                data: { payment_status: paymentStatus },
            });

            return NextResponse.json({
                success: true,
                message: 'Payment validated successfully',
                data: {
                    purchase_entry_id,
                    amount,
                    payment_type,
                    account_id,
                    purchase_total: purchaseTotal,
                    amount_paid: totalPaid,
                    status: paymentStatus,
                },
            });
        });
    } catch (error: any) {
        console.error('Error processing purchase payment:', error);
        if (error instanceof Error) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, message: 'Failed to process payment' },
            { status: 500 }
        );
    }
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const purchaseEntryId = searchParams.get('purchase_entry_id');

        if (!purchaseEntryId) {
            return NextResponse.json(
                { success: false, message: 'Purchase entry ID is required' },
                { status: 400 }
            );
        }

        return await withCompany(async (company) => {
            const companyId = company?.company_id!;

            const purchaseEntry = await prisma.purchaseEntry.findFirst({
                where: {
                    id: purchaseEntryId,
                    company_id: companyId,
                },
                include: {
                    materials: true,
                },
            });

            if (!purchaseEntry) {
                return NextResponse.json(
                    { success: false, message: 'Purchase entry not found' },
                    { status: 404 }
                );
            }

            const materialTotal = purchaseEntry.materials.reduce(
                (sum: number, m: any) => sum + Number(m.total || 0),
                0
            );
            const purchaseTotal = materialTotal + Number(purchaseEntry.gst_total || 0);

            const bankTransactions = await prisma.bankBookTransaction.findMany({
                where: {
                    company_id: companyId,
                    narration: {
                        contains: `Payment for Purchase Entry #${purchaseEntryId}`,
                    },
                    is_deleted: false,
                },
                include: {
                    account: true,
                },
            });

            const cashTransactions = await prisma.cashBookTransaction.findMany({
                where: {
                    company_id: companyId,
                    particular: {
                        contains: `Payment for Purchase Entry #${purchaseEntryId}`,
                    },
                    is_deleted: false,
                },
                include: {
                    account: true,
                },
            });

            const totalPaid = [...bankTransactions, ...cashTransactions].reduce(
                (sum: number, t: any) => sum + Number(t.debit_amount || 0),
                0
            );

            const balanceDue = Math.max(0, purchaseTotal - totalPaid);

            let paymentStatus: 'UNPAID' | 'PARTIAL' | 'PAID';
            if (totalPaid >= purchaseTotal) {
                paymentStatus = 'PAID';
            } else if (totalPaid > 0) {
                paymentStatus = 'PARTIAL';
            } else {
                paymentStatus = 'UNPAID';
            }

            return NextResponse.json({
                success: true,
                message: 'Payment status fetched successfully',
                data: {
                    purchase_entry: {
                        id: purchaseEntry.id,
                        entry_no: purchaseEntry.entry_no,
                        sr_no: purchaseEntry.sr_no,
                        purchase_total: purchaseTotal,
                    },
                    payments: {
                        bank: bankTransactions.map((t: any) => ({
                            id: t.id,
                            amount: Number(t.debit_amount),
                            date: t.transaction_date,
                            account: t.account?.account_name || t.account?.cash_name,
                            type: 'BANK',
                        })),
                        cash: cashTransactions.map((t: any) => ({
                            id: t.id,
                            amount: Number(t.debit_amount),
                            date: t.transaction_date,
                            account: t.account?.cash_name,
                            type: 'CASH',
                        })),
                    },
                    summary: {
                        total_paid: totalPaid,
                        balance_due: balanceDue,
                        status: paymentStatus,
                    },
                },
            });
        });
    } catch (error: any) {
        console.error('Error fetching payment status:', error);
        if (error instanceof Error) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, message: 'Failed to fetch payment status' },
            { status: 500 }
        );
    }
}
