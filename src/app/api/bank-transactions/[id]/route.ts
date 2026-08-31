import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { bankTransactionSchema } from '@/lib/validations/bank-cash';
import { Decimal } from '@prisma/client/runtime/library';
import { getServerSession, authOptions } from '@/lib/auth';
import { AccountingValidator } from '@/lib/accounting/validator';
import { createNotification } from '@/lib/notification-service';

async function getUserId(): Promise<string | undefined> {
    const session = await getServerSession(authOptions);
    return (session?.user as any)?.id;
}

async function calculateRunningBalance(accountId: string, excludeTransactionId?: string): Promise<Decimal> {
    const account = await prisma.account.findUnique({
        where: { id: accountId },
    });

    const openingBalance = new Decimal(account?.opening_balance?.toNumber() || 0);

    const whereClause: any = {
        account_id: accountId,
        is_deleted: false,
    };

    if (excludeTransactionId) {
        whereClause.id = { not: excludeTransactionId };
    }

    const lastTransaction = await prisma.bankBookTransaction.findFirst({
        where: whereClause,
        orderBy: [
            { transaction_date: 'desc' },
            { sr_no: 'desc' },
        ],
    });

    return lastTransaction ? new Decimal(lastTransaction.balance.toNumber()) : openingBalance;
}

