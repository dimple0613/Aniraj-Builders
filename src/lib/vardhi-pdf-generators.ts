import { puppeteerManager } from '@/lib/puppeteer-server';
import { formatIndianCurrency } from '@/lib/financial-year';

export interface VardhiGroup {
    vardhi: {
        id: string;
        vardhi_number: string;
        name: string;
        date: string;
    };
    items: any[];
}

export function generateVardhiGroups(estimation: any): VardhiGroup[] {
    const groups: Map<string, VardhiGroup> = new Map();

    estimation.items.forEach((item: any) => {
        const vardhiId = item.vardhi_id || "__unknown__";
        if (!groups.has(vardhiId)) {
            const vardhi = estimation.vardhis?.find((v: any) => v.id === vardhiId);
            groups.set(vardhiId, {
                vardhi: {
                    id: vardhiId,
                    vardhi_number: vardhi?.vardhi_number || "-",
                    name: vardhi?.name || "Unknown Vardhi",
                    date: vardhi?.date || "",
                },
                items: []
            });
        }
        groups.get(vardhiId)!.items.push(item);
    });

    return Array.from(groups.values());
}

export function calculateVardhiTotal(items: any[]): number {
    return items.reduce((sum, item) => sum + Number(item.amount), 0);
}

export async function generateEstimationPDF(estimation: any, items: any[]): Promise<Buffer> {
    const totalAmount = items.reduce((sum, item) => sum + Number(item.amount), 0);

    const processItems = () => {
        let displayIndex = 0;

        const sortedItems = [...items].sort((a, b) => {
            const nameA = (a.item?.item_name || a.custom_name || '').toLowerCase();
            const nameB = (b.item?.item_name || b.custom_name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });

        return sortedItems.map((item: any, index: number) => {
            const prevItem = sortedItems[index - 1]; 

            const currentName = item.item?.item_name || item.custom_name;
            const prevName = prevItem?.item?.item_name || prevItem?.custom_name;

            const isSameItem =
                prevItem &&
                prevItem.ay_id === item.ay_id &&
                prevName === currentName;

            if (!isSameItem) displayIndex++;

            return {
                item,
                displayNo: !isSameItem ? displayIndex : `"`,
                ayNo: !isSameItem ? (item.ay?.ay_no || item.ay_id || '-') : `"`,
                itemName: !isSameItem ? currentName || '-' : `"`,
                isSameItem
            };
        });
    };

    const processedItems = processItems();

    const itemsHtml = processedItems.map(({ item, displayNo, ayNo, itemName, isSameItem }) => `
        <tr class="hover:bg-blue-50 transition-colors">
            <td  class="p-2 py-1  border-r text-left text-xs text-muted-foreground">
                 <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">${displayNo} </span></td>
            <td class="p-1 border-r">
                 <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">${ayNo} </span></td>
            <td class="p-1 border-r">
                 <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">${itemName} </span></td>
            <td class="p-1 border-r">
                 <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">${item.size || '-'} </span></td>
            <td class="p-1 border-r">
                 <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">${Number(item.quantity).toLocaleString('en-IN')} </span></td>
            <td class="p-1 border-r">
                 <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">${item.unit?.unit_name || '-'} </span></td>
            <td class="p-1 border-r">
                 <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">${Number(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2 })} </span></td>
            <td class="p-1">
                 <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs justify-end">${Number(item.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })} </span></td>
        </tr>
    `).join('');


    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Estimation - ${estimation.estimation_no}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 15px; font-size: 12px; }
                @page {
                    size: A4;
                    margin: 10mm;
                }

                html, body {
                    width: 210mm;
                    min-height: 297mm;
                }
            </style>
        </head>
        <body>
            <div class="bg-white space-y-4">
                <div class="rounded-md border overflow-hidden">
                    <table class="w-full text-sm border-collapse">
                        <tbody class="divide-y">
                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                    File No. :
                                </td>
                                <td class="p-1" >
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria_invalid_:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
                                        ${estimation.file_no || "01"}
                                    </div>
                                </td>
                            </tr>
                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                    કામનું નામ :
                                </td>
                                <td class="p-1" >
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
                                        ${estimation.work_name}
                                    </div>
                                </td>
                            </tr>
                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                    કોન્ટ્રાકટર :
                                </td>
                                <td class="p-1" >
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
                                <th class="p-3 border-r font-bold  border-slate-300 p-2">Size</th>
                                <th class="p-3 border-r font-bold  border-slate-300 p-2">Quantity</th>
                                <th class="p-3 border-r font-bold  border-slate-300 p-2">Unit</th>
                                <th class="p-3 border-r font-bold  border-slate-300 p-2">Rate</th>
                                <th class="p-3 font-bold  border-slate-300  p-2 text-right ">Total
                                </th>
                            </tr>
                        </thead>

                        <tbody class="divide-y">
                            ${itemsHtml}
                        </tbody>
                        <tfoot class="divide-y">
                            <tr class=" font-bold border-t-2">
                                <td colspan="7" class="p-2 py-1  text-right text-md border-r">
                                    <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-md justify-end"> Total :</span>
                                </td>
                                <td class="p-1 py-2 text-right text-md tabular-nums font-mono">
                                    <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-md justify-end"> ₹ ${totalAmount.toLocaleString("en-IN", {
                                           minimumFractionDigits: 2,
                                             maximumFractionDigits: 2
                                        })}</span>
                                </td>
                            </tr>

                            <tr class=" font-bold">
                                <td colspan="7" class="p-1 text-right text-md border-r">
                                    <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-md justify-end">
                                        SAY :</span>
                                </td>
                                <td class="p-1 py-2  text-right text-md tabular-nums font-mono">
                                    <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-md justify-end">₹ ${Math.round(totalAmount).toLocaleString("en-IN", {
        minimumFractionDigits: 2,
    })}</span>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </body>
        </html>
    `;

    return puppeteerManager.generatePDF(html);
}

export async function generateDailyReportPDF(estimation: any, vardhiGroups: VardhiGroup[]): Promise<Buffer> {
    const vardhiGroupsHtml = vardhiGroups.map((group) => {
        const vardhiTotal = calculateVardhiTotal(group.items);

        const itemsHtml = group.items.map((item: any) => `
            <tr class="hover:bg-blue-50 transition-colors">
                <td class="p-2 border-r text-left text-xs text-muted-foreground">
                </td>
                <td class="p-1 border-r">
                    <span class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
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
                        ${item.unit?.unit_name || item.unit_name || "-"}
                    </span>
                </td>
                <td class="p-2 text-left text-xs text-muted-foreground">
                </td>
            </tr>
        `).join('');

        const dateStr = group.vardhi.date ? new Date(group.vardhi.date).toLocaleDateString("en-GB") : "-";

        return `
            <tr class="bg-slate-200 font-semibold border-b-2 border-slate-300">
                <td class="p-2 border-r border-slate-300 w-[18%]">
                    <span style="font-family: monospace; background: #e2e8f0; padding: 2px 8px; border-radius: 4px;">${group.vardhi.vardhi_number}</span>
                </td>
                <td class="p-2 border-r border-slate-300" colspan="3">
                    <span class="text-xs whitespace-normal break-words">${group.vardhi.name}</span>
                </td>
                <td class="p-2  border-slate-300">
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
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 15px; font-size: 12px; }
                @page {
                    size: A4;
                    margin: 10mm;
                }

                html, body {
                    width: 210mm;
                    min-height: 297mm;
                }
            </style>
        </head>
        <body>
            <div class="bg-white space-y-4">
                <div class="rounded-md border overflow-hidden">
                    <table class="w-full text-sm border-collapse">
                        <tbody class="divide-y">
                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                    File No. :
                                </td>
                                <td class="p-1" >
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
                                        ${estimation.file_no || "01"}
                                    </div>
                                </td>

                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                    ઝોન નં :
                                </td>
                                <td class="p-1" >
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
                                        ${estimation.zone_no || ""}
                                    </div>
                                </td>
                            </tr>
                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                    કોન્ટ્રાકટર :
                                </td>
                                <td class="p-1" colspan="3">
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
                                        ${estimation.contractor}
                                    </div>
                                </td>
                            </tr>
                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                    કામનું નામ :
                                </td>
                                <td class="p-1" colspan="3">
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
                                        ${estimation.work_name}
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
                                <th class="p-3 border-r font-bold w-[18%] border-slate-300">Vardhi No</th>
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

