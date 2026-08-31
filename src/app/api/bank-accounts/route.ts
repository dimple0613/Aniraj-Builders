import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { bankAccountSchema } from '@/lib/validations/bank-cash';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const isActive = searchParams.get('is_active');
    const sortBy = searchParams.get('sortField') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    return await withCompany(async (company) => {
      const where: any = {
        company_id: company?.company_id,
      };

      if (search) {
        where.OR = [
          { account_name: { contains: search, mode: 'insensitive' } },
          { account_number: { contains: search, mode: 'insensitive' } },
          { bank_name: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (isActive !== null && isActive !== '') {
        where.is_active = isActive === 'true';
      }

      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        prisma.account.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        prisma.account.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        message: 'Bank accounts fetched successfully',
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
    console.error('Error fetching bank accounts:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'Failed to fetch bank accounts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = await bankAccountSchema.validate(body, { abortEarly: false });

    return await withCompany(async (company) => {
      const accountDataWithCompany = { ...validatedData, company_id: company?.company_id };

      const existingAccount = await prisma.account.findFirst({
        where: {
          company_id: company?.company_id,
          type: 'BANK',
          account_number: validatedData.account_number,
        },
      });

      if (existingAccount) {
        return NextResponse.json(
          { success: false, message: 'Bank account with this number already exists' },
          { status: 400 }
        );
      }

      const account = await prisma.account.create({
        data: accountDataWithCompany as any,
      });

      return NextResponse.json({
        success: true,
        message: 'Bank account created successfully',
        data: account,
      });
    });
  } catch (error: any) {
    console.error('Error creating bank account:', error);
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
      { success: false, message: 'Failed to create bank account' },
      { status: 500 }
    );
  }
}
