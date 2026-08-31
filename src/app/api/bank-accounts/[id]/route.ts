import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { bankAccountSchema } from '@/lib/validations/bank-cash';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    return await withCompany(async (company) => {
      const account = await prisma.account.findFirst({
        where: {
          id,
          company_id: company?.company_id,
        },
      });

      if (!account) {
        return NextResponse.json(
          { success: false, message: 'Bank account not found' },
          { status: 404 }
        );
      }

      const where: any = {
        account_id: id,
        company_id: company?.company_id,
      };

      if (startDate || endDate) {
        where.transaction_date = {};
        if (startDate) where.transaction_date.gte = new Date(startDate);
        if (endDate) where.transaction_date.lte = new Date(endDate);
      }

      const skip = (page - 1) * limit;

      const [transactions, total] = await Promise.all([
        prisma.bankBookTransaction.findMany({
          where,
          skip,
          take: limit,
          orderBy: { transaction_date: 'desc' },
          include: {
            project: true,
            party: true,
          },
        }),
        prisma.bankBookTransaction.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        message: 'Bank account fetched successfully',
        data: {
          account,
          transactions,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      });
    });
  } catch (error) {
    console.error('Error fetching bank account:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'Failed to fetch bank account' },
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
    const validatedData = await bankAccountSchema.validate(body, { abortEarly: false });

    return await withCompany(async (company) => {
      const existingAccount = await prisma.account.findFirst({
        where: {
          id,
          company_id: company?.company_id,
        },
      });

      if (!existingAccount) {
        return NextResponse.json(
          { success: false, message: 'Bank account not found' },
          { status: 404 }
        );
      }

      const account = await prisma.account.update({
        where: { id },
        data: validatedData as any,
      });

      return NextResponse.json({
        success: true,
        message: 'Bank account updated successfully',
        data: account,
      });
    });
  } catch (error: any) {
    console.error('Error updating bank account:', error);
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
      { success: false, message: 'Failed to update bank account' },
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
      const existingAccount = await prisma.account.findFirst({
        where: {
          id,
          company_id: company?.company_id,
        },
      });

      if (!existingAccount) {
        return NextResponse.json(
          { success: false, message: 'Bank account not found' },
          { status: 404 }
        );
      }

      const transactionCount = await prisma.bankBookTransaction.count({
        where: { account_id: id },
      });

      if (transactionCount > 0) {
        return NextResponse.json(
          { success: false, message: 'Cannot delete account with transactions' },
          { status: 400 }
        );
      }

      await prisma.account.delete({
        where: { id },
      });

      return NextResponse.json({
        success: true,
        message: 'Bank account deleted successfully',
      });
    });
  } catch (error) {
    console.error('Error deleting bank account:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'Failed to delete bank account' },
      { status: 500 }
    );
  }
}
