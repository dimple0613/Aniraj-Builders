import { puppeteerManager } from '@/lib/puppeteer-server';
import { prisma } from '@/lib/prisma';
import { formatIndianCurrency, numberToWords } from './financial-year';
import { calculateTaxAmount } from './tax-utils';



function formatDate(date?: Date | string): string {
    const d = date ? new Date(date) : new Date();

    if (isNaN(d.getTime())) return '';

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();

    return `${year}-${month}-${day}`;
}
interface InvoiceData {
    invoice_no: string;
    invoice_date: Date | string;
    dept_name: string | null;
    dept_bill_no: string | null;
    dept_bill_date: Date | string | null;
    mb_no: string | null;
    mb_page_no: string | null;
    ra_bill_no: string | null;
    remarks: string | null;
    company_name: string;
    company_address: string | null;
    company_gstin: string | null;
    company_state: string | null;
    company_state_code: string | null;
    company_contact: string | null;
    buyer_name: string;
    buyer_address: string | null;
    buyer_gstin: string | null;
    buyer_state: string | null;
    buyer_state_code: string | null;
    description: string;
    hsn_sac: string | null;
    quantity: number;
    amount: number;
    cgst_percent: number | null;
    cgst_amount: number | null;
    sgst_percent: number | null;
    sgst_amount: number | null;
    it_percent: number | null;
    it_amount: number | null;
    labour_cess_percent: number | null;
    labour_cess_amount: number | null;
    cgst_tds_percent: number | null;
    cgst_tds_amount: number | null;
    sgst_tds_percent: number | null;
    sgst_tds_amount: number | null;
    add_deposit_percent: number | null;
    add_deposit_amount: number | null;
    is_cgst_enabled: boolean;
    is_sgst_enabled: boolean;
    is_it_enabled: boolean;
    is_labour_cess_enabled: boolean;
    is_cgst_tds_enabled: boolean;
    is_sgst_tds_enabled: boolean;
    is_add_deposit_enabled: boolean;
    account_holder_name: string | null;
    bank_name: string | null;
    account_no: string | null;
    branch_name: string | null;
    ifsc_code: string | null;
    swift_code: string | null;
}

