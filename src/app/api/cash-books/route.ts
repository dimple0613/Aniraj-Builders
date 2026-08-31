import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { cashBookSchema } from '@/lib/validations/bank-cash';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');

    return await withCompany(async (company) => {
      const cashBooks = await prisma.cashBook.findMany({
        where: {
          company_id: company?.company_id,
          is_active: true,
        },
        take: limit,
        orderBy: { name: 'asc' },
      });

      return NextResponse.json({
        success: true,
        message: 'Cash books fetched successfully',
        data: cashBooks,
      });
    });
  } catch (error) {
    console.error('Error fetching cash books:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch cash books' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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
          company_id: company.company_id,
          code: validatedData.code.toUpperCase(),
        },
      });

      if (existing) {
        return NextResponse.json(
          { success: false, message: 'Cash book with this code already exists' },
          { status: 400 }
        );
      }

      const cashBook = await prisma.cashBook.create({
        data: {
          company_id: company.company_id,
          name: validatedData.name,
          code: validatedData.code.toUpperCase(),
          opening_balance: validatedData.opening_balance || 0,
          is_active: validatedData.is_active ?? true,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Cash book created successfully',
        data: cashBook,
      });
    });
  } catch (error: any) {
    console.error('Error creating cash book:', error);
    if (error.name === 'ValidationError') {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'Failed to create cash book' },
      { status: 500 }
    );
  }
}
