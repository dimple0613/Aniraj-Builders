import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { cashTransactionSchema, cashBookSchema } from '@/lib/validations/bank-cash';
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

// GET - Fetch cash transactions with filters
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const cashBookId = searchParams.get('account_id') || searchParams.get('cash_book_id');
    const projectId = searchParams.get('project_id');
    const partyId = searchParams.get('party_id');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const sortBy = searchParams.get('sortField') || 'transaction_date';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const includeDailySummary = searchParams.get('daily_summary') === 'true';

    return await withCompany(async (company) => {
      const where: any = {
        company_id: company?.company_id,
        is_deleted: false,
      };

      if (cashBookId) where.account_id = cashBookId;
      if (projectId) where.project_id = projectId;
      if (partyId) where.party_id = partyId;

      if (startDate || endDate) {
        where.transaction_date = {};
        if (startDate) where.transaction_date.gte = new Date(startDate);
        if (endDate) where.transaction_date.lte = new Date(endDate);
      }

      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        prisma.cashBookTransaction.findMany({
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
        prisma.cashBookTransaction.count({ where }),
      ]);

      let dailySummary: any[] = [];
      if (includeDailySummary && cashBookId) {
        const dailyData = await prisma.cashBookTransaction.groupBy({
          by: ['transaction_date'],
          where: {
            company_id: company?.company_id,
            account_id: cashBookId,
            is_deleted: false,
            ...(startDate || endDate ? {
              transaction_date: {
                ...(startDate ? { gte: new Date(startDate) } : {}),
                ...(endDate ? { lte: new Date(endDate) } : {}),
              }
            } : {}),
          },
          _sum: {
            credit_amount: true,
            debit_amount: true,
          },
          orderBy: { transaction_date: 'asc' },
        });

        dailySummary = dailyData.map((d) => ({
          date: d.transaction_date,
          totalReceipt: d._sum?.credit_amount?.toNumber() || 0,
          totalPayment: d._sum?.debit_amount?.toNumber() || 0,
          netFlow: (d._sum?.credit_amount?.toNumber() || 0) - (d._sum?.debit_amount?.toNumber() || 0),
        }));
      }

      const cashBooksBalance: Record<string, number> = {};
      if (cashBookId) {
        const balance = await calculateRunningBalance(cashBookId);
        cashBooksBalance[cashBookId] = balance.toNumber();
      }

      return NextResponse.json({
        success: true,
        message: 'Cash transactions fetched successfully',
        data,
        dailySummary,
        cashBooksBalance,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    });
  } catch (error) {
    console.error('Error fetching cash transactions:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'Failed to fetch cash transactions' },
      { status: 500 }
    );
  }
}

// POST - Create new cash transaction
export async function POST(request: NextRequest) {
  try {
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

      const account = await prisma.account.findFirst({
        where: { id: accountId, company_id: company.company_id },
      });

      if (!account) {
        return NextResponse.json(
          { success: false, message: 'Cash account not found' },
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
        creditAmount = creditInput.gt(0) ? creditInput : amount;
        debitAmount = new Decimal(0);
      } else {
        debitAmount = debitInput.gt(0) ? debitInput : amount;
        creditAmount = new Decimal(0);
      }

      const balance = await calculateRunningBalance(accountId);
      let newBalance = balance;
      if (transactionType === 'CREDIT') {
        newBalance = balance.add(creditAmount);
      } else {
        newBalance = balance.sub(debitAmount);
      }

      const lastTransaction = await prisma.cashBookTransaction.findFirst({
        where: { account_id: accountId },
        orderBy: { sr_no: 'desc' },
      });
      const srNo = (lastTransaction?.sr_no || 0) + 1;

      const transaction = await prisma.cashBookTransaction.create({
        data: {
          company_id: company.company_id,
          account_id: accountId,
          sr_no: srNo,
          transaction_date: validatedData.transaction_date,
          transaction_type: transactionType,
          ledger: validatedData.ledger,
          ledger_type: (validatedData as any).ledger_type,
          project_id: validatedData.project_id,
          party_id: validatedData.party_id,
          particular: (validatedData as any).particular,
          amount: amount,
          credit_amount: creditAmount,
          debit_amount: debitAmount,
          balance: newBalance,
          created_by: userId,
        } as any,
      });

      const completeTransaction = await prisma.cashBookTransaction.findUnique({
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
      const accountName = completeTransaction?.account?.account_name || completeTransaction?.account?.cash_name || 'Unknown';
      const partyName = completeTransaction?.party?.name || 'Unknown';
      const particular = completeTransaction?.particular || 'N/A';
      const customMessage = `[CashTransaction] ${userName} (${accountName}) has Added an amount from ${partyName}'s account. Reason: ${particular}`;
      await createNotification({
        action: 'Created',
        entity: 'CashTransaction',
        entityId: transaction.id,
        userId: await getUserId(),
        link: `/cash-book`,
        message: customMessage,
      });

      return NextResponse.json({
        success: true,
        message: 'Cash transaction created successfully',
        data: completeTransaction,
        newBalance: newBalance.toNumber(),
      });
    });
  } catch (error: any) {
    console.error('Error creating cash transaction:', error);
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
      { success: false, message: 'Failed to create cash transaction' },
      { status: 500 }
    );
  }
}
