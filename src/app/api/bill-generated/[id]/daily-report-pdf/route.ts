import { NextRequest, NextResponse } from 'next/server';
import { puppeteerManager } from '@/lib/puppeteer-server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { calculateSizeFromString } from '@/lib/utils/sizeFormatter';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface VardhiGroup {
    vardhi: {
        id: string;
        vardhi_number: string;
        name: string;
        date: string;
    };
    items: any[];
}

function generateVardhiGroups(estimation: any): VardhiGroup[] {
    const groups: Map<string, VardhiGroup> = new Map();

    (estimation.vardhis || []).forEach((vardhi: any) => {
        const vardhiId = vardhi.id;
        
        if (!groups.has(vardhiId)) {
            groups.set(vardhiId, {
                vardhi: {
                    id: vardhiId,
                    vardhi_number: vardhi.vardhi_number || "-",
                    name: vardhi.location || vardhi.name || "Unknown Vardhi",
                    date: vardhi.date || "",
                },
                items: []
            });
        }

        (vardhi.vardhiItems || []).forEach((vi: any) => {
            const qty = calculateSizeFromString(vi.size);
            const rate = Number(vi.rate) || 0;

            groups.get(vardhiId)!.items.push({
                ...vi,
                item: vi.item,
                size: vi.size || "",
                rate: rate,
                quantity: qty,
                amount: qty * rate,
                unit_name: vi.item?.unit?.unit_name || vi.unit_name || "-",
            });
        });

        (vardhi.additionalItems || []).forEach((ai: any) => {
            const qty = Number(ai.qty) || 0;
            const rate = Number(ai.rate) || 0;

            groups.get(vardhiId)!.items.push({
                ...ai,
                item: null,
                custom_name: ai.item_name || "",
                size: ai.size || "",
                rate: rate,
                quantity: qty,
                amount: Number(ai.amount) || qty * rate,
                unit_name: ai.item?.unit?.unit_name || ai.unit_name || "-",
            });
        });
    });

    return Array.from(groups.values());
}

function calculateVardhiTotal(items: any[]): number {
    return items.reduce((sum, item) => sum + Number(item.amount), 0);
}

async function generateDailyReportPDF(estimation: any, vardhiGroups: VardhiGroup[]): Promise<Buffer> {
    const vardhiGroupsHtml = vardhiGroups.map((group) => {
        const itemsHtml = group.items.map((item: any) => `
            <tr class="hover:bg-blue-50 transition-colors">
                <td class="p-2 border-r text-left text-xs text-muted-foreground">
                </td>
                <td class="p-1 border-r" style="overflow:hidden;word-break:break-word">
                    <span class="text-xs whitespace-normal break-words py-1 px-2 transition-colors outline-none text-muted-foreground">
                        ${item.item?.item_name || item.custom_name || "-"}
                    </span>
                </td>
                <td class="p-1 border-r">
                    <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
                        ${item.size || "-"}
                    </span>
                </td>
                <td class="p-1 border-r text-right">
                    <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
                        ${item.unit_name || "-"}
                    </span>
                </td>
                <td class="p-2 border-r text-left text-xs text-muted-foreground">
                </td>
            </tr>
        `).join('');

        const dateStr = group.vardhi.date ? new Date(group.vardhi.date).toLocaleDateString("en-GB") : "-";

        return `
            <tr class="bg-slate-200 font-semibold border-b-2 border-slate-300">
                <td class="p-2 border-r border-slate-300" style="word-break:break-all;overflow-wrap:anywhere">
                    <span class="inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 font-mono" style="white-space:normal;word-break:break-all">${group.vardhi.vardhi_number}</span>
                </td>
                <td class="p-2 border-r break-words border-slate-300" colspan="3">
                    <div class="text-xs  whitespace-normal break-all">${group.vardhi.name}</div>
                </td>
                <td class="p-2 border-r border-slate-300">
                    <span class="text-xs text-muted-foreground">${dateStr}</span>
                </td>
            </tr>
            ${itemsHtml}
        `;
    }).join('');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Report - ${estimation.estimation_no}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
            
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 14px; }
                @page {
                    size: A4;
                    margin: 10mm;
                }

                html, body {
                    width: 210mm;
                    min-height: 297mm;
                }
                .text-xs {
                    font-size: .75rem;
                    line-height: 1rem;
                }

            </style>
        </head>
        <body >
            <div class="bg-white space-y-4">
                <h2 class="text-[19px] text-center text-xl md:text-2xl font-semibold tracking-tight">Report </h2>
                <div class="rounded-md border overflow-hidden">
                    <table class="w-full text-sm border-collapse">
                        <tbody class="divide-y">
                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                    File No. :
                                </td>
                                <td class="p-1 border-r" >
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
                                        ${estimation.file_no || "01"}
                                    </div>
                                </td>

                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                    ઝોન નં :
                                </td>
                                <td class="p-1 border-r" >
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
                                        ${estimation.zone_no || ""}
                                    </div>
                                </td>
                            </tr>
                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                    કોન્ટ્રાકટર :
                                </td>
                                <td class="p-1 border-r" colspan="3">
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
                                        ${estimation.contractor}
                                    </div>
                                </td>
                            </tr>
                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                    કામનું નામ :
                                </td>
                                <td class="p-1 border-r" colspan="3">
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
                                        ${estimation.work_name}
                                    </div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div class="rounded-md border overflow-hidden">
                    <table class="w-full text-sm border-collapse" style="table-layout:fixed;width:100%">
                        <colgroup>
                            <col style="width:29%">
                            <col>
                            <col style="width:12%">
                            <col style="width:8%">
                            <col style="width:12%">
                        </colgroup>
                        <thead class="bg-slate-100">
                            <tr class="text-[11px] uppercase tracking-wider text-slate-700 border-b-2 border-slate-300 text-left">
                                <th class="p-3 border-r font-bold border-slate-300">Vardhi No</th>
                                <th class="p-3 border-r font-bold border-slate-300" colspan="3">Name</th>
                                <th class="p-3 font-bold border-slate-300">Date</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y">
                            ${vardhiGroupsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        </body>
        </html>
    `;

    return puppeteerManager.generatePDF(html);
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const result = await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const estimation = await prisma.vardhiEstimation.findFirst({
                where: { id, company_id },
                include: {
                    vardhis: {
                        orderBy: { created_at: 'asc' },
                        select: {
                            id: true,
                            vardhi_number: true,
                            location: true,
                            date: true,
                            report_pdf: true,
                            site_photography: true,
                            site_clear_photo: true,
                            other_attachment: true,
                            vardhiItems: {
                                include: {
                                    item: { include: { unit: true, ay: true } }
                                }
                            },
                            additionalItems:  {
                                include: {
                                    item: { include: { unit: true, ay: true } }
                                }
                            },
                        },
                    },
                },
            });

            if (!estimation) {
                return NextResponse.json(errorResponse('Estimation not found'), { status: 404 });
            }

            const vardhiGroups = generateVardhiGroups(estimation);
            const pdfBuffer = await generateDailyReportPDF(estimation, vardhiGroups);

            return new NextResponse(pdfBuffer as unknown as Blob, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="daily-report-${estimation.estimation_no}.pdf"`,
                },
            });
        });

        if (result instanceof NextResponse) {
            return result;
        }

        return result;
    } catch (error) {
        console.error('PDF generation error:', error);
        return NextResponse.json(
            errorResponse('Failed to generate PDF'),
            { status: 500 }
        );
    }
}
