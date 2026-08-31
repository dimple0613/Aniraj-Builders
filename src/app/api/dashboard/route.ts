import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';

function serializePrisma(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  if (obj instanceof Date) return obj.toISOString();
  if (typeof obj === 'bigint') return obj.toString();
  if (typeof obj === 'object' && obj !== null) {
    // Handle Prisma Decimal
    if (obj._isDecimal || obj.constructor?.name === 'Decimal') {
      return parseFloat(obj.toString());
    }
    if (Array.isArray(obj)) {
      return obj.map(serializePrisma);
    }
    const result: any = {};
    for (const key of Object.keys(obj)) {
      result[key] = serializePrisma(obj[key]);
    }
    return result;
  }
  return obj;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'summary';

    return await withCompany(async (company) => {
      const companyId = company?.company_id!;

      if (type === 'summary') {
        const [
          totalProjects,
          activeProjects,
          totalParties,
          totalBankAccounts,
          pendingTasks,
        ] = await Promise.all([
          prisma.project.count({ where: { company_id: companyId } }),
          prisma.project.count({ where: { company_id: companyId, status: 'IN_PROGRESS' } }),
          prisma.party.count({ where: { company_id: companyId } }),
          prisma.account.count({ where: { company_id: companyId, type: 'BANK', is_active: true } }),
          prisma.task.count({ where: { company_id: companyId, status: 'PENDING' } }),
        ]);

        const recentTransactions = await prisma.bankBookTransaction.findMany({
          where: { company_id: companyId },
          take: 5,
          orderBy: { transaction_date: 'desc' },
          include: {
            account: true,
            party: true,
          },
        });

        const recentTasks = await prisma.task.findMany({
          where: { company_id: companyId },
          take: 5,
          orderBy: { createdAt: 'desc' },
        });

        return NextResponse.json({
          success: true,
          message: 'Dashboard summary fetched successfully',
          data: serializePrisma({
            stats: {
              totalProjects,
              activeProjects,
              totalParties,
              totalBankAccounts,
              pendingTasks,
            },
            recentTransactions,
            recentTasks,
          }),
        });
      }

      if (type === 'project-progress') {
        const projects = await prisma.project.findMany({
          where: { company_id: companyId },
          select: {
            id: true,
            name: true,
            status: true,
            budget: true,
            _count: {
              select: {
                purchaseEntries: true,
                statusTrackings: true,
              },
            },
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Project progress fetched successfully',
          data: projects,
        });
      }

      if (type === 'receivable-summary') {
        const receivables = await prisma.bankBookTransaction.groupBy({
          by: ['party_id'],
          where: {
            company_id: companyId,
            transaction_type: 'CREDIT',
            party_id: { not: null },
          },
          _sum: {
            credit_amount: true,
          },
        });

        const partyIds = receivables.map((r) => r.party_id).filter(Boolean) as string[];
        const parties = await prisma.party.findMany({
          where: { id: { in: partyIds } },
          select: { id: true, name: true },
        });

        const partyMap = new Map(parties.map((p) => [p.id, p.name]));

        return NextResponse.json({
          success: true,
          message: 'Receivable summary fetched successfully',
          data: receivables.map((r) => ({
            partyId: r.party_id,
            partyName: partyMap.get(r.party_id!) || 'Unknown',
            receivable: r._sum.credit_amount?.toNumber() || 0,
          })),
        });
      }

      if (type === 'payable-summary') {
        const payables = await prisma.bankBookTransaction.groupBy({
          by: ['party_id'],
          where: {
            company_id: companyId,
            transaction_type: 'DEBIT',
            party_id: { not: null },
          },
          _sum: {
            debit_amount: true,
          },
        });

        const partyIds = payables.map((p) => p.party_id).filter(Boolean) as string[];
        const parties = await prisma.party.findMany({
          where: { id: { in: partyIds } },
          select: { id: true, name: true },
        });

        const partyMap = new Map(parties.map((p) => [p.id, p.name]));

        return NextResponse.json({
          success: true,
          message: 'Payable summary fetched successfully',
          data: payables.map((p) => ({
            partyId: p.party_id,
            partyName: partyMap.get(p.party_id!) || 'Unknown',
            payable: p._sum.debit_amount?.toNumber() || 0,
          })),
        });
      }

      if (type === 'tasks') {
        const tasks = await prisma.task.findMany({
          where: { company_id: companyId },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });

        return NextResponse.json({
          success: true,
          message: 'Tasks fetched successfully',
          data: tasks,
        });
      }

      if (type === 'recent-bank-transactions') {
        const transactions = await prisma.bankBookTransaction.findMany({
          where: { company_id: companyId },
          take: 10,
          orderBy: { transaction_date: 'desc' },
          include: {
            account: true,
            party: true,
            project: true,
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Recent bank transactions fetched successfully',
          data: transactions,
        });
      }

      return NextResponse.json(
        { success: false, message: 'Invalid dashboard type' },
        { status: 400 }
      );
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'Failed to fetch dashboard data' },
      { status: 500 }
    );
  }
}
