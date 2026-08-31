import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';

export async function GET() {
    try {
        const result = await withCompany(async (companyId) => {
            const company_id = companyId?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const estimations = await prisma.vardhiEstimation.findMany({
                where: { company_id },
                select: {
                    total_amount: true,
                    invoices: {
                        select: { total_amount: true },
                        take: 1,
                        orderBy: { created_at: 'desc' },
                    },
                },
            });

            let grandTotal = 0;
            estimations.forEach((item) => {
                const invoice = item.invoices?.[0];
                const amount = invoice?.total_amount
                    ? Number(invoice.total_amount)
                    : Number(item.total_amount || 0);
                grandTotal += amount;
            });

            return {
                grandTotal,
                count: estimations.length,
            };
        });

        if (result instanceof NextResponse) {
            return result;
        }

        return NextResponse.json(
            successResponse('Grand total fetched successfully', result)
        );
    } catch (error: any) {
        console.error('Error fetching grand total:', error);
        return NextResponse.json(
            errorResponse(error.message || 'Failed to fetch grand total'),
            { status: 500 }
        );
    }
}