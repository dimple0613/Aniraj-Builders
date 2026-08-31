"use client";

import { VardhiDailyReport } from "@/types/bill-generated";
import PrintViewClient from "./print-view-client";
import { sortEstimateItems } from "@/lib/utils/sortEstimateItems";
import { calculateSizeFromString } from "@/lib/utils/sizeFormatter";

interface Props {
    estimation: VardhiDailyReport & {
        items: any[];
    };
}


export default function EstimationPrintView({ estimation }: Props) {
    const getAllItems = (): any[] => {
        const allItems: any[] = [];
        
        if (!estimation.vardhis) return allItems;
        
        estimation.vardhis.forEach((vardhi: any) => {
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

    const mergeDuplicateItems = (items: any[]): any[] => {
        const map = new Map<string, any>();
        items.forEach((item) => {
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
    };

    const allItems = getAllItems();
    const mergedItems = mergeDuplicateItems(allItems);
    const totalAmount = mergedItems.reduce(
        (sum: any, item: any) => sum + Number(item.amount || 0),
        0
    );
    
    const sortedItems = sortEstimateItems(mergedItems);

    return (
        <div className="flex flex-col gap-4 md:gap-6  w-full overflow-hidden">
            <div className="bg-white flex flex-col gap-4 md:gap-6" >
                <div className="rounded-md border overflow-hidden">
                    <div className="overflow-auto">
                        <table className="w-full text-sm border-collapse">
                            <tbody className="divide-y">
                                <tr className="hover:bg-blue-50 transition-colors ">
                                    {/* FILE NO */}
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                        File No. :
                                    </td>
                                    <td className="p-1" >
                                        <div className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
                                            {estimation.file_no || "01"}
                                        </div>
                                    </td>
                                </tr>
                                <tr className="hover:bg-blue-50 transition-colors ">
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                        કામનું નામ :
                                    </td>
                                    <td className="p-1" >
                                        <div className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
                                            {estimation.work_name}
                                        </div>
                                    </td>
                                </tr>
                                <tr className="hover:bg-blue-50 transition-colors ">
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                        કોન્ટ્રાકટર :
                                    </td>
                                    <td className="p-1" >
                                        <div className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
                                            {estimation.contractor}
                                        </div>
                                    </td>
                                </tr>

                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="rounded-md border overflow-hidden">
                    <div className="overflow-auto">
                        <table className="w-full text-sm border-collapse">
                            <thead className="bg-slate-100">
                                <tr className="text-[11px] uppercase tracking-wider text-slate-700 border-b-2 border-slate-300 text-left">
                                    <th className="p-3 border-r font-bold  border-slate-300 p-2">No.</th>
                                    <th className="p-3 border-r font-bold  border-slate-300 p-2">Item No.</th>
                                    <th className="p-3 border-r font-bold  border-slate-300 p-2">Item</th>
                                    <th className="p-3 border-r font-bold  border-slate-300 p-2 hidden">Size</th>
                                    <th className="p-3 border-r font-bold  border-slate-300 p-2">Quantity</th>
                                    <th className="p-3 border-r font-bold  border-slate-300 p-2">Unit</th>
                                    <th className="p-3 border-r font-bold  border-slate-300 p-2">Rate</th>
                                    <th className="p-3 font-bold  border-slate-300  p-2 text-right ">Total
                                    </th>
                                </tr>
                            </thead>

                            <tbody className="divide-y">
                                {sortedItems.map((item, index) => (
                                    <tr key={item.id || index} className="hover:bg-blue-50 transition-colors">
                                        <td className="p-2 py-1  border-r text-left text-xs text-muted-foreground">
                                            <span className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
                                                    {index + 1}
                                                </span>
                                            </td>

                                            <td className="p-1 border-r">
                                                <span className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
                                                    {item.ay?.ay_no || item.ay_id || "-"}
                                                </span>
                                            </td>
                                            <td className="p-1 border-r">
                                                <span className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-normal transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 text-xs">
                                                    {item.item?.item_name || item.custom_name}
                                                </span>
                                            </td>
                                            <td className="hidden p-1 border-r">
                                                <span className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">{item.size}</span>
                                            </td>
                                            <td className="p-1 border-r">
                                                <span className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">{Number(item.quantity).toLocaleString("en-IN")}</span>
                                            </td>
<td className="p-1 border-r text-right">
                                                <span className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">{item.unit_name || item.unit_id || "-"}</span>
                                            </td>
                                            <td className="p-1 border-r text-right">
                                                <span className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs"> {Number(item.rate).toLocaleString("en-IN")}</span>
                                            </td>
                                            <td className="p-1 ">
                                                <span className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs justify-end"> {Number(item.amount).toLocaleString("en-IN", {
                                                    minimumFractionDigits: 2, maximumFractionDigits: 2
                                                })}</span>
                                            </td>
                                        </tr>
                                ))}
                            </tbody>
                            <tfoot className="divide-y">
                                {/* TOTAL ROW */}
                                <tr className=" font-bold border-t-2">
                                    <td colSpan={6} className="p-2 py-1  text-right text-md border-r">
                                        <span className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-md justify-end"> Total :</span>
                                    </td>
                                    <td className="p-1 py-2 text-right text-md tabular-nums font-mono">
                                        <span className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-md justify-end"> ₹ {totalAmount.toLocaleString("en-IN", {
                                           minimumFractionDigits: 2,
                                             maximumFractionDigits: 2
                                        })}</span>
                                    </td>
                                </tr>

                                <tr className=" font-bold">
                                    <td colSpan={6} className="p-1 text-right text-md border-r">
                                        <span className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-md justify-end">
                                            SAY :</span>
                                    </td>
                                    <td className="p-1 py-2  text-right text-md tabular-nums font-mono">
                                        <span className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-md justify-end">₹ {Math.round(totalAmount).toLocaleString("en-IN", {
                                            minimumFractionDigits: 2,
                                        })}</span>
                                    </td>
                                </tr>
                                {/* <tr className=" font-bold">
                                <td colSpan={2} className="p-3 text-right text-md border-r">
                                    <span className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-md justify-end">   અંકે : </span>
                                </td>
                                <td colSpan={5} className="p-3 text-left text-md tabular-nums font-mono">
                                    <span className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-md justify-start">  {Math.round(totalAmount).toLocaleString("en-IN")} પૂરાં /-</span>
                                </td>
                            </tr> */}
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
            <style jsx global>{`@media print {  body {    margin: 10mm   }`}</style>
        </div>
    );
}
