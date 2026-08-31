import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const zoneId = searchParams.get('zone_id');
        const months = parseInt(searchParams.get('months') || '12');

        const startDate = new Date();
        startDate.setMonth(startDate.getMonth() - months);
        startDate.setDate(1);
        startDate.setHours(0, 0, 0, 0);

        const billingData = await withCompany(async (company: any) => {
            const companyId = company?.company_id;

            const whereClause: any = {
                invoice_date: {
                    gte: startDate,
                },
            };

            if (companyId) {
                whereClause.company_id = companyId;
            }

            const invoices = await (prisma as any).vardhiInvoice.findMany({
                where: whereClause,
                include: {
                    estimation: {
                        include: {
                            vardhis: {
                                select: {
                                    zone_id: true,
                                },
                                take: 1,
                            },
                        },
                    },
                },
                orderBy: {
                    invoice_date: 'asc',
                },
            });

            const monthlyData: Record<string, number> = {};

            for (let i = 0; i < months; i++) {
                const date = new Date();
                date.setMonth(date.getMonth() - i);
                const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                monthlyData[key] = 0;
            }

            invoices.forEach((invoice: any) => {
                const monthKey = `${invoice.invoice_date.getFullYear()}-${String(invoice.invoice_date.getMonth() + 1).padStart(2, '0')}`;
                
                if (monthlyData[monthKey] !== undefined) {
                    const zoneIdMatch = invoice.estimation?.vardhis?.[0]?.zone_id;
                    
                    if (!zoneId || zoneIdMatch === zoneId) {
                        monthlyData[monthKey] += Number(invoice.total_amount || 0);
                    }
                }
            });

            const result = Object.entries(monthlyData)
                .map(([month, amount]) => ({
                    date: month,
                    amount: Math.round(amount),
                    month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
                }))
                .reverse();

            return result;
        });

        return NextResponse.json({
            data: billingData,
        });
    } catch (error) {
        console.error('Error fetching billing data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch billing data' },
            { status: 500 }
        );
    }
}