function getLedgerBehavior(ledgerType: string | undefined, transactionType: string) {
    const isReceipt = transactionType === 'CREDIT';

    if (!ledgerType) {
        return { narration: 'General transaction' };
    }

    const narrations: Record<string, { RECEIPT: string; PAYMENT: string }> = {
        SALES: { RECEIPT: 'Received against sales invoice', PAYMENT: 'Sales refund' },
        PURCHASE: { RECEIPT: 'Purchase return', PAYMENT: 'Payment against purchase' },
        TENDER_EMD: { RECEIPT: 'EMD Received', PAYMENT: 'EMD Refunded/Forfeited' },
        TENDER_FEE: { RECEIPT: 'Tender fee received', PAYMENT: 'Tender fee paid' },
        BILL_DEDUCTION: { RECEIPT: 'Bill deduction received', PAYMENT: 'Bill deduction returned' },
        EXPENSE: { RECEIPT: 'Expense refund', PAYMENT: 'Expense payment' },
        INCOME: { RECEIPT: 'Income received', PAYMENT: 'Income returned' },
        RECEIVABLE: { RECEIPT: 'Receivable received', PAYMENT: 'Receivable adjusted' },
        PAYABLE: { RECEIPT: 'Payable adjusted', PAYMENT: 'Payment made' },
        GENERAL: { RECEIPT: 'Receipt', PAYMENT: 'Payment' },
    };

    return {
        narration: narrations[ledgerType]?.[isReceipt ? 'RECEIPT' : 'PAYMENT'] || 'Transaction',
    };
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        return await withCompany(async (company) => {
            const transaction = await prisma.bankBookTransaction.findFirst({
                where: {
                    id,
                    company_id: company?.company_id,
                },
                include: {
                    account: true,
                    project: true,
                    party: true,
                },
            });

            if (!transaction) {
                return NextResponse.json(
                    { success: false, message: 'Bank transaction not found' },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                message: 'Bank transaction fetched successfully',
                data: transaction,
            });
        });
    } catch (error) {
        console.error('Error fetching bank transaction:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to fetch bank transaction' },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const validatedData = await bankTransactionSchema.validate(body, { abortEarly: false });

        if (!validatedData.account_id) {
            return NextResponse.json(
                { success: false, message: 'Account ID is required' },
                { status: 400 }
            );
        }

        const accountId = validatedData.account_id;
        const userId = await getUserId();

        return await withCompany(async (company) => {
            if (!company?.company_id) {
                return NextResponse.json(
                    { success: false, message: 'Company context is required' },
                    { status: 400 }
                );
            }

            const existingTransaction = await prisma.bankBookTransaction.findFirst({
                where: {
                    id,
                    company_id: company.company_id,
                },
            });

            if (!existingTransaction) {
                return NextResponse.json(
                    { success: false, message: 'Bank transaction not found' },
                    { status: 404 }
                );
            }

            const account = await prisma.account.findUnique({
                where: { id: accountId },
            });

            if (!account) {
                return NextResponse.json(
                    { success: false, message: 'Bank account not found' },
                    { status: 404 }
                );
            }

            const transactionType = validatedData.transaction_type || 'DEBIT';
            const debitInput = new Decimal((validatedData as any).debit_amount || 0);
            const creditInput = new Decimal((validatedData as any).credit_amount || 0);
            const amount = (validatedData as any).amount
                ? new Decimal((validatedData as any).amount || 0)
                : (transactionType === 'CREDIT' ? creditInput : debitInput);

            const accountCurrentBalance = await AccountingValidator.getAccountCurrentBalance(accountId, company!.company_id);
            const partyId = validatedData.party_id;

            // Receipt (CREDIT): Account pays money out → check account balance
            // Payment (DEBIT): Account receives money → check party balance
            if (transactionType === 'CREDIT') {
                if (amount.toNumber() > accountCurrentBalance) {
                    return NextResponse.json(
                        { success: false, message: `Insufficient account balance. Available: ₹${accountCurrentBalance.toLocaleString('en-IN')}, Requested: ₹${amount.toNumber().toLocaleString('en-IN')}` },
                        { status: 400 }
                    );
                }
            } else if (partyId) {
                const partyBalance = await AccountingValidator.getPartyCurrentBalanceFromDb(partyId, company!.company_id);
                const partyCurrentBalance = await AccountingValidator.getPartyCurrentBalance(partyId, company!.company_id);

                const validation = AccountingValidator.checkPartyBalance(
                    transactionType,
                    amount.toNumber(),
                    partyBalance.payable,
                    partyBalance.receivable,
                    partyCurrentBalance
                );

                if (!validation.valid) {
                    return NextResponse.json(
                        { success: false, message: validation.errors.join(', ') },
                        { status: 400 }
                    );
                }
            }

            if (debitInput.gt(0) && creditInput.gt(0)) {
                return NextResponse.json(
                    { success: false, message: 'Cannot have both debit and credit amounts' },
                    { status: 400 }
                );
            }

            let debitAmount: Decimal;
            let creditAmount: Decimal;

            if (transactionType === 'CREDIT') {
                creditAmount = creditInput.gt(0) ? creditInput : amount;
                debitAmount = new Decimal(0);
            } else {
                debitAmount = debitInput.gt(0) ? debitInput : amount;
                creditAmount = new Decimal(0);
            }

            
            if (partyId) {
                const partyBalance = await AccountingValidator.getPartyCurrentBalanceFromDb(partyId, company.company_id);
                const partyCurrentBalance = await AccountingValidator.getPartyCurrentBalance(partyId, company.company_id);

                const validation = AccountingValidator.checkPartyBalance(
                    transactionType,
                    amount.toNumber(),
                    partyBalance.payable,
                    partyBalance.receivable,
                    partyCurrentBalance
                );

                if (!validation.valid) {
                    return NextResponse.json(
                        { success: false, message: validation.errors.join(', ') },
                        { status: 400 }
                    );
                }
            }

            const balance = await calculateRunningBalance(accountId, id);
            let newBalance = balance;
            if (transactionType === 'DEBIT') {
                newBalance = balance.sub(debitAmount);
            } else {
                newBalance = balance.add(creditAmount);
            }

            const ledgerBehavior = getLedgerBehavior((validatedData as any).ledger_type, transactionType);

            const transaction = await prisma.bankBookTransaction.update({
                where: { id },
                data: {
                    transaction_date: validatedData.transaction_date,
                    transaction_type: transactionType,
                    ledger: validatedData.ledger,
                    project_id: validatedData.project_id,
                    party_id: validatedData.party_id,
                    against_reference: (validatedData as any).against_reference,
                    narration: ledgerBehavior.narration,
                    amount: amount,
                    credit_amount: creditAmount,
                    debit_amount: debitAmount,
                    balance: newBalance,
                    updated_by: userId,
                },
            });

            await recalculateBalances(accountId, company!.company_id);

            if (validatedData.party_id) {
                await AccountingValidator.updatePartyCurrentBalance(validatedData.party_id, company!.company_id);
            }
            await AccountingValidator.updateAccountCurrentBalance(accountId, company!.company_id);

            const completeTransaction = await prisma.bankBookTransaction.findUnique({
                where: { id: transaction.id },
                include: {
                    account: true,
                    project: true,
                    party: true,
                },
            });

            const session = await getServerSession(authOptions);
            const userName = (session?.user as any)?.name || 'A user';
            const accountName = completeTransaction?.account?.account_name || 'Unknown';
            const partyName = completeTransaction?.party?.name || 'Unknown';
            const narration = completeTransaction?.narration || 'N/A';
            const customMessage = `[BankTransaction] ${userName} (${accountName}) has Edited an amount from ${partyName}'s account. Reason: ${narration}`;
            await createNotification({
                action: 'Updated',
                entity: 'BankTransaction',
                entityId: id,
                userId: await getUserId(),
                link: `/bank-book`,
                message: customMessage,
            });

            return NextResponse.json({
                success: true,
                message: 'Bank transaction updated successfully',
                data: completeTransaction,
            });
        });
    } catch (error: any) {
        console.error('Error updating bank transaction:', error);
        if (error.name === 'ValidationError') {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, message: 'Failed to update bank transaction' },
            { status: 500 }
        );
    }
}

