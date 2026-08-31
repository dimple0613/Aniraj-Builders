import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const startDate = searchParams.get('start_date') || '';
        const endDate = searchParams.get('end_date') || '';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');

        const result = await withCompany(async (companyId) => {
            const tid = companyId?.company_id;
            if (!tid) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const where: any = { company_id: tid };

            if (startDate) {
                where.invoice_date = { ...(where.invoice_date || {}), gte: new Date(startDate) };
            }
            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                where.invoice_date = { ...(where.invoice_date || {}), lte: end };
            }

            if (search) {
                where.OR = [
                    { invoice_no: { contains: search, mode: 'insensitive' } },
                    { buyer_name: { contains: search, mode: 'insensitive' } },
                    { company_name: { contains: search, mode: 'insensitive' } },
                ];
            }

            const [data, total] = await Promise.all([
                prisma.vardhiInvoice.findMany({
                    where,
                    include: {
                        estimation: {
                            select: { work_name: true },
                        },
                    },
                    orderBy: { invoice_date: 'desc' },
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                prisma.vardhiInvoice.count({ where }),
            ]);

            const rows = data.map((invoice, index) => {
                const subtotal = Number(invoice.amount) * Number(invoice.quantity);
                const cgst = invoice.cgst_amount ? Number(invoice.cgst_amount) : 0;
                const sgst = invoice.sgst_amount ? Number(invoice.sgst_amount) : 0;
                const originalTotal = subtotal - cgst - sgst;
                const it = invoice.it_amount ? Number(invoice.it_amount) : 0;
                const labourCess = invoice.labour_cess_amount ? Number(invoice.labour_cess_amount) : 0;
                const cgstTds = invoice.cgst_tds_amount ? Number(invoice.cgst_tds_amount) : 0;
                const sgstTds = invoice.sgst_tds_amount ? Number(invoice.sgst_tds_amount) : 0;
                const deductions = it + labourCess + cgstTds + sgstTds;
                const netAmount = invoice.total_amount ? Number(invoice.total_amount) : (subtotal - deductions);

                return {
                    id: invoice.id,
                    srNo: (page - 1) * limit + index + 1,
                    partyName: invoice.buyer_name,
                    date: invoice.invoice_date,
                    invoiceNo: invoice.invoice_no,
                    workName: invoice.estimation?.work_name || invoice.description,
                    basicAmount: originalTotal,
                    cgst: cgst,
                    sgst: sgst,
                    total: subtotal,
                    deductionIt: it,
                    deductionLabourCess: labourCess,
                    deductionCgstTds: cgstTds,
                    deductionSgstTds: sgstTds,
                    totalDeductions: deductions,
                    netAmount: netAmount,
                };
            });

            return { data: rows, total };
        });

        if (result instanceof NextResponse) {
            return result;
        }

        return NextResponse.json(
            successResponse('Sales report fetched successfully', result.data, {
                page,
                limit,
                total: result.total,
                pages: Math.ceil(result.total / limit),
            })
        );
    } catch (error: any) {
        console.error('Error fetching sales report:', error);
        return NextResponse.json(
            errorResponse(error.message || 'Failed to fetch sales report'),
            { status: 500 }
        );
    }
}