export async function getInvoiceDataByEstimationId(estimationId: string, companyId: string): Promise<InvoiceData> {
    const invoice = await prisma.vardhiInvoice.findFirst({
        where: {
            estimation_id: estimationId,
            company_id: companyId,
        },
    });

    if (invoice) {
        return {
            invoice_no: invoice.invoice_no,
            invoice_date: invoice.invoice_date,
            dept_name: invoice.dept_name,
            dept_bill_no: invoice.dept_bill_no,
            dept_bill_date: invoice.dept_bill_date,
            mb_no: invoice.mb_no,
            mb_page_no: invoice.mb_page_no,
            ra_bill_no: invoice.ra_bill_no,
            remarks: invoice.remarks,
            company_name: invoice.company_name,
            company_address: invoice.company_address,
            company_gstin: invoice.company_gstin,
            company_state: invoice.company_state,
            company_state_code: invoice.company_state_code,
            company_contact: invoice.company_contact,
            buyer_name: invoice.buyer_name,
            buyer_address: invoice.buyer_address,
            buyer_gstin: invoice.buyer_gstin,
            buyer_state: invoice.buyer_state,
            buyer_state_code: invoice.buyer_state_code,
            description: invoice.description,
            hsn_sac: invoice.hsn_sac,
            quantity: Number(invoice.quantity),
            amount: Number(invoice.amount),
            cgst_percent: invoice.cgst_percent,
            cgst_amount: invoice.cgst_amount ? Number(invoice.cgst_amount) : null,
            sgst_percent: invoice.sgst_percent,
            sgst_amount: invoice.sgst_amount ? Number(invoice.sgst_amount) : null,
            it_percent: invoice.it_percent,
            it_amount: invoice.it_amount ? Number(invoice.it_amount) : null,
            labour_cess_percent: invoice.labour_cess_percent,
            labour_cess_amount: invoice.labour_cess_amount ? Number(invoice.labour_cess_amount) : null,
            cgst_tds_percent: invoice.cgst_tds_percent,
            cgst_tds_amount: invoice.cgst_tds_amount ? Number(invoice.cgst_tds_amount) : null,
            sgst_tds_percent: invoice.sgst_tds_percent,
            sgst_tds_amount: invoice.sgst_tds_amount ? Number(invoice.sgst_tds_amount) : null,
            add_deposit_percent: invoice.add_deposit_percent,
            add_deposit_amount: invoice.add_deposit_amount ? Number(invoice.add_deposit_amount) : null,
            is_cgst_enabled: invoice.is_cgst_enabled,
            is_sgst_enabled: invoice.is_sgst_enabled,
            is_it_enabled: invoice.is_it_enabled,
            is_labour_cess_enabled: invoice.is_labour_cess_enabled,
            is_cgst_tds_enabled: invoice.is_cgst_tds_enabled,
            is_sgst_tds_enabled: invoice.is_sgst_tds_enabled,
            is_add_deposit_enabled: invoice.is_add_deposit_enabled,
            account_holder_name: invoice.account_holder_name,
            bank_name: invoice.bank_name,
            account_no: invoice.account_no,
            branch_name: invoice.branch_name,
            ifsc_code: invoice.ifsc_code,
            swift_code: invoice.swift_code,
        };
    }

    const estimation = await prisma.vardhiEstimation.findFirst({
        where: {
            id: estimationId,
            company_id: companyId,
        },
        include: {
            company: true,
        },
    });

    if (!estimation) {
        throw new Error('Estimation not found');
    }

    const company = estimation.company;
    const quantityNum = 1;
    const amountNum = Number(estimation.total_amount) || 0;
    const subtotal = amountNum * quantityNum;

    const cgstPercent = company.cgst_rate || 0;
    const sgstPercent = company.sgst_rate || 0;
    const itPercent = company.income_tax_rate || 0;
    const labourCessPercent = company.labour_cess_rate || 0;
    const cgstTdsPercent = company.cgst_tds_rate || 0;
    const sgstTdsPercent = company.sgst_tds_rate || 0;
    const addDepositPercent = company.additional_deposit || 0;

    const totalGstRate = cgstPercent + sgstPercent;
    const taxtotal = totalGstRate > 0
        ? subtotal - (100 / (100 + totalGstRate)) * subtotal
        : 0;
    const cgstAmount = sgstPercent > 0 ? Number((taxtotal / 2).toFixed(2)) : Number(taxtotal.toFixed(2));
    const sgstAmount = Number((taxtotal - cgstAmount).toFixed(2));
    const grossTotalVal = Number((subtotal - cgstAmount - sgstAmount).toFixed(2));

    const itAmount = (grossTotalVal * itPercent) / 100;
    const labourCessAmount = (grossTotalVal * labourCessPercent) / 100;
    const cgstTdsAmount = (grossTotalVal * cgstTdsPercent) / 100;
    const sgstTdsAmount = (grossTotalVal * sgstTdsPercent) / 100;
    const addDepositAmount = (grossTotalVal * addDepositPercent) / 100;

    return {
        invoice_no: '',
        invoice_date: new Date(),
        dept_name: null,
        dept_bill_no: null,
        dept_bill_date: null,
        mb_no: null,
        mb_page_no: null,
        ra_bill_no: null,
        remarks: null,
        company_name: company.company_name || '',
        company_address: company.address || null,
        company_gstin: company.gstin_uin || null,
        company_state: company.state_name || null,
        company_state_code: company.state_code || null,
        company_contact: company.contact || null,
        buyer_name: company.buyer_name || '',
        buyer_address: company.buyer_address || null,
        buyer_gstin: company.buyer_gstin_uin || null,
        buyer_state: company.buyer_state_name || null,
        buyer_state_code: company.buyer_state_code || null,
        description: estimation.work_name || '',
        hsn_sac: company.hsn_sac || null,
        quantity: quantityNum,
        amount: amountNum,
        cgst_percent: cgstPercent,
        cgst_amount: cgstAmount,
        sgst_percent: sgstPercent,
        sgst_amount: sgstAmount,
        it_percent: itPercent,
        it_amount: itAmount,
        labour_cess_percent: labourCessPercent,
        labour_cess_amount: labourCessAmount,
        cgst_tds_percent: cgstTdsPercent,
        cgst_tds_amount: cgstTdsAmount,
        sgst_tds_percent: sgstTdsPercent,
        sgst_tds_amount: sgstTdsAmount,
        add_deposit_percent: addDepositPercent,
        add_deposit_amount: addDepositAmount,
        is_cgst_enabled: true,
        is_sgst_enabled: true,
        is_it_enabled: true,
        is_labour_cess_enabled: true,
        is_cgst_tds_enabled: true,
        is_sgst_tds_enabled: true,
        is_add_deposit_enabled: false,
        account_holder_name: company.account_holder_name || null,
        bank_name: company.bank_name || null,
        account_no: company.account_no || null,
        branch_name: company.branch_name || null,
        ifsc_code: company.ifsc_code || null,
        swift_code: company.swift_code || null,
    };
}