async function recalculateBalances(accountId: string, companyId: string) {
    const account = await prisma.account.findUnique({
        where: { id: accountId },
    });

    const openingBalance = new Decimal(account?.opening_balance?.toNumber() || 0);

    const transactions = await prisma.bankBookTransaction.findMany({
        where: {
            account_id: accountId,
            company_id: companyId,
            is_deleted: false,
        },
        orderBy: [
            { transaction_date: 'asc' },
            { sr_no: 'asc' },
        ],
    });

    let runningBalance = openingBalance;

    for (const transaction of transactions) {
        const creditAmount = new Decimal(transaction.credit_amount.toNumber());
        const debitAmount = new Decimal(transaction.debit_amount.toNumber());
        runningBalance = runningBalance.add(creditAmount).sub(debitAmount);

        await prisma.bankBookTransaction.update({
            where: { id: transaction.id },
            data: { balance: runningBalance },
        });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        return await withCompany(async (company) => {
            const existingTransaction = await prisma.bankBookTransaction.findFirst({
                where: {
                    id,
                    company_id: company?.company_id,
                },
                include: {
                    account: true,
                    party: true,
                },
            });

            if (!existingTransaction) {
                return NextResponse.json(
                    { success: false, message: 'Bank transaction not found' },
                    { status: 404 }
                );
            }

            const accountId = existingTransaction.account_id;

            await prisma.bankBookTransaction.update({
                where: { id },
                data: {
                    is_deleted: true,
                    deleted_at: new Date(),
                },
            });

            await recalculateBalances(accountId, company!.company_id);

            const partyId = existingTransaction.party_id;
            if (partyId) {
                await AccountingValidator.updatePartyCurrentBalance(partyId, company!.company_id);
            }
            await AccountingValidator.updateAccountCurrentBalance(accountId, company!.company_id);

            const session = await getServerSession(authOptions);
            const userName = (session?.user as any)?.name || 'A user';
            const accountName = existingTransaction.account?.account_name || 'Unknown';
            const partyName = existingTransaction.party?.name || 'Unknown';
            const narration = existingTransaction.narration || 'N/A';
            const customMessage = `[BankTransaction] ${userName} (${accountName}) has Deleted an amount from ${partyName}'s account. Reason: ${narration}`;
            await createNotification({
                action: 'Deleted',
                entity: 'BankTransaction',
                entityId: id,
                userId: await getUserId(),
                link: `/bank-book`,
                message: customMessage,
            });

            return NextResponse.json({
                success: true,
                message: 'Bank transaction deleted successfully',
            });
        });
    } catch (error) {
        console.error('Error deleting bank transaction:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to delete bank transaction' },
            { status: 500 }
        );
    }
}
