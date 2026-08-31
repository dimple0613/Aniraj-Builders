import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { unauthorizedResponse } from '@/lib/api-response';

export async function GET() {
    try {
        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const [totalEmployees, activePayrollRuns, pendingReimbursements, activeLoans, recentRuns] =
                await Promise.all([
                    prisma.employee.count({ where: { company_id } }),
                    prisma.payrollRun.count({
                        where: { company_id, status: { not: 'FINALIZED' } },
                    }),
                    prisma.reimbursementRequest.count({
                        where: { company_id, status: 'PENDING' },
                    }),
                    prisma.loan.count({
                        where: { company_id, status: 'ACTIVE' },
                    }),
                    prisma.payrollRun.findMany({
                        where: { company_id },
                        orderBy: { process_date: 'desc' },
                        take: 5,
                        include: {
                            financialYear: { select: { name: true } },
                            period: { select: { month: true, year: true } },
                        },
                    }),
                ]);

            return NextResponse.json({
                totalEmployees,
                activePayrollRuns,
                pendingReimbursements,
                activeLoans,
                recentRuns,
            });
        });
    } catch (error: any) {
        console.error('Error fetching payroll dashboard:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch dashboard data' },
            { status: 500 }
        );
    }
}
