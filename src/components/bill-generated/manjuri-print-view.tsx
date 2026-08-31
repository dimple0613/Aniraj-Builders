"use client";

import { formatIndianCurrency } from "@/lib/financial-year";
import { VardhiDailyReport } from "@/types/bill-generated";
import PrintViewClient from "./print-view-client";
import { calculateSizeFromString } from "@/lib/utils/sizeFormatter";

interface Props {
    estimation: VardhiDailyReport & {
        items: any[];
        vardhis?: any[];
    };
}

export default function ManjuriPrintView({ estimation }: Props) {
     const getAllItems = (): any[] => {
        const allItems: any[] = [];

        if (!estimation.vardhis) return allItems;

        estimation.vardhis.forEach((vardhi: any) => {
            (vardhi.vardhiItems || []).forEach((vi: any) => {
                const sizeValue = calculateSizeFromString(vi.size);
                const rate = Number(vi.rate) || 0;

                allItems.push({
                    id: vi.id,
                    item_name: vi.item?.item_name || "",
                    size: vi.size || "",
                    rate: rate,
                    quantity: sizeValue,
                    amount: sizeValue * rate,
                });
            });

            (vardhi.additionalItems || []).forEach((ai: any) => {
                const qty = Number(ai.qty) || 0;
                const rate = Number(ai.rate) || 0;

                allItems.push({
                    id: ai.id,
                    item_name: ai.item_name || "",
                    size: ai.size || "",
                    rate: rate,
                    quantity: qty,
                    amount: Number(ai.amount) || qty * rate,
                });
            });
        });

        return allItems;
    };

    const allItems = getAllItems();

    const sortedVardhis = [...(estimation.vardhis || [])].sort(
        (a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
    );

    const startDate = sortedVardhis.length > 0 ? new Date(sortedVardhis[0].date) : null;
    const endDate = sortedVardhis.length > 0 ? new Date(sortedVardhis[sortedVardhis.length - 1].date) : null;

    const formatDate = (date: Date | null) => {
        if (!date || isNaN(date.getTime())) return "-";
        return date.toLocaleDateString("en-GB");
    };

    const totalAmount = estimation.vardhis.reduce(
        (sum, item: any) => sum + Number(item.grand_total || 0),
        0
    );

    const getFinancialYear = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;

        if (month >= 4) {
            return `${year}-${(year + 1).toString().slice(-2)}`;
        } else {
            return `${year - 1}-${year.toString().slice(-2)}`;
        }
    };

    const financialYear = getFinancialYear(
        estimation.created_at
            ? new Date(estimation.created_at)
            : new Date()
    );

    return (
        <div className="flex flex-col gap-4 md:gap-6  w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap print:hidden">
                <div className="flex flex-col gap-1">
                    {/* <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Manjuri
                    </h2> */}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    
                </div>
            </div>
            <div className="bg-white " >
                <div className="rounded-md border overflow-hidden">
                    <div className="overflow-auto">
                        <table className="w-full text-sm border-collapse">
                            <tbody className="divide-y">
                                <tr className="transition-colors ">
                                    <td className="text-center p-6" colSpan={4}>
                                        <div className="flex flex-wrap justify-center">
                                            <img
                                                src="/bmc_icon.png"
                                                alt="BMC Icon"
                                                width={60}
                                                height={60}
                                                className="object-cover mr-[50px]"
                                            />
                                            <div className="">
                                                <h1 className="text-xl font-bold">
                                                    ભાવનગર મહાનગરપાલિકા - ભાવનગર
                                                </h1>
                                                <h2 className="text-lg font-semibold">
                                                    વોટર વર્કસ વિભાગ
                                                </h2>

                                            </div>
                                            <img
                                                src="/bmc_icon.png"
                                                alt="BMC Icon"
                                                width={60}
                                                height={60}
                                                className="object-cover ml-[50px]"
                                            />
                                        </div>
                                        <h3 className="mt-2 font-semibold">
                                            :: ખરેખર થયેલ કામનું ખર્ચ પત્રક ::
                                        </h3>
                                    </td>
                                </tr>
                                <tr className="hover:bg-blue-50 transition-colors ">
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                        કામનું નામ :
                                    </td>
                                    <td className="p-1" colSpan={3}>
                                        <div className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">{estimation.work_name}
                                        </div>
                                    </td>
                                </tr>

                                <tr className="hover:bg-blue-50 transition-colors ">
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                        ખર્ચ પત્રક બનાવનાર :
                                    </td>
                                    <td className="p-1 " colSpan={3}>
                                        <div className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">{estimation.zone_no}</div>
                                    </td>
                                </tr>

                                <tr className="hover:bg-blue-50 transition-colors ">
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                        કોન્ટ્રાક્ટરનું નામ :
                                    </td>
                                    <td className="p-1 " colSpan={3}>
                                        <div className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">{estimation.contractor}</div>
                                    </td>
                                </tr>

                                <tr className="hover:bg-blue-50 transition-colors ">
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                        કુલ ખર્ચ :
                                    </td>
                                    <td className="p-1" colSpan={3}>
                                        <div className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">  ₹ {formatIndianCurrency(totalAmount)} </div>
                                    </td>
                                </tr>

                                <tr className="hover:bg-blue-50 transition-colors ">
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                        ભાવોનો આધાર :
                                    </td>
                                    <td className="p-1 " colSpan={3}>
                                        <div className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">વિભાગના મંજુર થયેલ વાર્ષિક ભાવો {financialYear}</div>
                                    </td>
                                </tr>

                                <tr className="hover:bg-blue-50 transition-colors ">
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                        ખર્ચનો હેડ :
                                    </td>
                                    <td className="p-1 " colSpan={3}>
                                        <div className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
                                            મેન્ટેનન્સ
                                        </div>
                                    </td>

                                </tr>
                                <tr className="hover:bg-blue-50 transition-colors ">
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                        DATE :
                                    </td>
                                    <td className="p-1 border-r">
                                        <div className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">  {formatDate(startDate)}</div>
                                    </td>
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                        TO:
                                    </td>
                                    <td className="p-1 ">
                                        <div className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">{formatDate(endDate)}</div>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <style jsx global>{`@media print {  body {    margin: 10mm   }`}</style>
        </div>
    );
}