function getFinancialYear(date: Date): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    if (month >= 4) {
        return `${year}-${(year + 1).toString().slice(-2)}`;
    }
    return `${year - 1}-${year.toString().slice(-2)}`;
}

export async function generateManjuriPDF(estimation: any, items: any[], origin: string): Promise<Buffer> {
    const sortedVardhis = [...(estimation.vardhis || [])].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    const startDate =
        sortedVardhis.length > 0
            ? new Date(sortedVardhis[0].date)
            : null;

    const endDate =
        sortedVardhis.length > 0
            ? new Date(sortedVardhis[sortedVardhis.length - 1].date)
            : null;

    const formatDate = (date: Date | null) => {
        if (!date) return "-";
        return date.toLocaleDateString("en-GB");
    };

    const totalAmount = items.reduce(
        (sum: any, item: any) => sum + Number(item.amount),
        0
    );

    const financialYear = getFinancialYear(
        estimation.created_at
            ? new Date(estimation.created_at)
            : new Date()
    );

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Manjuri - ${estimation.estimation_no}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Segoe UI', Arial, sans-serif; padding: 15px; font-size: 12px; }
                @page {
                    size: A4;
                    margin: 10mm;
                }

                html, body {
                    width: 210mm;
                    min-height: 297mm;
                }
            </style>
        </head>
        <body>
            <div class="rounded-md border overflow-hidden">
                <div class="overflow-auto">
                    <table class="w-full text-sm border-collapse">
                        <tbody class="divide-y">
                            <tr class="transition-colors ">
                                <td class="text-center p-6" colspan="4">
                                    <div class="flex flex-wrap justify-center">
                                        <img
                                            src="${origin}/bmc_icon.png"
                                            alt="BMC Icon"
                                            width="60"
                                            height="60"
                                            class="object-cover mr-[50px]"
                                        />
                                        <div class="">
                                            <h1 class="text-xl font-bold">
                                                ભાવનગર મહાનગરપાલિકા - ભાવનગર
                                            </h1>
                                            <h2 class="text-lg font-semibold">
                                                વોટર વર્કસ વિભાગ
                                            </h2>
                                        </div>
                                        <img
                                            src="${origin}/bmc_icon.png"
                                            alt="BMC Icon"
                                            width="60"
                                            height="60"
                                            class="object-cover ml-[50px]"
                                        />
                                    </div>
                                    <h3 class="mt-2 font-semibold">
                                        :: ખરેખર થયેલ કામનું ખર્ચ પત્રક ::
                                    </h3>
                                </td>
                            </tr>
                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                    કામનું નામ :
                                </td>
                                <td class="p-1" colspan="3">
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">${estimation.work_name}
                                    </div>
                                </td>
                            </tr>

                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                    ખર્ચ પત્રક બનાવનાર :
                                </td>
                                <td class="p-1 " colspan="3">
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">${estimation.zone_no}</div>
                                </td>
                            </tr>

                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                    કોન્ટ્રાક્ટરનું નામ :
                                </td>
                                <td class="p-1 " colspan="3">
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">${estimation.contractor}</div>
                                </td>
                            </tr>

                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                    કુલ ખર્ચ :
                                </td>
                                <td class="p-1" colspan="3">
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">  ₹ ${formatIndianCurrency(totalAmount)} </div>
                                </td>
                            </tr>

                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                    ભાવોનો આધાર :
                                </td>
                                <td class="p-1 " colspan="3">
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">વિભાગના મંજુર થયેલ વાર્ષિક ભાવો ${financialYear}</div>
                                </td>
                            </tr>

                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                    ખર્ચનો હેડ :
                                </td>
                                <td class="p-1 " colspan="3">
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
                                        મેન્ટેનન્સ
                                    </div>
                                </td>

                            </tr>
                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                    DATE :
                                </td>
                                <td class="p-1 border-r">
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs"> ${formatDate(startDate)}</div>
                                </td>
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                    TO:
                                </td>
                                <td class="p-1 ">
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">${formatDate(endDate)}</div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </body>
        </html>
    `;

    return puppeteerManager.generatePDF(html, { margin: { top: '10px', bottom: '10px', left: '10px', right: '10px' } });
}
