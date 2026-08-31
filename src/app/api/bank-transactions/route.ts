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
        return {
            narration: 'General transaction',
        };
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
        BANK: { RECEIPT: 'Bank transfer in', PAYMENT: 'Bank transfer out' },
        CASH: { RECEIPT: 'Cash received', PAYMENT: 'Cash paid' },
        GENERAL: { RECEIPT: 'Receipt', PAYMENT: 'Payment' },
    };

    return {
        narration: narrations[ledgerType]?.[isReceipt ? 'RECEIPT' : 'PAYMENT'] || 'Transaction',
    };
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const accountId = searchParams.get('account_id');
        const projectId = searchParams.get('project_id');
        const partyId = searchParams.get('party_id');
        const ledgerType = searchParams.get('ledger_type');
        const transactionType = searchParams.get('transaction_type');
        const startDate = searchParams.get('start_date');
        const endDate = searchParams.get('end_date');
        const sortBy = searchParams.get('sortField') || 'transaction_date';
        const sortOrder = searchParams.get('sortOrder') || 'asc';

        return await withCompany(async (company) => {
            const where: any = {
                company_id: company?.company_id,
                is_deleted: false,
            };

            if (accountId) where.account_id = accountId;
            if (projectId) where.project_id = projectId;
            if (partyId) where.party_id = partyId;
            if (ledgerType) where.ledger_type = ledgerType;
            if (transactionType) where.transaction_type = transactionType;

            if (startDate || endDate) {
                where.transaction_date = {};
                if (startDate) where.transaction_date.gte = new Date(startDate);
                if (endDate) where.transaction_date.lte = new Date(endDate);
            }

            const skip = (page - 1) * limit;

            const [data, total] = await Promise.all([
                prisma.bankBookTransaction.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { [sortBy]: sortOrder },
                    include: {
                        account: true,
                        project: true,
                        party: true,
                    },
                }),
                prisma.bankBookTransaction.count({ where }),
            ]);

            return NextResponse.json({
                success: true,
                message: 'Bank transactions fetched successfully',
                data,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                },
            });
        });
    } catch (error) {
        console.error('Error fetching bank transactions:', error);
        if (error instanceof Error) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, message: 'Failed to fetch bank transactions' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
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

            const accountCurrentBalance = await AccountingValidator.getAccountCurrentBalance(accountId, company.company_id);

             const partyId = validatedData.party_id;

             // Payment (DEBIT): Account pays money to party → check account balance
             // Receipt (CREDIT): Account receives money from party → check party balance
             if (transactionType === 'DEBIT') {
               if (amount.toNumber() > accountCurrentBalance) {
                 return NextResponse.json(
                   { success: false, message: `Insufficient account balance. Available: ₹${accountCurrentBalance.toLocaleString('en-IN')}, Requested: ₹${amount.toNumber().toLocaleString('en-IN')}` },
                   { status: 400 }
                 );
               }
             } else if (partyId) {
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

            if (debitInput.gt(0) && creditInput.gt(0)) {
                return NextResponse.json(
                    { success: false, message: 'Cannot have both debit and credit amounts' },
                    { status: 400 }
                );
            }

            let debitAmount: Decimal;
            let creditAmount: Decimal;

            if (transactionType === 'CREDIT') {
                creditAmount = amount;
                debitAmount = new Decimal(0);
            } else {
                debitAmount = amount;
                creditAmount = new Decimal(0);
            }

            const balance = await calculateRunningBalance(accountId);
            let newBalance = balance;
            if (transactionType === 'CREDIT') {
                newBalance = balance.add(creditAmount);
            } else {
                newBalance = balance.sub(debitAmount);
            }

            const ledgerBehavior = getLedgerBehavior((validatedData as any).ledger_type, transactionType);

            const transaction = await prisma.bankBookTransaction.create({
                data: {
                    account_id: accountId,
                    company_id: company.company_id,
                    transaction_date: validatedData.transaction_date,
                    transaction_type: transactionType,
                    ledger: validatedData.ledger,
                    ledger_type: (validatedData as any).ledger_type,
                    project_id: validatedData.project_id,
                    party_id: validatedData.party_id,
                    against_reference: validatedData.against_reference,
                    narration: (validatedData as any).narration || ledgerBehavior.narration,
                    amount: amount,
                    credit_amount: creditAmount,
                    debit_amount: debitAmount,
                    balance: newBalance,
                } as any,
            });

            const completeTransaction = await prisma.bankBookTransaction.findUnique({
                where: { id: transaction.id },
                include: {
                    account: true,
                    project: true,
                    party: true,
                },
            });

            if (validatedData.party_id) {
                await AccountingValidator.updatePartyCurrentBalance(validatedData.party_id, company.company_id);
            }
            if (accountId) {
                await AccountingValidator.updateAccountCurrentBalance(accountId, company.company_id);
            }

            const session = await getServerSession(authOptions);
            const userName = (session?.user as any)?.name || 'A user';
            const accountName = completeTransaction?.account?.account_name || 'Unknown';
            const partyName = completeTransaction?.party?.name || 'Unknown';
            const narration = completeTransaction?.narration || 'N/A';
            const customMessage = `[BankTransaction] ${userName} (${accountName}) has Added an amount from ${partyName}'s account. Reason: ${narration}`;
            await createNotification({
                action: 'Created',
                entity: 'BankTransaction',
                entityId: transaction.id,
                userId: await getUserId(),
                link: `/bank-book`,
                message: customMessage,
            });

            return NextResponse.json({
                success: true,
                message: 'Bank transaction created successfully',
                data: completeTransaction,
            });
        });
    } catch (error: any) {
        console.error('Error creating bank transaction:', error);
        if (error.name === 'ValidationError') {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }
        if (error instanceof Error) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, message: 'Failed to create bank transaction' },
            { status: 500 }
        );
    }
}
