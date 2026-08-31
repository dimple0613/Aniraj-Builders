import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { cashBookSchema } from '@/lib/validations/bank-cash';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    return await withCompany(async (company) => {
      const cashBook = await prisma.cashBook.findFirst({
        where: {
          id,
          company_id: company?.company_id,
        },
      });

      if (!cashBook) {
        return NextResponse.json(
          { success: false, message: 'Cash book not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'Cash book fetched successfully',
        data: cashBook,
      });
    });
  } catch (error) {
    console.error('Error fetching cash book:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch cash book' },
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
    const validatedData = await cashBookSchema.validate(body, { abortEarly: false });

    return await withCompany(async (company) => {
      if (!company?.company_id) {
        return NextResponse.json(
          { success: false, message: 'Company context is required' },
          { status: 400 }
        );
      }

      const existing = await prisma.cashBook.findFirst({
        where: {
          id,
          company_id: company.company_id,
        },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, message: 'Cash book not found' },
          { status: 404 }
        );
      }

      const duplicate = await prisma.cashBook.findFirst({
        where: {
          company_id: company.company_id,
          code: validatedData.code.toUpperCase(),
          id: { not: id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { success: false, message: 'Cash book with this code already exists' },
          { status: 400 }
        );
      }

      const cashBook = await prisma.cashBook.update({
        where: { id },
        data: {
          name: validatedData.name,
          code: validatedData.code.toUpperCase(),
          opening_balance: validatedData.opening_balance || 0,
          is_active: validatedData.is_active ?? true,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Cash book updated successfully',
        data: cashBook,
      });
    });
  } catch (error: any) {
    console.error('Error updating cash book:', error);
    if (error.name === 'ValidationError') {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'Failed to update cash book' },
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
      const existing = await prisma.cashBook.findFirst({
        where: {
          id,
          company_id: company?.company_id,
        },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, message: 'Cash book not found' },
          { status: 404 }
        );
      }

      // Check for existing transactions
      const transactionCount = await prisma.cashBookTransaction.count({
        where: { cash_book_id: id },
      });

      if (transactionCount > 0) {
        // Soft delete - just mark as inactive
        await prisma.cashBook.update({
          where: { id },
          data: { is_active: false },
        });
      } else {
        // Hard delete if no transactions
        await prisma.cashBook.delete({
          where: { id },
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Cash book deleted successfully',
      });
    });
  } catch (error) {
    console.error('Error deleting cash book:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete cash book' },
      { status: 500 }
    );
  }
}
