import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { cashTransactionSchema } from '@/lib/validations/bank-cash';
import { Decimal } from '@prisma/client/runtime/library';
import { getServerSession, authOptions } from '@/lib/auth';
import { AccountingValidator } from '@/lib/accounting/validator';
import { createNotification } from '@/lib/notification-service';

async function getUserId(): Promise<string | undefined> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.id;
}

async function calculateRunningBalance(accountId: string): Promise<Decimal> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
  });

  const openingBalance = new Decimal(account?.opening_balance?.toNumber() || 0);

  const lastTransaction = await prisma.cashBookTransaction.findFirst({
    where: {
      account_id: accountId,
      is_deleted: false,
    },
    orderBy: [
      { transaction_date: 'desc' },
      { sr_no: 'desc' },
    ],
  });

  return lastTransaction ? new Decimal(lastTransaction.balance.toNumber()) : openingBalance;
}

async function recalculateCashBalances(accountId: string, companyId: string) {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
  });

  const openingBalance = new Decimal(account?.opening_balance?.toNumber() || 0);

  const transactions = await prisma.cashBookTransaction.findMany({
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

    await prisma.cashBookTransaction.update({
      where: { id: transaction.id },
      data: { balance: runningBalance },
    });
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    return await withCompany(async (company) => {
      const transaction = await prisma.cashBookTransaction.findFirst({
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
          { success: false, message: 'Cash transaction not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Cash transaction fetched successfully',
        data: transaction,
      });
    });
  } catch (error) {
    console.error('Error fetching cash transaction:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch cash transaction' },
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
    const validatedData = await cashTransactionSchema.validate(body, { abortEarly: false });

    const accountId = validatedData.account_id || validatedData.cash_book_id;
    if (!accountId) {
      return NextResponse.json(
        { success: false, message: 'Cash account is required' },
        { status: 400 }
      );
    }

    const userId = await getUserId();

    return await withCompany(async (company) => {
      if (!company?.company_id) {
        return NextResponse.json(
          { success: false, message: 'Company context is required' },
          { status: 400 }
        );
      }

      const existingTransaction = await prisma.cashBookTransaction.findFirst({
        where: {
          id,
          company_id: company.company_id,
        },
      });

      if (!existingTransaction) {
        return NextResponse.json(
          { success: false, message: 'Cash transaction not found' },
          { status: 404 }
        );
      }

      const transactionType = validatedData.transaction_type || 'DEBIT';
      const debitInput = new Decimal((validatedData as any).debit_amount || 0);
      const creditInput = new Decimal((validatedData as any).credit_amount || 0);
      const amount = (validatedData as any).amount 
        ? new Decimal((validatedData as any).amount || 0)
        : (transactionType === 'CREDIT' ? creditInput : debitInput);

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

      const accountCurrentBalance = await AccountingValidator.getAccountCurrentBalance(accountId, company!.company_id);
      if (transactionType === 'DEBIT' && amount.toNumber() > accountCurrentBalance) {
        return NextResponse.json(
          { success: false, message: `Insufficient cash balance. Available: ₹${accountCurrentBalance.toLocaleString('en-IN')}, Requested: ₹${amount.toNumber().toLocaleString('en-IN')}` },
          { status: 400 }
        );
      }

      const balance = await calculateRunningBalance(accountId);

      const partyId = validatedData.party_id;

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
      let newBalance = balance;
      
      if (transactionType === 'DEBIT') {
        newBalance = balance.sub(debitAmount);
        if (newBalance.isNegative() || newBalance.isZero()) {
          const currentBalance = balance.toNumber();
          return NextResponse.json(
            { success: false, message: `Insufficient cash balance. Available: ₹${currentBalance.toLocaleString('en-IN')}, Requested: ₹${amount.toNumber().toLocaleString('en-IN')}` },
            { status: 400 }
          );
        }
      } else {
        newBalance = balance.add(creditAmount);
      }

      const transaction = await prisma.cashBookTransaction.update({
        where: { id },
        data: {
          transaction_date: validatedData.transaction_date,
          transaction_type: transactionType,
          ledger: validatedData.ledger,
          project_id: validatedData.project_id,
          party_id: validatedData.party_id,
          particular: (validatedData as any).particular,
          amount: amount,
          credit_amount: creditAmount,
          debit_amount: debitAmount,
          balance: newBalance,
          updated_by: userId,
        },
      });

      await recalculateCashBalances(accountId, company!.company_id);

      if (validatedData.party_id) {
        await AccountingValidator.updatePartyCurrentBalance(validatedData.party_id, company!.company_id);
      }
      await AccountingValidator.updateAccountCurrentBalance(accountId, company!.company_id);

      const completeTransaction = await prisma.cashBookTransaction.findUnique({
        where: { id: transaction.id },
        include: {
          account: true,
          project: true,
          party: true,
        },
      });

      const session = await getServerSession(authOptions);
      const userName = (session?.user as any)?.name || 'A user';
      const accountName = completeTransaction?.account?.account_name || completeTransaction?.account?.cash_name || 'Unknown';
      const partyName = completeTransaction?.party?.name || 'Unknown';
      const particular = completeTransaction?.particular || 'N/A';
      const customMessage = `[CashTransaction] ${userName} (${accountName}) has Edited an amount from ${partyName}'s account. Reason: ${particular}`;
      await createNotification({
        action: 'Updated',
        entity: 'CashTransaction',
        entityId: id,
        userId: await getUserId(),
        link: `/cash-book`,
        message: customMessage,
      });

      return NextResponse.json({
        success: true,
        message: 'Cash transaction updated successfully',
        data: completeTransaction,
      });
    });
  } catch (error: any) {
    console.error('Error updating cash transaction:', error);
    if (error.name === 'ValidationError') {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'Failed to update cash transaction' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    return await withCompany(async (company) => {
      const existingTransaction = await prisma.cashBookTransaction.findFirst({
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
          { success: false, message: 'Cash transaction not found' },
          { status: 404 }
        );
      }

      const accountId = existingTransaction.account_id;

      await prisma.cashBookTransaction.update({
        where: { id },
        data: {
          is_deleted: true,
          deleted_at: new Date(),
        },
      });

      if (accountId) {
        await recalculateCashBalances(accountId, company!.company_id);
      }

      const partyId = existingTransaction.party_id;
      if (partyId) {
        await AccountingValidator.updatePartyCurrentBalance(partyId, company!.company_id);
      }
      if (accountId) {
        await AccountingValidator.updateAccountCurrentBalance(accountId, company!.company_id);
      }

      const session = await getServerSession(authOptions);
      const userName = (session?.user as any)?.name || 'A user';
      const accountName = existingTransaction.account?.account_name || existingTransaction.account?.cash_name || 'Unknown';
      const partyName = existingTransaction.party?.name || 'Unknown';
      const particular = existingTransaction.particular || 'N/A';
      const customMessage = `[CashTransaction] ${userName} (${accountName}) has Deleted an amount from ${partyName}'s account. Reason: ${particular}`;
      await createNotification({
        action: 'Deleted',
        entity: 'CashTransaction',
        entityId: id,
        userId: await getUserId(),
        link: `/cash-book`,
        message: customMessage,
      });

      return NextResponse.json({
        success: true,
        message: 'Cash transaction deleted successfully',
      });
    });
  } catch (error) {
    console.error('Error deleting cash transaction:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete cash transaction' },
      { status: 500 }
    );
  }
}
