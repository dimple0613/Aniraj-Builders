import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { formatIndianCurrency } from '@/lib/tax-utils';
import { notFound } from 'next/navigation';
import { formatDate } from '@/lib/financial-year';
import { Button } from '@/components/ui/button';
import { Printer, Download, Eye, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface Props {
    params: Promise<{ id: string }>;
}

export default async function VardhiInvoiceViewPage({ params }: Props) {
    const { id } = await params;

    const invoiceData = await withCompany(async (companyId) => {
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
        return invoice;
    });

    if (!invoiceData || invoiceData instanceof Response) {
        return notFound();
    }

    const invoice = {
        ...invoiceData,
        quantity: Number(invoiceData.quantity),
        amount: Number(invoiceData.amount),
        cgst_amount: invoiceData.cgst_amount ? Number(invoiceData.cgst_amount) : null,
        sgst_amount: invoiceData.sgst_amount ? Number(invoiceData.sgst_amount) : null,
        it_amount: invoiceData.it_amount ? Number(invoiceData.it_amount) : null,
        labour_cess_amount: invoiceData.labour_cess_amount ? Number(invoiceData.labour_cess_amount) : null,
        cgst_tds_amount: invoiceData.cgst_tds_amount ? Number(invoiceData.cgst_tds_amount) : null,
        sgst_tds_amount: invoiceData.sgst_tds_amount ? Number(invoiceData.sgst_tds_amount) : null,
        add_deposit_amount: invoiceData.add_deposit_amount ? Number(invoiceData.add_deposit_amount) : null,
    };

    const {
        invoice_no, invoice_date, dept_name, dept_bill_no, dept_bill_date,
        mb_no, mb_page_no, ra_bill_no, remarks,
        company_name, company_address, company_gstin, company_state, company_state_code, company_contact,
        buyer_name, buyer_address, buyer_gstin, buyer_state, buyer_state_code,
        description, hsn_sac, quantity, amount,
        cgst_percent, cgst_amount, sgst_percent, sgst_amount,
        it_percent, it_amount, labour_cess_percent, labour_cess_amount,
        cgst_tds_percent, cgst_tds_amount, sgst_tds_percent, sgst_tds_amount,
        add_deposit_percent, add_deposit_amount,
        is_cgst_enabled, is_sgst_enabled, is_it_enabled, is_labour_cess_enabled,
        is_cgst_tds_enabled, is_sgst_tds_enabled, is_add_deposit_enabled,
        account_holder_name, bank_name, account_no, branch_name, ifsc_code, swift_code
    } = invoice;

    const quantityNum = Number(quantity);
    const amountNum = Number(amount);
    const subtotal = amountNum * quantityNum;
    const cgst = is_cgst_enabled ? Number(cgst_amount) || 0 : 0;
    const sgst = is_sgst_enabled ? Number(sgst_amount) || 0 : 0;
    const grossTotal = subtotal + cgst + sgst;

    const it = is_it_enabled ? Number(it_amount) || 0 : 0;
    const labourCess = is_labour_cess_enabled ? Number(labour_cess_amount) || 0 : 0;
    const cgstTds = is_cgst_tds_enabled ? Number(cgst_tds_amount) || 0 : 0;
    const sgstTds = is_sgst_tds_enabled ? Number(sgst_tds_amount) || 0 : 0;
    const addDeposit = is_add_deposit_enabled ? Number(add_deposit_amount) || 0 : 0;

    const totalDeductions = Number((it + labourCess + cgstTds + sgstTds + addDeposit).toFixed(2));
    const netPayable = Number((grossTotal - totalDeductions).toFixed(2));

    return (
        <div className="bg-white min-h-screen p-0 md:p-8 font-serif text-slate-900 print:p-0">
            <div className="max-w-[21cm] mx-auto border-2 border-slate-900 p-8 shadow-2xl print:shadow-none print:border-none">

                {/* Header */}
                <div className="text-center mb-8 border-b-2 border-slate-900 pb-4">
                    <h1 className="text-4xl font-black uppercase tracking-tighter mb-1">Tax Invoice</h1>
                    <p className="text-sm font-bold opacity-60">(Original for Recipient)</p>
                </div>

                {/* Seller & Invoice Info */}
                <div className="grid grid-cols-2 border-b-2 border-slate-900">
                    <div className="p-4 border-r-2 border-slate-900">
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Seller Details</h2>
                        <div className="space-y-1">
                            <p className="text-xl font-black uppercase">{company_name}</p>
                            <p className="text-sm whitespace-pre-line leading-relaxed">{company_address}</p>
                            <p className="text-sm font-bold mt-2">GSTIN: <span className="font-mono text-base">{company_gstin}</span></p>
                            <p className="text-sm">State: {company_state} ({company_state_code})</p>
                            <p className="text-sm">Contact: {company_contact}</p>
                        </div>
                    </div>
                    <div className="p-4 bg-slate-50/50">
                        <div className="grid grid-cols-2 gap-y-3 text-sm">
                            <span className="font-bold">Invoice No:</span>
                            <span className="font-black font-mono">{invoice_no}</span>

                            <span className="font-bold">Invoice Date:</span>
                            <span>{formatDate(invoice_date)}</span>

                            <span className="font-bold">RA Bill No:</span>
                            <span className="font-bold">{ra_bill_no}</span>

                            <span className="font-bold">Dept:</span>
                            <span>{dept_name}</span>

                            {mb_no && (
                                <>
                                    <span className="font-bold">MB No:</span>
                                    <span>{mb_no} / {mb_page_no}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Buyer Info */}
                <div className="p-4 border-b-2 border-slate-900 bg-slate-100/30">
                    <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Buyer (Bill To)</h2>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p className="text-lg font-black uppercase">{buyer_name}</p>
                            <p className="text-sm leading-relaxed">{buyer_address}</p>
                        </div>
                        <div className="text-sm space-y-1 text-right md:text-left">
                            <p><span className="font-bold">GSTIN:</span> <span className="font-mono">{buyer_gstin}</span></p>
                            <p><span className="font-bold">State:</span> {buyer_state} ({buyer_state_code})</p>
                        </div>
                    </div>
                </div>

                {/* Items Table */}
                <table className="w-full border-collapse border-b-2 border-slate-900">
                    <thead>
                        <tr className="bg-slate-900 text-white text-xs uppercase tracking-widest">
                            <th className="p-3 text-left border-r border-slate-700 w-12 text-center">Sl</th>
                            <th className="p-3 text-left border-r border-slate-700">Description of Service</th>
                            <th className="p-3 text-center border-r border-slate-700">HSN</th>
                            <th className="p-3 text-center border-r border-slate-700">Qty</th>
                            <th className="p-3 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="text-sm">
                        <tr className="min-h-[200px]">
                            <td className="p-4 border-r-2 border-slate-900 align-top text-center font-bold">1</td>
                            <td className="p-4 border-r-2 border-slate-900 align-top">
                                <p className="font-black text-lg mb-2 uppercase">{description}</p>
                                <p className="text-xs text-slate-500 italic">As per estimation records and work completion reports.</p>
                            </td>
                            <td className="p-4 border-r-2 border-slate-900 align-top text-center font-mono">{hsn_sac}</td>
                            <td className="p-4 border-r-2 border-slate-900 align-top text-center font-bold">{quantity}</td>
                            <td className="p-4 align-top text-right font-black">₹{formatIndianCurrency(subtotal)}</td>
                        </tr>
                        <tr className="h-40">
                            <td className="border-r-2 border-slate-900"></td>
                            <td className="border-r-2 border-slate-900"></td>
                            <td className="border-r-2 border-slate-900"></td>
                            <td className="border-r-2 border-slate-900"></td>
                            <td></td>
                        </tr>
                    </tbody>
                </table>

                {/* Remarks Section */}
                {remarks && (
                    <div className="p-4 border-b-2 border-slate-900 bg-yellow-50">
                        <h2 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-2">Remarks</h2>
                        <p className="text-sm whitespace-pre-line">{remarks}</p>
                    </div>
                )}

                {/* Calculation & Bank */}
                <div className="grid grid-cols-2">
                    <div className="p-4 border-r-2 border-slate-900 space-y-4">
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Bank Details</h3>
                            <div className="text-[11px] space-y-1">
                                <p><span className="font-bold">A/c Name:</span> {account_holder_name}</p>
                                <p><span className="font-bold">Bank:</span> {bank_name}</p>
                                <p><span className="font-bold">A/c No:</span> <span className="font-mono text-sm">{account_no}</span></p>
                                <p><span className="font-bold">IFSC:</span> <span className="font-mono">{ifsc_code}</span></p>
                                {swift_code && <p><span className="font-bold">SWIFT:</span> {swift_code}</p>}
                            </div>
                        </div>

                        <div className="pt-8 text-center mt-auto">
                            <div className="h-16 w-32 border-b border-slate-300 mx-auto mb-2"></div>
                            <p className="text-[10px] font-black uppercase">Authorized Signatory</p>
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50/80">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span>Sub Total:</span>
                                <span className="font-bold">₹{formatIndianCurrency(subtotal)}</span>
                            </div>
                            {is_cgst_enabled && (
                                <div className="flex justify-between text-xs">
                                    <span>CGST ({cgst_percent}%):</span>
                                    <span>₹{formatIndianCurrency(cgst)}</span>
                                </div>
                            )}
                            {is_sgst_enabled && (
                                <div className="flex justify-between text-xs">
                                    <span>SGST ({sgst_percent}%):</span>
                                    <span>₹{formatIndianCurrency(sgst)}</span>
                                </div>
                            )}
                            <div className="flex justify-between border-y-2 border-slate-900 py-2 font-black text-base mt-2 bg-slate-900 text-white px-2">
                                <span>GROSS TOTAL:</span>
                                <span>₹{formatIndianCurrency(grossTotal)}</span>
                            </div>

                            <div className="py-2 space-y-1 opacity-80 border-b border-slate-200">
                                <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400">Deductions</h4>
                                {is_it_enabled && (
                                    <div className="flex justify-between text-xs">
                                        <span>Income Tax ({it_percent}%):</span>
                                        <span>- ₹{formatIndianCurrency(it)}</span>
                                    </div>
                                )}
                                {is_labour_cess_enabled && (
                                    <div className="flex justify-between text-xs">
                                        <span>Labour Cess ({labour_cess_percent}%):</span>
                                        <span>- ₹{formatIndianCurrency(labourCess)}</span>
                                    </div>
                                )}
                                {is_cgst_tds_enabled && (
                                    <div className="flex justify-between text-xs">
                                        <span>CGST (TDS) ({cgst_tds_percent}%):</span>
                                        <span>- ₹{formatIndianCurrency(cgstTds)}</span>
                                    </div>
                                )}
                                {is_sgst_tds_enabled && (
                                    <div className="flex justify-between text-xs">
                                        <span>SGST (TDS) ({sgst_tds_percent}%):</span>
                                        <span>- ₹{formatIndianCurrency(sgstTds)}</span>
                                    </div>
                                )}
                                {is_add_deposit_enabled && (
                                    <div className="flex justify-between text-xs">
                                        <span>Add. Deposit ({add_deposit_percent}%):</span>
                                        <span>- ₹{formatIndianCurrency(addDeposit)}</span>
                                    </div>
                                )}
                            </div>

                            <div className="flex justify-between pt-4 pb-2 font-black text-2xl">
                                <span className="text-sm self-end pb-1 opacity-60">NET PAYABLE:</span>
                                <span>₹{formatIndianCurrency(netPayable)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Message */}
                <div className="mt-8 text-[10px] text-center italic text-slate-400 border-t border-slate-100 pt-4">
                    This is a computer generated document and does not require a physical signature unless otherwise specified.
                </div>
            </div>

            {/* Print Button (Hidden in Print) */}
            <div className="fixed bottom-8 right-8 print:hidden flex gap-4">
                <Button variant="outline" size="lg" onClick={() => window.print()} className="shadow-lg border-blue-600 text-blue-600 hover:bg-blue-50">
                    <Printer className="h-5 w-5 mr-2" />
                    Print Invoice
                </Button>
            </div>
        </div>
    );
}
