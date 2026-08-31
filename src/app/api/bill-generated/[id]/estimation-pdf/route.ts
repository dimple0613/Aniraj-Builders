import { NextRequest, NextResponse } from 'next/server';
import { puppeteerManager } from '@/lib/puppeteer-server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { sortEstimateItems } from '@/lib/utils/sortEstimateItems';
import { calculateSizeFromString } from '@/lib/utils/sizeFormatter';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function generateEstimationPDF(estimation: any, vardhis: any[]): Promise<Buffer> {
    const getAllItems = (): any[] => {
        const allItems: any[] = [];

        if (!vardhis) return allItems;

        vardhis.forEach((vardhi: any) => {
            (vardhi.vardhiItems || []).forEach((vi: any) => {
                const sizeValue = calculateSizeFromString(vi.size);
                const rate = Number(vi.rate) || 0;

                allItems.push({
                    id: vi.id,
                    item_id: vi.item_id,
                    item: vi.item,
                    ay_id: vi.item?.ay_id,
                    ay: vi.item?.ay,
                    custom_name: "",
                    size: vi.size || "",
                    rate: rate,
                    quantity: sizeValue,
                    unit_id: vi.item?.unit_id || (vi.unit?.id || ""),
                    unit: vi.item?.unit || vi.unit || null,
                    unit_name: vi.item?.unit?.unit_name || vi.unit?.unit_name || vi.item?.unit_id || vi.unit?.id || "-",
                    amount: sizeValue * rate,
                });
            });

            (vardhi.additionalItems || []).forEach((ai: any) => {
                const qty = Number(ai.qty) || 0;
                const rate = Number(ai.rate) || 0;

                allItems.push({
                    id: ai.id,
                    item_id: ai.item_id || null,
                    item: ai.item || null,
                    ay_id: ai.item?.ay_id || null,
                    ay: ai.item?.ay || null,
                    custom_name: ai.item_name || "",
                    size: ai.size || "",
                    rate: rate,
                    quantity: qty,
                    unit_id: ai.item?.unit_id || ai.unit?.id || "",
                    unit: ai.item?.unit || ai.unit || null,
                    unit_name: ai.item?.unit?.unit_name || ai.unit?.unit_name || ai.item?.unit_id || ai.unit?.id || "Nos",
                    amount: Number(ai.amount) || qty * rate,
                });
            });
        });

        return allItems;
    };

    const allItems = getAllItems();

    function mergeDuplicateItems(items: any[]): any[] {
        const map = new Map<string, any>();
        items.forEach((item: any) => {
            const key = `${item.ay?.ay_no || item.ay_id || ''}|${item.item?.item_name || item.custom_name || ''}|${item.unit_name || item.unit_id || ''}|${item.rate}`;
            if (map.has(key)) {
                const existing = map.get(key);
                existing.quantity += item.quantity;
                existing.amount = existing.quantity * existing.rate;
            } else {
                map.set(key, { ...item });
            }
        });
        return Array.from(map.values());
    }

    const mergedItems = mergeDuplicateItems(allItems);
    const totalAmount = mergedItems.reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const sortedItems = sortEstimateItems(mergedItems);

    const processedItems = sortedItems.map((item: any, index: number) => {
        const currentName = item.item?.item_name || item.custom_name || item.item_name;
        return {
            item,
            displayNo: index + 1,
            ayNo: item.ay?.ay_no || item.ay_id || '-',
            itemName: currentName || '-',
            unit_name: item.unit_name || item.unit_id || '-',
        };
    });

    const itemsHtml = processedItems.map(({ item, displayNo, ayNo, itemName }) => `
        <tr class="hover:bg-blue-50 transition-colors">
            <td  class="p-2 py-1  border-r text-leftblock text-xs leading-tight break-words text-muted-foreground">
                 <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50  gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-normal transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3  data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8block text-xs leading-tight break-words">${displayNo} </span></td>
            <td class="p-1 border-r">
                 <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50  gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-normal transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3  data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8block text-xs leading-tight break-words">${ayNo} </span></td>
            <td class="p-1 border-r">
                 <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-normal transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 text-xs leading-tight break-words">${itemName} </span></td>
            <td class="hidden p-1 border-r">
                 <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50  gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3  data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8block text-xs leading-tight break-words">${item.size || '-'} </span></td>
            <td class="p-1 border-r">
                 <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50  gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3  data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8block text-xs leading-tight break-words">${Number(item.quantity).toLocaleString('en-IN')} </span></td>
            <td class="p-1 border-r">
                 <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50  gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3  data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8block text-xs leading-tight break-words">${item.unit_name || '-'} </span></td>
            <td class="p-1 border-r">
                 <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50  gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3  data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8block text-xs leading-tight break-words">${Number(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })} </span></td>
            <td class="p-1 border-r">
                 <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs justify-end">${Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} </span></td>
        </tr>
    `).join('');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Estimation - ${estimation.estimation_no}</title>
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
                // td span {
                //     word-break: break-all;
                //     overflow-wrap: anywhere;
                // }
            </style>
        </head>
        <body>
            <div class="bg-white space-y-4">
                <h2 class="text-[19px] text-center text-xl md:text-2xl font-semibold tracking-tight">Estimation </h2>
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
                            </tr>
                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                    કામનું નામ :
                                </td>
                                <td class="p-1 border-r" >
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
                                        ${estimation.work_name}
                                    </div>
                                </td>
                            </tr>
                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                    કોન્ટ્રાકટર :
                                </td>
                                <td class="p-1 border-r" >
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
                                        ${estimation.contractor}
                                    </div>
                                </td>
                            </tr>

                        </tbody>
                    </table>
                </div>
                <div class="rounded-md border overflow-hidden">
                    <table class="w-full text-sm border-collapse">
                        <thead class="bg-slate-100">
                            <tr class="text-[11px] uppercase tracking-wider text-slate-700 border-b-2 border-slate-300 text-left">
                                <th class="p-3 border-r font-bold  border-slate-300 p-2">No.</th>
                                <th class="p-3 border-r font-bold  border-slate-300 p-2">Item No.</th>
                                <th class="p-3 border-r font-bold  border-slate-300 p-2">Item</th>
                                <th class="p-3 border-r font-bold  border-slate-300 p-2 hidden">Size</th>
                                <th class="p-3 border-r font-bold  border-slate-300 p-2">Quantity</th>
                                <th class="p-3 border-r font-bold  border-slate-300 p-2">Unit</th>
                                <th class="p-3 border-r font-bold  border-slate-300 p-2">Rate</th>
                                <th class="p-3 border-r  font-bold  border-slate-300  p-2 text-right ">Total
                                </th>
                            </tr>
                        </thead>

                        <tbody class="divide-y">
                            ${itemsHtml}
                            <tr class="font-bold border-t-2 border-slate-300">
                                <td colspan="5" class="p-2 py-2 text-right text-md border-r border-slate-300 font-bold text-sm">Total :</td>
                                <td colspan="2" class="p-2 py-1 text-right text-md tabular-nums font-mono border-r font-bold text-sm">₹ ${totalAmount.toLocaleString("en-IN", {
        minimumFractionDigits: 2, maximumFractionDigits: 2
    })}</td>
                            </tr>
                            <tr class="font-bold">
                                <td colspan="5" class="p-2 py-2 text-right text-md border-r border-slate-300 font-bold text-sm">SAY :</td>
                                <td colspan="2" class="p-2 py-1 text-right text-md tabular-nums font-mono border-r font-bold text-sm">₹ ${Math.round(totalAmount).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
    })}</td>
                            </tr>
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
                    items: {
                        include: {
                            item: { include: { unit: true, ay: true } },
                            unit: true,
                            ay: true,
                        },
                    },
                    vardhis: {
                        select: {
                            id: true,
                            vardhi_number: true,
                            location: true,
                            report_pdf: true,
                            site_photography: true,
                            site_clear_photo: true,
                            other_attachment: true,
                            vardhiItems: {
                                include: {
                                    item: { include: { unit: true, ay: true } }
                                }
                            },
                            additionalItems: {
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

            const pdfBuffer = await generateEstimationPDF(estimation, estimation.vardhis);

            return new NextResponse(pdfBuffer as unknown as Blob, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="estimation-${estimation.estimation_no}.pdf"`,
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