export async function generateInvoicePDF(invoiceData: InvoiceData, origin: any): Promise<Buffer> {
    const {
        invoice_no, invoice_date, dept_name, dept_bill_no, dept_bill_date,
        mb_no, mb_page_no, ra_bill_no, remarks,
        company_name, company_address, company_gstin, company_state, company_state_code, company_contact,
        buyer_name, buyer_address, buyer_gstin, buyer_state, buyer_state_code,
        description, hsn_sac, quantity, amount,
        cgst_percent, cgst_amount, sgst_percent, sgst_amount,
        it_percent, labour_cess_percent,
        cgst_tds_percent, sgst_tds_percent,
        add_deposit_percent,
        is_cgst_enabled, is_sgst_enabled, is_it_enabled, is_labour_cess_enabled,
        is_cgst_tds_enabled, is_sgst_tds_enabled, is_add_deposit_enabled,
        account_holder_name, bank_name, account_no, branch_name, ifsc_code, swift_code
    } = invoiceData;

    const quantityNum = Number(quantity) || 1;
    const amountNum = Number(amount) || 0;
    const subtotal = amountNum * quantityNum;
    const cgst = Number((is_cgst_enabled ? Number(cgst_amount) || 0 : 0).toFixed(2));
    const sgst = Number((is_sgst_enabled ? Number(sgst_amount) || 0 : 0).toFixed(2));
    const grossTotal = Number((subtotal - cgst - sgst).toFixed(2));
    const taxtotal = cgst + sgst;

    const it = is_it_enabled ? calculateTaxAmount(grossTotal, Number(it_percent) || 0) : 0;
    const labourCess = is_labour_cess_enabled ? calculateTaxAmount(grossTotal, Number(labour_cess_percent) || 0) : 0;
    const cgstTds = is_cgst_tds_enabled ? calculateTaxAmount(grossTotal, Number(cgst_tds_percent) || 0) : 0;
    const sgstTds = is_sgst_tds_enabled ? calculateTaxAmount(grossTotal, Number(sgst_tds_percent) || 0) : 0;
    const addDeposit = is_add_deposit_enabled ? calculateTaxAmount(grossTotal, Number(add_deposit_percent) || 0) : 0;

    const totalDeductions = Number((it + labourCess + cgstTds + sgstTds + addDeposit).toFixed(2));
    const netPayable = Number((subtotal - totalDeductions).toFixed(2));
    const roundedNetAmount = Math.round(netPayable);

    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Invoice - ${invoice_no || 'Draft'}</title>
     <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
    <script src="https://cdn.tailwindcss.com"></script>
   
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 14px; }
        @page { size: A4; margin: 10mm; }
        html, body { width: 210mm; min-height: 297mm; }
        .border-right::before {
            content: "";
            border-right: 2px solid #e5e7eb;
            position: absolute;
            right: 0px;
            top: 0px;
            bottom: 0px;
        }
    </style>
