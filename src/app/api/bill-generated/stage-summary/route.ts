import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';

const STAGE_KEYS = [
    'file_submitted',
    'store_report',
    'submitted_for_approved',
    'approved',
    'bill_prepaid',
    'bill_audit',
    'bill_account',
    'payment_received',
];

const STAGE_LABELS: Record<string, string> = {
    'file_submitted': 'File Created',
    'store_report': 'Store Report',
    'submitted_for_approved': 'Submitted for Approved',
    'approved': 'Approved',
    'bill_prepaid': 'Bill Prepaid',
    'bill_audit': 'Bill Audit',
    'bill_account': 'Bill Account',
    'payment_received': 'Payment Received',
};

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
                    current_stage: true,
                    total_amount: true,
                    invoices: {
                        select: { total_amount: true },
                        take: 1,
                        orderBy: { created_at: 'desc' },
                    },
                },
            });

            const summary: Record<string, { label: string; amount: number; count: number }> = {};

            STAGE_KEYS.forEach(key => {
                summary[key] = {
                    label: STAGE_LABELS[key],
                    amount: 0,
                    count: 0,
                };
            });

            estimations.forEach((item) => {
                const stage = item.current_stage;
                if (!stage || !summary[stage]) return;

                const invoice = item.invoices?.[0];
                const amount = invoice?.total_amount
                    ? Number(invoice.total_amount)
                    : Number(item.total_amount || 0);

                summary[stage] = {
                    label: STAGE_LABELS[stage] || stage,
                    amount: summary[stage].amount + amount,
                    count: summary[stage].count + 1,
                };
            });

            return STAGE_KEYS.map(key => ({
                key,
                ...summary[key],
            }));
        });

        if (result instanceof NextResponse) {
            return result;
        }

        return NextResponse.json(
            successResponse('Stage summary fetched successfully', result)
        );
    } catch (error: any) {
        console.error('Error fetching stage summary:', error);
        return NextResponse.json(
            errorResponse(error.message || 'Failed to fetch stage summary'),
            { status: 500 }
        );
    }
}
