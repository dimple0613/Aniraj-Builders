import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';
import { DEFAULT_LEDGERS, generateLedgerCode } from '@/lib/ledger-defaults';
import * as yup from 'yup';

async function getUserId(): Promise<string | undefined> {
  const session = await getServerSession(authOptions);
  return (session?.user as any)?.id;
}

const ledgerSchema = yup.object({
  name: yup.string().required('Ledger name is required').max(200),
  code: yup.string().nullable().optional(),
  include_expenses_activity: yup.boolean().default(false),
  show_in_cash_book: yup.boolean().default(false),
  show_in_bank_book: yup.boolean().default(false),
});

async function ensureDefaultLedgers(companyId: string) {
  const count = await prisma.ledger.count({ where: { company_id: companyId } });
  if (count > 0) return;

  for (const ledger of DEFAULT_LEDGERS) {
    await prisma.ledger.create({
      data: {
        company_id: companyId,
        name: ledger.name,
        code: ledger.code,
        include_expenses_activity: ledger.include_expenses_activity,
        show_in_cash_book: ledger.show_in_cash_book,
        show_in_bank_book: ledger.show_in_bank_book,
      },
    });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const module = searchParams.get('module'); // 'cash' | 'bank' | null for all
    const sortBy = searchParams.get('sortField') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    return await withCompany(async (company) => {
      const companyId = company?.company_id!;
      await ensureDefaultLedgers(companyId);

      const where: any = { company_id: companyId };

      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { code: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (module === 'cash') {
        where.show_in_cash_book = true;
      } else if (module === 'bank') {
        where.show_in_bank_book = true;
      }

      const skip = (page - 1) * limit;

      const [ledgers, total] = await Promise.all([
        prisma.ledger.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        prisma.ledger.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        message: 'Ledgers fetched successfully',
        data: ledgers,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    });
  } catch (error) {
    console.error('Error fetching ledgers:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'Failed to fetch ledgers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

      const code = validation.code
        ? validation.code.trim().toUpperCase()
        : generateLedgerCode(validation.name);

      if (!code) {
        return NextResponse.json(
          { success: false, message: 'Unable to generate a ledger code from the name' },
          { status: 400 }
        );
      }

      const existing = await prisma.ledger.findUnique({
        where: { company_id_code: { company_id: companyId, code } },
      });

      if (existing) {
        return NextResponse.json(
          { success: false, message: 'A ledger with this code already exists' },
          { status: 400 }
        );
      }

      const ledger = await prisma.ledger.create({
        data: {
          company_id: companyId,
          name: validation.name.trim(),
          code,
          include_expenses_activity: validation.include_expenses_activity,
          show_in_cash_book: validation.show_in_cash_book,
          show_in_bank_book: validation.show_in_bank_book,
        },
      });

      await createNotification({
        action: 'Created',
        entity: 'Ledger',
        entityId: ledger.id,
        entityName: ledger.name,
        userId: await getUserId(),
        link: `/cash-book`,
      });

      return NextResponse.json({
        success: true,
        message: 'Ledger created successfully',
        data: ledger,
      });
    });
  } catch (error: any) {
    console.error('Error creating ledger:', error);
    const message = error?.message || 'Failed to create ledger';
    const isValidationError = message.includes(':');
    return NextResponse.json(
      { success: false, message },
      { status: isValidationError ? 400 : 500 }
    );
  }
}