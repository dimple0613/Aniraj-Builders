import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { puppeteerManager } from '@/lib/puppeteer-server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function formatCurrency(n: number): string {
    return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(d: string): string {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

async function generatePayslipPDF(payslip: any): Promise<Buffer> {
    const item = payslip.payrollItem;
    const employee = payslip.employee;
    const run = payslip.payrollRun;

    const allComponents = (item?.components || []).map((c: any) => ({
        name: c.salaryComponent?.name || '-',
        type: c.type,
        amount: Number(c.amount || 0),
    }));
    const earnings = allComponents.filter((c: any) => c.type === 'EARNING');
    const deductions = allComponents.filter((c: any) => c.type === 'DEDUCTION');

    const earningsHtml = earnings.length === 0
        ? '<tr><td colspan="2" class="p-2 text-sm text-gray-400">No earnings</td></tr>'
        : earnings.map((c: any, i: number) => `
            <tr class="${i % 2 === 0 ? 'bg-gray-50' : ''}">
                <td class="p-2 text-sm">${c.name}</td>
                <td class="p-2 text-sm text-right">₹ ${formatCurrency(c.amount)}</td>
            </tr>
        `).join('');

    const deductionsHtml = deductions.length === 0
        ? '<tr><td colspan="2" class="p-2 text-sm text-gray-400">No deductions</td></tr>'
        : deductions.map((c: any, i: number) => `
            <tr class="${i % 2 === 0 ? 'bg-gray-50' : ''}">
                <td class="p-2 text-sm">${c.name}</td>
                <td class="p-2 text-sm text-right">₹ ${formatCurrency(c.amount)}</td>
            </tr>
        `).join('');

    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const periodName = run?.period ? `${MONTHS[run.period.month - 1]} ${run.period.year}` : '';
    const periodStart = run?.period?.start_date ? formatDate(run.period.start_date) : '';
    const periodEnd = run?.period?.end_date ? formatDate(run.period.end_date) : '';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Payslip - ${employee?.name || ''}</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
        <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a1a1a; background: #fff; }
            @page { size: A4; margin: 15mm; }
            @media print { body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
    </head>
    <body>
        <div style="max-width: 700px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 16px; margin-bottom: 20px;">
                <h1 style="font-size: 22px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase;">PAYSLIP</h1>
                <p style="font-size: 13px; color: #6b7280; margin-top: 6px;">
                    ${run?.financialYear?.name || ''} &middot; ${periodName}
                </p>
                ${periodStart ? `<p style="font-size: 12px; color: #9ca3af;">Period: ${periodStart} - ${periodEnd}</p>` : ''}
            </div>

            <div style="display: flex; justify-content: space-between; padding: 14px; background: #f9fafb; border-radius: 8px; margin-bottom: 24px;">
                <div>
                    <p style="font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">Employee</p>
                    <p style="font-size: 14px; font-weight: 600; margin-top: 2px;">${employee?.name || '-'}</p>
                    <p style="font-size: 12px; color: #6b7280;">Code: ${employee?.employee_code || '-'}</p>
                </div>
                <div style="text-align: right;">
                    <p style="font-size: 11px; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.5px;">Payslip #</p>
                    <p style="font-size: 14px; font-weight: 600; margin-top: 2px;">${payslip.payslip_number}</p>
                    <p style="font-size: 12px; color: #6b7280;">${formatDate(payslip.generated_date)}</p>
                </div>
            </div>

            <div style="display: flex; gap: 24px; margin-bottom: 24px;">
                <div style="flex: 1;">
                    <h3 style="font-size: 13px; font-weight: 600; color: #16a34a; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Earnings</h3>
                    <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
                        <tbody>${earningsHtml}</tbody>
                        <tfoot>
                            <tr style="border-top: 2px solid #e5e7eb; font-weight: 600;">
                                <td style="padding: 8px; font-size: 13px;">Total Earnings</td>
                                <td style="padding: 8px; font-size: 13px; text-align: right;">₹ ${formatCurrency(item?.total_earnings || 0)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div style="flex: 1;">
                    <h3 style="font-size: 13px; font-weight: 600; color: #dc2626; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Deductions</h3>
                    <table style="width: 100%; border-collapse: collapse; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden;">
                        <tbody>${deductionsHtml}</tbody>
                        <tfoot>
                            <tr style="border-top: 2px solid #e5e7eb; font-weight: 600;">
                                <td style="padding: 8px; font-size: 13px;">Total Deductions</td>
                                <td style="padding: 8px; font-size: 13px; text-align: right;">₹ ${formatCurrency(item?.total_deductions || 0)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>

            <div style="border-top: 2px solid #111; padding-top: 16px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 16px; font-weight: 700;">Net Pay</span>
                <span style="font-size: 20px; font-weight: 700;">₹ ${formatCurrency(item?.net_pay || 0)}</span>
            </div>

            ${(item?.gross_salary || 0) > 0 ? `
            <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 12px; color: #9ca3af;">
                <span>Gross Salary</span>
                <span>₹ ${formatCurrency(item.gross_salary)}</span>
            </div>
            ` : ''}
        </div>
    </body>
    </html>`;

    return puppeteerManager.generatePDF(html);
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }

            const payslip = await prisma.payslip.findFirst({
                where: { id },
                include: {
                    employee: { select: { id: true, name: true, employee_code: true } },
                    payrollRun: {
                        select: {
                            id: true,
                            company_id: true,
                            process_date: true,
                            financialYear: {
                                select: { id: true, name: true },
                            },
                            period: {
                                select: { id: true, month: true, year: true, start_date: true, end_date: true },
                            },
                        },
                    },
                    payrollItem: {
                        include: {
                            components: {
                                include: { salaryComponent: { select: { name: true, type: true } } },
                            },
                        },
                    },
                },
            });

            if (!payslip || payslip.payrollRun.company_id !== company_id) {
                return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
            }

            const pdfBuffer = await generatePayslipPDF(payslip);

            return new NextResponse(pdfBuffer as unknown as Blob, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `inline; filename="payslip-${payslip.payslip_number}.pdf"`,
                },
            });
        });
    } catch (error: any) {
        console.error('Payslip PDF generation error:', error);
        return NextResponse.json(
            { error: error?.message || 'Failed to generate PDF' },
            { status: 500 },
        );
    }
}
