import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { generateLedgerCode } from '@/lib/ledger-defaults';
import * as yup from 'yup';

const ledgerSchema = yup.object({
  name: yup.string().required('Ledger name is required').max(200),
  code: yup.string().nullable().optional(),
  include_expenses_activity: yup.boolean().default(false),
  show_in_cash_book: yup.boolean().default(false),
  show_in_bank_book: yup.boolean().default(false),
});

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    return await withCompany(async (company) => {
      const ledger = await prisma.ledger.findFirst({
        where: { id, company_id: company?.company_id },
      });

      if (!ledger) {
        return NextResponse.json(
          { success: false, message: 'Ledger not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Ledger fetched successfully',
        data: ledger,
      });
    });
  } catch (error) {
    console.error('Error fetching ledger:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'Failed to fetch ledger' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();

    const validation = await ledgerSchema.validate(body, { abortEarly: false })
      .catch(err => {
        const errorMessages = err.inner
          .map((issue: any) => `${issue.path}: ${issue.message}`)
          .join('; ');
        throw new Error(errorMessages);
      });

    return await withCompany(async (company) => {
      const companyId = company?.company_id!;

      const existing = await prisma.ledger.findFirst({
        where: { id, company_id: companyId },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, message: 'Ledger not found' },
          { status: 404 }
        );
      }

      const code = validation.code
        ? validation.code.trim().toUpperCase()
        : existing.code || generateLedgerCode(validation.name);

      if (!code) {
        return NextResponse.json(
          { success: false, message: 'Unable to generate a ledger code from the name' },
          { status: 400 }
        );
      }

      const duplicate = await prisma.ledger.findUnique({
        where: { company_id_code: { company_id: companyId, code } },
      });

      if (duplicate && duplicate.id !== id) {
        return NextResponse.json(
          { success: false, message: 'A ledger with this code already exists' },
          { status: 400 }
        );
      }

      const ledger = await prisma.ledger.update({
        where: { id },
        data: {
          name: validation.name.trim(),
          code,
          include_expenses_activity: validation.include_expenses_activity,
          show_in_cash_book: validation.show_in_cash_book,
          show_in_bank_book: validation.show_in_bank_book,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Ledger updated successfully',
        data: ledger,
      });
    });
  } catch (error: any) {
    console.error('Error updating ledger:', error);
    if (error?.name === 'ValidationError') {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    const message = error?.message || 'Failed to update ledger';
    const isValidationError = message.includes(':');
    return NextResponse.json(
      { success: false, message },
      { status: isValidationError ? 400 : 500 }
    );
  }
}

export async function DELETE(_: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    return await withCompany(async (company) => {
      const companyId = company?.company_id!;

      const ledger = await prisma.ledger.findFirst({
        where: { id, company_id: companyId },
      });

      if (!ledger) {
        return NextResponse.json(
          { success: false, message: 'Ledger not found' },
          { status: 404 }
        );
      }

      const [cashTxnCount, bankTxnCount] = await Promise.all([
        prisma.cashBookTransaction.count({
          where: { company_id: companyId, ledger: ledger.code, is_deleted: false },
        }),
        prisma.bankBookTransaction.count({
          where: { company_id: companyId, ledger: ledger.code, is_deleted: false },
        }),
      ]);

      if (cashTxnCount > 0 || bankTxnCount > 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Cannot delete ledger "${ledger.name}" because it is used in ${cashTxnCount} Cash Book and ${bankTxnCount} Bank Book transaction(s).`,
          },
          { status: 400 }
        );
      }

      await prisma.ledger.delete({ where: { id } });

      return NextResponse.json({
        success: true,
        message: 'Ledger deleted successfully',
      });
    });
  } catch (error) {
    console.error('Error deleting ledger:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'Failed to delete ledger' },
      { status: 500 }
    );
  }
}