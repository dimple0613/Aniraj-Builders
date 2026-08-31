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

const accountSchema = yup.object({
  type: yup.string().oneOf(['BANK', 'CASH']).required('Account type is required'),
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
    then: (schema) => schema.required('Account number is required for bank accounts').min(8, 'Account number must be at least 8 digits'),
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
  opening_balance: yup.number().required('Opening balance is required').min(0, 'Opening balance must be >= 0'),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const type = searchParams.get('type'); // BANK, CASH, or null for all
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
          { cash_name: { contains: search, mode: 'insensitive' } },
          { account_number: { contains: search, mode: 'insensitive' } },
          { bank_name: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (type) {
        where.type = type;
      }

      if (isActive !== null && isActive !== '') {
        where.is_active = isActive === 'true';
      }

      const skip = (page - 1) * limit;

      const [accounts, total] = await Promise.all([
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
        message: 'Accounts fetched successfully',
        data: accounts,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    });
  } catch (error) {
    console.error('Error fetching accounts:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const validation = await accountSchema.validate(body, { abortEarly: false })
      .catch(err => {
        const errorMessages = err.inner
          .map((issue: any) => `${issue.path}: ${issue.message}`)
          .join('; ');
        throw new Error(errorMessages);
      });

    const { type, account_name, cash_name, account_number, bank_name, ifsc_code, opening_balance } = validation;

    return await withCompany(async (company) => {
      // Check for duplicate based on type
      if (type === 'BANK') {
        const existingAccount = await prisma.account.findFirst({
          where: {
            company_id: company?.company_id,
            type: 'BANK',
            account_number: account_number,
          },
        });

        if (existingAccount) {
          return NextResponse.json(
            { success: false, message: 'Bank account with this number already exists' },
            { status: 400 }
          );
        }
      } else if (type === 'CASH') {
        const existingCash = await prisma.account.findFirst({
          where: {
            company_id: company?.company_id,
            type: 'CASH',
            cash_name: cash_name,
          },
        });

        if (existingCash) {
          return NextResponse.json(
            { success: false, message: 'Cash account with this name already exists' },
            { status: 400 }
          );
        }
      }

      const account = await prisma.account.create({
        data: {
          company_id: company?.company_id!,
          type,
          account_name: type === 'BANK' ? account_name : null,
          cash_name: type === 'CASH' ? cash_name : null,
          account_number: type === 'BANK' ? account_number : null,
          bank_name: type === 'BANK' ? bank_name : null,
          ifsc_code: type === 'BANK' ? ifsc_code : null,
          opening_balance,
          current_balance: opening_balance,
        } as any,
      });

      await createNotification({
        action: 'Created',
        entity: 'Account',
        entityId: account.id,
        entityName: account.account_name || account.cash_name || account.id,
        userId: await getUserId(),
        link: `/accounts`,
      });

      return NextResponse.json({
        success: true,
        message: 'Account created successfully',
        data: account,
      });
    });
  } catch (error: any) {
    console.error('Error creating account:', error);
    const message = error?.message || 'Failed to create account';
    const isValidationError = message.includes(':');
    return NextResponse.json(
      { success: false, message },
      { status: isValidationError ? 400 : 500 }
    );
  }
}