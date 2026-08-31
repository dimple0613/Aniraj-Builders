import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

async function getUserId(): Promise<string | undefined> {
    const session = await getServerSession(authOptions);
    return (session?.user as any)?.id;
}

const accountUpdateSchema = yup.object({
  type: yup.string().oneOf(['BANK', 'CASH']),
  account_name: yup.string().when('type', {
    is: 'BANK',
    then: (schema) => schema.required('Account name is required for bank accounts'),
    otherwise: (schema) => schema.nullable(),
  }),
  cash_name: yup.string().when('type', {
    is: 'CASH',
    then: (schema) => schema.required('Cash name is required for cash accounts'),
    otherwise: (schema) => schema.nullable(),
  }),
  account_number: yup.string().when('type', {
    is: 'BANK',
    then: (schema) => schema.required('Account number is required for bank accounts'),
    otherwise: (schema) => schema.nullable(),
  }),
  bank_name: yup.string().when('type', {
    is: 'BANK',
    then: (schema) => schema.required('Bank name is required for bank accounts'),
    otherwise: (schema) => schema.nullable(),
  }),
  ifsc_code: yup.string().when('type', {
    is: 'BANK',
    then: (schema) => schema.required('IFSC code is required for bank accounts').matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format'),
    otherwise: (schema) => schema.nullable(),
  }),
  opening_balance: yup.number().min(0, 'Opening balance must be >= 0'),
  is_active: yup.boolean(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    return await withCompany(async (company) => {
      const account = await prisma.account.findFirst({
        where: {
          id,
          company_id: company?.company_id,
        },
      });

      if (!account) {
        return NextResponse.json(
          { success: false, message: 'Account not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Account fetched successfully',
        data: account,
      });
    });
  } catch (error) {
    console.error('Error fetching account:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch account' },
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

    const validation = await accountUpdateSchema.validate(body, { abortEarly: false })
      .catch(err => {
        const errorMessages = err.inner
          .map((issue: any) => `${issue.path}: ${issue.message}`)
          .join('; ');
        throw new Error(errorMessages);
      });

    return await withCompany(async (company) => {
      const existingAccount = await prisma.account.findFirst({
        where: {
          id,
          company_id: company?.company_id,
        },
      });

      if (!existingAccount) {
        return NextResponse.json(
          { success: false, message: 'Account not found' },
          { status: 404 }
        );
      }

      const account = await prisma.account.update({
        where: { id },
        data: validation,
      });

      await createNotification({
        action: 'Updated',
        entity: 'Account',
        entityId: id,
        entityName: existingAccount.account_name || existingAccount.cash_name || id,
        userId: await getUserId(),
        link: `/accounts`,
      });

      return NextResponse.json({
        success: true,
        message: 'Account updated successfully',
        data: account,
      });
    });
  } catch (error: any) {
    console.error('Error updating account:', error);
    const message = error?.message || 'Failed to update account';
    const isValidationError = message.includes(':');
    return NextResponse.json(
      { success: false, message },
      { status: isValidationError ? 400 : 500 }
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
      const existingAccount = await prisma.account.findFirst({
        where: {
          id,
          company_id: company?.company_id,
        },
      });

      if (!existingAccount) {
        return NextResponse.json(
          { success: false, message: 'Account not found' },
          { status: 404 }
        );
      }

      const bankTransactionCount = await prisma.bankBookTransaction.count({
        where: { account_id: id, is_deleted: false },
      });

      const cashTransactionCount = await prisma.cashBookTransaction.count({
        where: { account_id: id, is_deleted: false },
      });

      const chequePrintCount = await prisma.chequePrint.count({
        where: { bank_account_id: id },
      });

      if (bankTransactionCount > 0 || cashTransactionCount > 0 || chequePrintCount > 0) {
        return NextResponse.json(
          { success: false, message: 'Cannot delete account with transactions' },
          { status: 400 }
        );
      }

      await prisma.account.delete({
        where: { id },
      });

      await createNotification({
        action: 'Deleted',
        entity: 'Account',
        entityId: id,
        entityName: existingAccount.account_name || existingAccount.cash_name || id,
        userId: await getUserId(),
        link: `/accounts`,
      });

      return NextResponse.json({
        success: true,
        message: 'Account deleted successfully',
      });
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete account' },
      { status: 500 }
    );
  }
}