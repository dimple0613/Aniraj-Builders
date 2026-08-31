import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');

        const results = await withCompany(async (companyId) => {
            const where: any = {
                company_id: companyId?.company_id,
            };

            if (search) {
                where.OR = [
                    { invoice_no: { contains: search, mode: 'insensitive' } },
                    { buyer_name: { contains: search, mode: 'insensitive' } },
                    { company_name: { contains: search, mode: 'insensitive' } },
                    { remarks: { contains: search, mode: 'insensitive' } },
                ];
            }

            const [data, total] = await Promise.all([
                prisma.vardhiInvoice.findMany({
                    where,
                    include: {
                        estimation: {
                            select: {
                                id: true,
                                estimation_no: true,
                                contractor: true,
                                work_name: true,
                            }
                        },
                    },
                    orderBy: { created_at: 'desc' },
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                prisma.vardhiInvoice.count({ where }),
            ]);

            const serializedData = data.map((invoice) => ({
                ...invoice,
                quantity: Number(invoice.quantity),
                amount: Number(invoice.amount),
                cgst_amount: invoice.cgst_amount ? Number(invoice.cgst_amount) : null,
                sgst_amount: invoice.sgst_amount ? Number(invoice.sgst_amount) : null,
                it_amount: invoice.it_amount ? Number(invoice.it_amount) : null,
                labour_cess_amount: invoice.labour_cess_amount ? Number(invoice.labour_cess_amount) : null,
                cgst_tds_amount: invoice.cgst_tds_amount ? Number(invoice.cgst_tds_amount) : null,
                sgst_tds_amount: invoice.sgst_tds_amount ? Number(invoice.sgst_tds_amount) : null,
                add_deposit_amount: invoice.add_deposit_amount ? Number(invoice.add_deposit_amount) : null,
            }));

            return { data: serializedData, total };
        });

        if (results instanceof NextResponse) {
            return results;
        }

        return NextResponse.json(
            successResponse('Invoice records fetched successfully', results.data, {
                page,
                limit,
                total: results.total,
                pages: Math.ceil(results.total / limit),
            })
        );
    } catch (error: any) {
        console.error('Error fetching invoices:', error);
        const errorMessage = error.message || 'Failed to fetch invoices';
        return NextResponse.json(
            errorResponse(errorMessage),
            { status: error.message?.includes('COMPANY_CONTEXT_MISSING') ? 401 : 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        
        const result = await withCompany(async (companyId) => {
            const tid = companyId?.company_id;
            if (!tid) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const invoice = await prisma.vardhiInvoice.create({
                data: {
                    company_id: tid,
                    estimation_id: body.estimation_id,
                    invoice_no: body.invoice_no,
                    invoice_date: new Date(body.invoice_date),
                    dept_name: body.dept_name || null,
                    dept_bill_no: body.dept_bill_no || null,
                    dept_bill_date: body.dept_bill_date ? new Date(body.dept_bill_date) : null,
                    mb_no: body.mb_no || null,
                    mb_page_no: body.mb_page_no || null,
                    ra_bill_no: body.ra_bill_no || null,
                    remarks: body.remarks || null,
                    
                    company_name: body.company_name,
                    company_address: body.company_address || null,
                    company_gstin: body.company_gstin || null,
                    company_state: body.company_state || null,
                    company_state_code: body.company_state_code || null,
                    company_contact: body.company_contact || null,
                    
                    buyer_name: body.buyer_name,
                    buyer_address: body.buyer_address || null,
                    buyer_gstin: body.buyer_gstin || null,
                    buyer_state: body.buyer_state || null,
                    buyer_state_code: body.buyer_state_code || null,
                    
                    description: body.description,
                    hsn_sac: body.hsn_sac || null,
                    quantity: new Prisma.Decimal(body.quantity),
                    amount: new Prisma.Decimal(body.amount),
                    total_amount: body.netPayable !== undefined ? new Prisma.Decimal(body.netPayable) : undefined,
                    
                    cgst_percent: body.cgst_percent || null,
                    cgst_amount: body.cgst_amount ? new Prisma.Decimal(body.cgst_amount) : null,
                    sgst_percent: body.sgst_percent || null,
                    sgst_amount: body.sgst_amount ? new Prisma.Decimal(body.sgst_amount) : null,
                    it_percent: body.it_percent || null,
                    it_amount: body.it_amount ? new Prisma.Decimal(body.it_amount) : null,
                    labour_cess_percent: body.labour_cess_percent || null,
                    labour_cess_amount: body.labour_cess_amount ? new Prisma.Decimal(body.labour_cess_amount) : null,
                    cgst_tds_percent: body.cgst_tds_percent || null,
                    cgst_tds_amount: body.cgst_tds_amount ? new Prisma.Decimal(body.cgst_tds_amount) : null,
                    sgst_tds_percent: body.sgst_tds_percent || null,
                    sgst_tds_amount: body.sgst_tds_amount ? new Prisma.Decimal(body.sgst_tds_amount) : null,
                    add_deposit_percent: body.add_deposit_percent || null,
                    add_deposit_amount: body.add_deposit_amount ? new Prisma.Decimal(body.add_deposit_amount) : null,
                    
                    is_cgst_enabled: body.is_cgst_enabled ?? true,
                    is_sgst_enabled: body.is_sgst_enabled ?? true,
                    is_it_enabled: body.is_it_enabled ?? true,
                    is_labour_cess_enabled: body.is_labour_cess_enabled ?? true,
                    is_cgst_tds_enabled: body.is_cgst_tds_enabled ?? true,
                    is_sgst_tds_enabled: body.is_sgst_tds_enabled ?? true,
                    is_add_deposit_enabled: body.is_add_deposit_enabled ?? false,
                    
                    account_holder_name: body.account_holder_name || null,
                    bank_name: body.bank_name || null,
                    account_no: body.account_no || null,
                    branch_name: body.branch_name || null,
                    ifsc_code: body.ifsc_code || null,
                    swift_code: body.swift_code || null,
                },
            });

            const createdInvoice = await prisma.vardhiInvoice.findUnique({
                where: { id: invoice.id },
                include: {
                    estimation: {
                        select: {
                            id: true,
                            estimation_no: true,
                            contractor: true,
                            work_name: true,
                        }
                    },
                },
            });

            return {
                ...createdInvoice,
                quantity: Number(createdInvoice!.quantity),
                amount: Number(createdInvoice!.amount),
                cgst_amount: createdInvoice!.cgst_amount ? Number(createdInvoice!.cgst_amount) : null,
                sgst_amount: createdInvoice!.sgst_amount ? Number(createdInvoice!.sgst_amount) : null,
                it_amount: createdInvoice!.it_amount ? Number(createdInvoice!.it_amount) : null,
                labour_cess_amount: createdInvoice!.labour_cess_amount ? Number(createdInvoice!.labour_cess_amount) : null,
                cgst_tds_amount: createdInvoice!.cgst_tds_amount ? Number(createdInvoice!.cgst_tds_amount) : null,
                sgst_tds_amount: createdInvoice!.sgst_tds_amount ? Number(createdInvoice!.sgst_tds_amount) : null,
                add_deposit_amount: createdInvoice!.add_deposit_amount ? Number(createdInvoice!.add_deposit_amount) : null,
            };
        });

        if (result instanceof NextResponse) {
            return result;
        }

        return NextResponse.json(
            successResponse('Invoice created successfully', result),
            { status: 201 }
        );
    } catch (error: any) {
        console.error('Error creating invoice:', error);
        const errorMessage = error.message || 'Failed to create invoice';
        return NextResponse.json(
            errorResponse(errorMessage),
            { status: error.message?.includes('COMPANY_CONTEXT_MISSING') ? 401 : 500 }
        );
    }
}
