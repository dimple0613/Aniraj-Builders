import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { Prisma } from '@prisma/client';

interface Props {
    params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Props) {
    try {
        const { id } = await params;

        const result = await withCompany(async (companyId) => {
            const invoice = await prisma.vardhiInvoice.findFirst({
                where: {
                    id,
                    company_id: companyId?.company_id,
                },
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

            if (!invoice) {
                return NextResponse.json(
                    errorResponse('Invoice not found'),
                    { status: 404 }
                );
            }

            return {
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
            };
        });

        if (result instanceof NextResponse) {
            return result;
        }

        return NextResponse.json(
            successResponse('Invoice fetched successfully', result)
        );
    } catch (error: any) {
        console.error('Error fetching invoice:', error);
        const errorMessage = error.message || 'Failed to fetch invoice';
        return NextResponse.json(
            errorResponse(errorMessage),
            { status: error.message?.includes('COMPANY_CONTEXT_MISSING') ? 401 : 500 }
        );
    }
}

export async function PUT(request: NextRequest, { params }: Props) {
    try {
        const { id } = await params;
        const body = await request.json();

        const result = await withCompany(async (companyId) => {
            const tid = companyId?.company_id;
            if (!tid) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existingInvoice = await prisma.vardhiInvoice.findFirst({
                where: {
                    id,
                    company_id: tid,
                },
            });

            if (!existingInvoice) {
                return NextResponse.json(
                    errorResponse('Invoice not found'),
                    { status: 404 }
                );
            }

            const invoice = await prisma.vardhiInvoice.update({
                where: {
                    id,
                    company_id: tid,
                },
                data: {
                    invoice_date: body.invoice_date ? new Date(body.invoice_date) : undefined,
                    dept_name: body.dept_name !== undefined ? (body.dept_name || null) : undefined,
                    dept_bill_no: body.dept_bill_no !== undefined ? (body.dept_bill_no || null) : undefined,
                    dept_bill_date: body.dept_bill_date !== undefined ? (body.dept_bill_date ? new Date(body.dept_bill_date) : null) : undefined,
                    mb_no: body.mb_no !== undefined ? (body.mb_no || null) : undefined,
                    mb_page_no: body.mb_page_no !== undefined ? (body.mb_page_no || null) : undefined,
                    ra_bill_no: body.ra_bill_no !== undefined ? (body.ra_bill_no || null) : undefined,
                    remarks: body.remarks !== undefined ? (body.remarks || null) : undefined,
                    
                    company_name: body.company_name !== undefined ? body.company_name : undefined,
                    company_address: body.company_address !== undefined ? (body.company_address || null) : undefined,
                    company_gstin: body.company_gstin !== undefined ? (body.company_gstin || null) : undefined,
                    company_state: body.company_state !== undefined ? (body.company_state || null) : undefined,
                    company_state_code: body.company_state_code !== undefined ? (body.company_state_code || null) : undefined,
                    company_contact: body.company_contact !== undefined ? (body.company_contact || null) : undefined,
                    
                    buyer_name: body.buyer_name !== undefined ? body.buyer_name : undefined,
                    buyer_address: body.buyer_address !== undefined ? (body.buyer_address || null) : undefined,
                    buyer_gstin: body.buyer_gstin !== undefined ? (body.buyer_gstin || null) : undefined,
                    buyer_state: body.buyer_state !== undefined ? (body.buyer_state || null) : undefined,
                    buyer_state_code: body.buyer_state_code !== undefined ? (body.buyer_state_code || null) : undefined,
                    
                    description: body.description !== undefined ? body.description : undefined,
                    hsn_sac: body.hsn_sac !== undefined ? (body.hsn_sac || null) : undefined,
                    quantity: body.quantity !== undefined ? new Prisma.Decimal(body.quantity) : undefined,
                    amount: body.amount !== undefined ? new Prisma.Decimal(body.amount) : undefined,
                    total_amount: body.netPayable !== undefined ? new Prisma.Decimal(body.netPayable) : undefined,
                    
                    cgst_percent: body.cgst_percent !== undefined ? (body.cgst_percent || null) : undefined,
                    cgst_amount: body.cgst_amount !== undefined ? (body.cgst_amount ? new Prisma.Decimal(body.cgst_amount) : null) : undefined,
                    sgst_percent: body.sgst_percent !== undefined ? (body.sgst_percent || null) : undefined,
                    sgst_amount: body.sgst_amount !== undefined ? (body.sgst_amount ? new Prisma.Decimal(body.sgst_amount) : null) : undefined,
                    it_percent: body.it_percent !== undefined ? (body.it_percent || null) : undefined,
                    it_amount: body.it_amount !== undefined ? (body.it_amount ? new Prisma.Decimal(body.it_amount) : null) : undefined,
                    labour_cess_percent: body.labour_cess_percent !== undefined ? (body.labour_cess_percent || null) : undefined,
                    labour_cess_amount: body.labour_cess_amount !== undefined ? (body.labour_cess_amount ? new Prisma.Decimal(body.labour_cess_amount) : null) : undefined,
                    cgst_tds_percent: body.cgst_tds_percent !== undefined ? (body.cgst_tds_percent || null) : undefined,
                    cgst_tds_amount: body.cgst_tds_amount !== undefined ? (body.cgst_tds_amount ? new Prisma.Decimal(body.cgst_tds_amount) : null) : undefined,
                    sgst_tds_percent: body.sgst_tds_percent !== undefined ? (body.sgst_tds_percent || null) : undefined,
                    sgst_tds_amount: body.sgst_tds_amount !== undefined ? (body.sgst_tds_amount ? new Prisma.Decimal(body.sgst_tds_amount) : null) : undefined,
                    add_deposit_percent: body.add_deposit_percent !== undefined ? (body.add_deposit_percent || null) : undefined,
                    add_deposit_amount: body.add_deposit_amount !== undefined ? (body.add_deposit_amount ? new Prisma.Decimal(body.add_deposit_amount) : null) : undefined,
                    
                    is_cgst_enabled: body.is_cgst_enabled !== undefined ? body.is_cgst_enabled : undefined,
                    is_sgst_enabled: body.is_sgst_enabled !== undefined ? body.is_sgst_enabled : undefined,
                    is_it_enabled: body.is_it_enabled !== undefined ? body.is_it_enabled : undefined,
                    is_labour_cess_enabled: body.is_labour_cess_enabled !== undefined ? body.is_labour_cess_enabled : undefined,
                    is_cgst_tds_enabled: body.is_cgst_tds_enabled !== undefined ? body.is_cgst_tds_enabled : undefined,
                    is_sgst_tds_enabled: body.is_sgst_tds_enabled !== undefined ? body.is_sgst_tds_enabled : undefined,
                    is_add_deposit_enabled: body.is_add_deposit_enabled !== undefined ? body.is_add_deposit_enabled : undefined,
                    
                    account_holder_name: body.account_holder_name !== undefined ? (body.account_holder_name || null) : undefined,
                    bank_name: body.bank_name !== undefined ? (body.bank_name || null) : undefined,
                    account_no: body.account_no !== undefined ? (body.account_no || null) : undefined,
                    branch_name: body.branch_name !== undefined ? (body.branch_name || null) : undefined,
                    ifsc_code: body.ifsc_code !== undefined ? (body.ifsc_code || null) : undefined,
                    swift_code: body.swift_code !== undefined ? (body.swift_code || null) : undefined,
                },
            });

            const updatedInvoice = await prisma.vardhiInvoice.findUnique({
                where: { id },
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
                ...updatedInvoice,
                quantity: Number(updatedInvoice!.quantity),
                amount: Number(updatedInvoice!.amount),
                cgst_amount: updatedInvoice!.cgst_amount ? Number(updatedInvoice!.cgst_amount) : null,
                sgst_amount: updatedInvoice!.sgst_amount ? Number(updatedInvoice!.sgst_amount) : null,
                it_amount: updatedInvoice!.it_amount ? Number(updatedInvoice!.it_amount) : null,
                labour_cess_amount: updatedInvoice!.labour_cess_amount ? Number(updatedInvoice!.labour_cess_amount) : null,
                cgst_tds_amount: updatedInvoice!.cgst_tds_amount ? Number(updatedInvoice!.cgst_tds_amount) : null,
                sgst_tds_amount: updatedInvoice!.sgst_tds_amount ? Number(updatedInvoice!.sgst_tds_amount) : null,
                add_deposit_amount: updatedInvoice!.add_deposit_amount ? Number(updatedInvoice!.add_deposit_amount) : null,
            };
        });

        if (result instanceof NextResponse) {
            return result;
        }

        return NextResponse.json(
            successResponse('Invoice updated successfully', result)
        );
    } catch (error: any) {
        console.error('Error updating invoice:', error);
        const errorMessage = error.message || 'Failed to update invoice';
        return NextResponse.json(
            errorResponse(errorMessage),
            { status: error.message?.includes('COMPANY_CONTEXT_MISSING') ? 401 : 500 }
        );
    }
}

export async function DELETE(request: NextRequest, { params }: Props) {
    try {
        const { id } = await params;

        const result = await withCompany(async (companyId) => {
            const tid = companyId?.company_id;
            if (!tid) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existingInvoice = await prisma.vardhiInvoice.findFirst({
                where: {
                    id,
                    company_id: tid,
                },
            });

            if (!existingInvoice) {
                return NextResponse.json(
                    errorResponse('Invoice not found'),
                    { status: 404 }
                );
            }

            await prisma.vardhiInvoice.delete({
                where: {
                    id,
                    company_id: tid,
                },
            });

            return { success: true };
        });

        if (result instanceof NextResponse) {
            return result;
        }

        return NextResponse.json(
            successResponse('Invoice deleted successfully', result)
        );
    } catch (error: any) {
        console.error('Error deleting invoice:', error);
        const errorMessage = error.message || 'Failed to delete invoice';
        return NextResponse.json(
            errorResponse(errorMessage),
            { status: error.message?.includes('COMPANY_CONTEXT_MISSING') ? 401 : 500 }
        );
    }
}
