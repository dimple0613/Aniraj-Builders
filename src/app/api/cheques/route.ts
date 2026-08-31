import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const transactionId = searchParams.get('transaction_id');

    return await withCompany(async (company) => {
      const companyId = company?.company_id!;

      if (!transactionId) {
        return NextResponse.json(
          { success: false, message: 'Transaction ID is required' },
          { status: 400 }
        );
      }

      const transaction = await prisma.bankBookTransaction.findFirst({
        where: {
          id: transactionId,
          company_id: companyId,
        },
        include: {
          party: true,
          project: true,
          account: true,
        },
      });

      if (!transaction) {
        return NextResponse.json(
          { success: false, message: 'Transaction not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: {
          id: transaction.id,
          transaction_date: transaction.transaction_date,
          debit_amount: transaction.debit_amount.toNumber(),
          party_name: transaction.party?.name || '',
          party_address: transaction.party?.address || '',
          party_bank: '',
          party_account: '',
          project_name: transaction.project?.name || '',
          reference: transaction.against_reference || '',
          account_name: transaction.account?.account_name || '',
          account_number: transaction.account?.account_number || '',
          bank_name: transaction.account?.bank_name || '',
          ledger: transaction.ledger,
        },
      });
    });
  } catch (error) {
    console.error('Error fetching cheque data:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch cheque data' },
      { status: 500 }
    );
  }
}