</head>
<body>
    <div class="invoice-wrapper">
        <h2 class="text-[19px] text-center text-xl md:text-2xl font-semibold tracking-tight mb-[5px]">Tax Invoice </h2>
        <table>
            <tbody>
                <tr class="text-[12px] tracking-wider text-slate-700 text-left ">
                    <td class="border border-slate-300"  style="vertical-align:baseline" colSpan="3">
                        <div class="flex items-start p-1 border-slate-300 gap-1">
                            <!-- Left-side image -->
                            <div class="flex-shrink-0">
                                <img src="${origin}/logo.png" alt="Company Logo" class="w-20 h-20 object-cover rounded" />
                            </div>

                            <!-- Company info -->
                            <div>
                                <b >${company_name || ''}</b>
                                <br />
                                <p   style="white-space:break-spaces">${company_address || ''}</p>
                                GSTIN/UIN: ${company_gstin || ''}
                                <br />
                                State Name: ${company_state || ''}, Code: ${company_state_code || ''}
                                <br />
                                Contact: ${company_contact || ''}
                            </div>
                        </div>
                        <hr  style="margin-left:-1px;margin-right:-1px;border-bottom:1px" class="border-b border-slate-300" />
                        <div class="p-1 border-slate-300">
                            Buyer (Bill to) <br />
                            <b>${buyer_name || ''}</b><br />
                            <p  style="width:50%;white-space:break-spaces">${buyer_address || ''}</p>
                            GSTIN/UIN : ${buyer_gstin || ''}
                            <br />
                            State Name : ${buyer_state || ''}, Code : ${buyer_state_code || ''}
                        </div>
                    </td>
                    <td class="border border-slate-300" colSpan="5">
                        <div class="flex border-r border-slate-300">
                            <div style="width:50%" class="p-1 py-1 w-[50%] border-slate-300">
                                Invoice No.
                                <br />
                                <b>${invoice_no || ''}</b>
                            </div>
                            <div style="width:50%" class="p-1 py-1 w-[50%] border-l border-slate-300">
                                Dated
                                <br />
                                <b>${formatDate(invoice_date)}</b>
                            </div>
                        </div>
                        <hr  style="margin-left:-1px;margin-right:-1px;border-bottom:1px" class="border-b border-slate-300" />
                        <div class="p-1 py-1  border-r  border-slate-300">
                            Dept.Name : <b>${dept_name || ''}</b>
                        </div>
                        <hr  style="margin-left:-1px;margin-right:-1px;border-bottom:1px" class="border-b border-slate-300" />
                        <div class="p-1 py-1  border-r  border-slate-300">
                            Dept.Bill No. : <b>${(dept_bill_no || dept_bill_date)
            ? `${dept_bill_no || ''} ${dept_bill_date ? 'dt ' + formatDate(dept_bill_date) : ''}`
            : `dt ${formatDate()}`
        }</b>
                        </div>
                        <hr  style="margin-left:-1px;margin-right:-1px;border-bottom:1px" class="border-b border-slate-300" />
                        <div class="p-1 py-1  border-r  border-slate-300">
                            MB No. : <b>${mb_no || ''}</b>
                        </div>
                        <hr  style="margin-left:-1px;margin-right:-1px;border-bottom:1px" class="border-b border-slate-300" />
                        <div class="p-1 py-1  border-r border-slate-300">
                            MB Page No. : <b>${mb_page_no || ''}</b>
                        </div>
                        <hr  style="margin-left:-1px;margin-right:-1px;border-bottom:1px" class="border-b border-slate-300" />
                        <div class="p-1 py-1 border-r  border-slate-300">
                            RA Bill No. : <b>${ra_bill_no || ''}</b>
                        </div>
                        <hr style="margin-left:-1px;margin-right:-1px;border-bottom:1px" class="border-b border-slate-300" />
                        <div style="height:80px" class="p-1 border-r  py-1 border-slate-300 h-100px">
                            <p>Remarks : <b>${remarks || ''}</b></p>
                        </div>
                    </td>
                </tr>
                <tr class="bg-slate-100 text-[12px] tracking-wider text-slate-700 text-left">
                    <th class="p-1 border font-bold border-slate-300">Sl No.</th>
                    <th colSpan="3" class="p-1 border font-bold border-slate-300">
                        Description of Services
                    </th>
                    <th class="p-1 border font-bold text-center border-slate-300">HSN/SAC</th>
                    <th class="p-1 border font-bold text-center border-slate-300">Quantity</th>
                    <th class="border text-right">
                       <div class="p-1 border-r h-full  border-slate-300 "> Amount</div>
                    </th>
                </tr>
                <tr class="hover:bg-blue-50 transition-colors">
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground">
                        1
                    </td>
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground" colSpan="3">
                        <b>WORK CONTRACT</b> <br />
                        ${description || ''}
                    </td>
                    <td class="p-1 py-1 border text-center text-[12px] text-muted-foreground">
                        ${hsn_sac || ''}
                    </td>
                    <td class="p-1 py-1 border text-center text-[12px] text-muted-foreground">
                        ${quantityNum || '1'}
                    </td>
                    <td class="border text-right text-[13px] text-muted-foreground relative border-right">
                       <div class="p-1 font-bold border-slate-300 ">  <b>₹${formatIndianCurrency(grossTotal)}</b></div>
                    </td>
                </tr>
                
                ${is_cgst_enabled ? `
                <tr class="hover:bg-blue-50 transition-colors">
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground"></td>
                    <td class="p-1 py-1 border text-right text-[12px] text-muted-foreground" colSpan="3">
                        <b>CGST</b>
                    </td>
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground"></td>
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground"></td>
                    <td class=" border text-right text-[12px] text-muted-foreground">
                        <div class="p-1 h-full border-r  border-slate-300 "> <b>+ ₹${formatIndianCurrency(cgst)}</b></div>
                    </td>
                </tr>
                ` : ''}
                ${is_sgst_enabled ? `
                <tr class="hover:bg-blue-50 transition-colors">
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground"></td>
                    <td class="p-1 py-1 border text-right text-[12px] text-muted-foreground" colSpan="3">
                        <b>SGST</b>
                    </td>
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground"></td>
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground"></td>
                    <td class="border text-right text-[12px] text-muted-foreground">
                         <div class="p-1 h-full border-r  border-slate-300 "><b>+ ₹${formatIndianCurrency(sgst)}</b></div>
                    </td>
                </tr>
                ` : ''}
                <tr class="hover:bg-blue-50 bg-slate-200 transition-colors">
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground">
                        <p><br /></p>
                    </td>
                    <td colSpan="3" class="p-1 py-1 border text-right text-[12px] text-blue-600">
                        <b class="s4">Total</b>
                    </td>
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground">
                        <p><br /></p>
                    </td>
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground">
                        <p><br /></p>
                    </td>
                    <td class="border text-right text-[12px] text-blue-600">
                        <div class="p-1 h-full border-r border-slate-300"><b>₹${formatIndianCurrency(subtotal)}</b></div>
                    </td>
                </tr>
                <tr class=" hover:bg-blue-50 transition-colors">
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground">
                        <p><br /></p>
                    </td>
                    <td colSpan="3" class="p-1 py-1 border text-right text-[12px] text-red-600">
                        <b class="s4">Deduction</b>
                    </td>
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground">
                        <p><br /></p>
                    </td>
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground">
                        <p><br /></p>
                    </td>
                    <td class="text-right text-[12px]">
                      <div class="p-1 h-full border-r  border-slate-300 ">  <br /></div>
                    </td>
                </tr>
                ${is_it_enabled ? `
                <tr class="hover:bg-blue-50 transition-colors">
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground"></td>
                    <td class="p-1 py-1 border text-right text-[12px] text-muted-foreground" colSpan="3">
                        <b>Income Tax (${it_percent || 0}%):</b>
                    </td>
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground"></td>
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground"></td>
                    <td class="border text-right text-[12px] text-muted-foreground">
                        <div class="p-1 h-full border-r  border-slate-300 "> <b>- ₹${formatIndianCurrency(it)}</b></div>
                    </td>
                </tr>
                ` : ''}
                ${is_labour_cess_enabled ? `
                <tr class="hover:bg-blue-50 transition-colors">
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground"></td>
                    <td class="p-1 py-1 border text-right text-[12px] text-muted-foreground" colSpan="3">
                        <b>Labour Cess (${labour_cess_percent || 0}%):</b>
                    </td>
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground"></td>
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground"></td>
                    <td class="border text-right text-[12px] text-muted-foreground">
                         <div class="p-1 h-full border-r  border-slate-300 "><b>- ₹${formatIndianCurrency(labourCess)}</b></div>
                    </td>
                </tr>
                ` : ''}
                ${is_cgst_tds_enabled ? `
                <tr class="hover:bg-blue-50 transition-colors">
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground"></td>
                    <td class="p-1 py-1 border text-right text-[12px] text-muted-foreground" colSpan="3">
                        <b>CGST (TDS) (${cgst_tds_percent || 0}%):</b>
                    </td>
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground"></td>
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground"></td>
                    <td class="border text-right text-[12px] text-muted-foreground">
                         <div class="p-1 h-full border-r  border-slate-300 "><b>- ₹${formatIndianCurrency(cgstTds)}</b></div>
                    </td>
                </tr>
                ` : ''}
                ${is_sgst_tds_enabled ? `
                <tr class="hover:bg-blue-50 transition-colors">
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground"></td>
                    <td class="p-1 py-1 border text-right text-[12px] text-muted-foreground" colSpan="3">
                        <b>SGST (TDS) (${sgst_tds_percent || 0}%):</b>
                    </td>
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground"></td>
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground"></td>
                    <td class="border text-right text-[12px] text-muted-foreground">
                        <div class="p-1 h-full border-r  border-slate-300 "> <b>- ₹${formatIndianCurrency(sgstTds)}</b></div>
                    </td>
                </tr>
                ` : ''}
                ${is_add_deposit_enabled ? `
                <tr class="hover:bg-blue-50 transition-colors">
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground"></td>
                    <td class="p-1 py-1 border text-right text-[12px] text-muted-foreground" colSpan="3">
                        <b>Additional Deposit (${add_deposit_percent || 0}%):</b>
                    </td>
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground"></td>
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground"></td>
                    <td class="border text-right text-[12px] text-muted-foreground">
                         <div class="p-1 h-full border-r  border-slate-300 "><b>- ₹${formatIndianCurrency(addDeposit)}</b></div>
                    </td>
                </tr>
                ` : ''}
                <tr class="hover:bg-blue-50 bg-slate-200 transition-colors">
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground">
                        <p><br /></p>
                    </td>
                    <td colSpan="3" class="p-1 py-1 border text-right text-[12px] text-blue-600">
                        <b>Net Amount</b>
                    </td>
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground">
                        <p><br /></p>
                    </td>
                    <td class="p-1 py-1 border text-left text-[12px] text-muted-foreground">
                        <p><br /></p>
                    </td>
                    <td class="border text-right text-[12px] text-blue-600">
                         <div class="p-1 h-full border-r border-slate-300"><b>₹${roundedNetAmount.toLocaleString('en-IN')}</b></div>
                    </td>
                </tr>
                <tr>
                    <td colSpan="7" class="border text-left text-[12px] text-muted-foreground">
                     <div class="p-1 h-full border-r border-slate-300 ">
                        <p style="display:flex">
                        Amount Chargeable (in words)<i style="margin-left:auto;text-align:right"
                            >E. &amp; O.E</i
                        >
                        </p>
                        <b>${numberToWords(netPayable)}</b>
                        </div>
                    </td>
                </tr>
                <tr class="bg-slate-100  text-[12px] tracking-wider text-slate-700 text-left">
                    <td class="p-1 py-1 border font-bold border-slate-300 w-[8%]" rowSpan=2" style="text-align:center">
                        <b>HSN/SAC</b>
                    </td>
                    <td rowSpan=2" class="p-1 py-1 border font-bold border-slate-300 w-[18%]" style="text-align:center">
                        Taxable <br /> Value
                    </td>
                    <td colSpan="2" class="p-1 py-1 border font-bold border-slate-300 w-[18%]" style="text-align:center">
                        <b>CGST</b>
                    </td>
                    <td colSpan="2" class="p-1 py-1 border font-bold border-slate-300 w-[18%]" style="text-align:center">
                        <b>SGST/UTGST</b>
                    </td>
                    <td rowSpan=2" class="border font-bold border-slate-300 w-[18%]" style="text-align:center">
                        <div class="p-1 h-full border-r  border-slate-300 "> Total <br /> Tax Amount </div>
                    </td>
                </tr>
                <tr class="bg-slate-100 text-[12px] tracking-wider text-slate-700 text-center">
                    <td class="p-1 py-1 border font-bold border-slate-300">Rate</td>
                    <td class="p-1 py-1 border font-bold border-slate-300">Amount</td>
                    <td class="p-1 py-1 border font-bold border-slate-300">Rate</td>
                    <td class="border font-bold border-slate-300"> Amount</td>
                </tr>
                <tr class="hover:bg-blue-50 transition-colors">
                    <td class="p-1 py-1 border text-right text-[12px] text-muted-foreground">${hsn_sac || ''}</td>
                    <td class="p-1 py-1 border text-right text-[12px] text-muted-foreground">${formatIndianCurrency(grossTotal)}</td>
                    <td class="p-1 py-1 border text-right text-[12px] text-muted-foreground">${cgst_percent || 0}%</td>
                    <td class="p-1 py-1 border text-right text-[12px] text-muted-foreground">${formatIndianCurrency(cgst)}</td>
                    <td class="p-1 py-1 border text-right text-[12px] text-muted-foreground">${sgst_percent || 0}%</td>
                    <td class="p-1 py-1 border text-right text-[12px] text-muted-foreground">${formatIndianCurrency(sgst)}</td>
                    <td class=" border text-right text-[12px] text-muted-foreground"> <div class="p-1 h-full border-r  border-slate-300 ">${formatIndianCurrency(taxtotal)}</div></td>
                </tr>
                <tr class="hover:bg-blue-50 transition-colors">
                    <td class="p-1 py-1 border text-right text-[12px] text-muted-foreground"><b>Total</b></td>
                    <td class="p-1 py-1 border text-right text-[12px] text-muted-foreground"><b>${formatIndianCurrency(grossTotal)}</b></td>
                    <td  class="p-1 py-1 border text-right text-[12px] text-muted-foreground"></td>
                    <td class="p-1 py-1 border text-right text-[12px] text-muted-foreground"><b>${formatIndianCurrency(cgst)}</b></td>
                    <td class="p-1 py-1 border text-right text-[12px] text-muted-foreground"><p><br /></p></td>
                    <td class="p-1 py-1 border text-right text-[12px] text-muted-foreground"><b>${formatIndianCurrency(sgst)}</b></td>
                    <td class="border text-right text-[12px] text-muted-foreground"><div class="p-1 h-full border-r  border-slate-300 "><b> ${formatIndianCurrency(taxtotal)}</b></div></td>
                </tr>
                <tr>
                    <td colSpan="7" class="border text-left text-[12px] text-muted-foreground"  style="border-bottom:0">
                        <div class="p-1 h-full border-r  border-slate-300 ">Tax Amount (in words) : <b>${numberToWords(taxtotal)}</b></div>
                    </td>
                </tr>
                <tr>
                    <td colSpan="3" class="p-1 py-1 border text-left text-[12px] text-muted-foreground" style="border-top:0;border-right:0;border-bottom:0" />
                    <td colSpan="4" style="border-bottom:0;border-top:0;border-left:0" class="border text-left text-[12px] text-muted-foreground">
                     <div class="p-1 h-full border-r  border-slate-300 "> 
                        <p><b>Company's Bank Details</b></p>
                        <p><span style="width:40%;display:inline-block">A/c Holder's Name :</span><b>${account_holder_name || ''}</b></p>
                        <p><span style="width:40%;display:inline-block">Bank Name :</span><b>${bank_name || ''}</b></p>
                        <p><span style="width:40%;display:inline-block">A/c No. :</span><b>${account_no || ''}</b></p>
                        <p><span style="width:40%;display:inline-block">Branch &amp; IFS Code :</span><b>${branch_name || ''} &amp; ${ifsc_code || ''}</b></p>
                        <p><span style="width:40%;display:inline-block">SWIFT Code :</span><b>${swift_code || ''}</b></p>
                        </div>
                    </td>
                </tr>
                <tr class="transition-colors">
                    <td colSpan="3" class="p-1 py-1 border text-left text-[12px] text-muted-foreground" style="border-top:0;">
                        <p style="text-decoration:underline">Declaration</p>
                        <p>We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
                    </td>
                    <td colSpan="4" class=" border text-right text-[12px] text-muted-foreground">
                     <div class="p-1 py-1 h-full border-r  border-slate-300 "> 
                        <b>for ${company_name || 'Company'}</b>
                        <p><br /></p>
                        <p><br /></p>
                        <p><br /></p>
                        <p><br /></p>
                        <p><br /></p>
                        <p><br /></p>
                        <p>Authorised Signatory</p>
                        </div>
                    </td>
                </tr>
            </tbody>
        </table>
        <p class="mt-[7px] text-center text-[12px]">This is a Computer Generated Invoice</p>
    </div>
</body>
</html>
    `;

    return puppeteerManager.generatePDF(html);
}
