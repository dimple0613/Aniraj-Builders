"use client";

import { VardhiDailyReport } from "@/types/bill-generated";
import React from "react";
import { Badge } from "@/components/ui/badge";
import PrintViewClient from "./print-view-client";
import { formatIndianCurrency } from "@/lib/financial-year";
import { calculateSizeFromString } from "@/lib/utils/sizeFormatter";

interface Props {
    estimation: VardhiDailyReport & {
        items: any[];
        vardhis?: any[];
    };
}

interface VardhiGroup {
    vardhi: {
        id: string;
        vardhi_number: string;
        name: string;
        date: string;
    };
    items: any[];
}

export default function VardhiDailyReportViewClient({ estimation }: Props) {
    const getVardhiItems = (vardhiId: string): any[] => {
        const vardhi = estimation.vardhis?.find((v: any) => v.id === vardhiId);
        if (!vardhi) return [];
        
        const items: any[] = [];
        
        (vardhi.vardhiItems || []).forEach((vi: any) => {
            const sizeValue = calculateSizeFromString(vi.size);
            
            const rate = Number(vi.rate) || 0;
            
            items.push({
                id: vi.id,
                vardhi_id: vardhiId,
                item_id: vi.item_id,
                custom_name: "",
                size: vi.size || "",
                rate: rate,
                unit_id: vi.item?.unit_id || (vi.unit?.id || ""),
                unit_name: vi.item?.unit?.unit_name || vi.unit?.unit_name || vi.item?.unit_id || vi.unit?.id || "",
                ay_id: vi.item?.ay_id || null,
                ay_no: vi.item?.ay?.ay_no || "",
                quantity: sizeValue,
                amount: sizeValue * rate,
                item_name: vi.item?.item_name || "",
                item: vi.item,
            });
        });
        
        (vardhi.additionalItems || []).forEach((ai: any) => {
            const qty = Number(ai.qty) || 0;
            const rate = Number(ai.rate) || 0;
            
            items.push({
                id: ai.id,
                vardhi_id: vardhiId,
                item_id: null,
                custom_name: ai.item_name || "",
                size: ai.size || "",
                rate: rate,
                unit_id: "",
                unit_name: "Nos",
                ay_id: null,
                ay_no: "",
                quantity: qty,
                amount: Number(ai.amount) || qty * rate,
                item_name: ai.item_name || "",
            });
        });
        
        return items;
    };

    const vardhiGroups = (): VardhiGroup[] => {
        const groups: Map<string, VardhiGroup> = new Map();

        if (!estimation.vardhis || estimation.vardhis.length === 0) {
            return [];
        }

        estimation.vardhis.forEach((vardhi: any) => {
            const vardhiId = vardhi.id;
            const items = getVardhiItems(vardhiId);
            
            groups.set(vardhiId, {
                vardhi: {
                    id: vardhiId,
                    vardhi_number: vardhi.vardhi_number || "-",
                    name: vardhi.name || vardhi.location || "Unknown Vardhi",
                    date: vardhi.date || "",
                },
                items: items
            });
        });

        return Array.from(groups.values());
    };

    const calculateVardhiTotal = (items: any[]): number => {
        return items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    };

    const calculateGrandTotal = (): number => {
        return vardhiGroups().reduce((sum, group) => sum + calculateVardhiTotal(group.items), 0);
    };

    const grandTotal = calculateGrandTotal();

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap print:hidden">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Bill Generated
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <PrintViewClient estimation={estimation} />
                </div>
            </div>
            
            <div className="bg-white flex flex-col gap-4 md:gap-6">
                <div className="rounded-md border overflow-hidden">
                    <div className="overflow-auto">
                        <table className="w-full text-sm border-collapse">
                            <tbody className="divide-y">
                                <tr className="hover:bg-blue-50 transition-colors">
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold w-[120px]">
                                        File No. :
                                    </td>
                                    <td className="p-1 border-r">
                                        <span className="text-xs">{estimation.file_no || "-"}</span>
                                    </td>

                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold w-[120px]">
                                        Zone No :
                                    </td>
                                    <td className="p-1">
                                        <span className="text-xs">{estimation.zone_no || "-"}</span>
                                    </td>
                                </tr>

                                <tr className="hover:bg-blue-50 transition-colors">
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                        Contractor :
                                    </td>
                                    <td className="p-1" colSpan={3}>
                                        <span className="text-xs">{estimation.contractor || "-"}</span>
                                    </td>
                                </tr>

                                <tr className="hover:bg-blue-50 transition-colors">
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                        Work Name :
                                    </td>
                                    <td className="p-1" colSpan={3}>
                                        <span className="text-xs">{estimation.work_name || "-"}</span>
                                    </td>
                                </tr>

                                <tr className="hover:bg-blue-50 transition-colors">
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                        Month/Year :
                                    </td>
                                    <td className="p-1" colSpan={3}>
                                        <span className="text-xs">{estimation.month_year || "-"}</span>
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
                                    <th className="p-2 border-r font-bold w-[80px] border-slate-300">Vardhi</th>
                                    <th className="p-2 border-r font-bold border-slate-300">Item Name</th>
                                    <th className="p-2 border-r font-bold w-[80px] border-slate-300 text-right">Size</th>
                                    <th className="p-2 border-r font-bold w-[80px] border-slate-300 text-right">Rate</th>
                                    <th className="p-2 border-r font-bold w-[60px] border-slate-300 text-right">Qty</th>
                                    <th className="p-2 border-r font-bold w-[80px] border-slate-300">Unit</th>
                                    <th className="p-2 border-r font-bold w-[100px] border-slate-300 text-right">Amount</th>
                                </tr>
                            </thead>

                            <tbody className="divide-y">
                                {vardhiGroups().length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-4 text-center text-muted-foreground text-xs">
                                            No items found
                                        </td>
                                    </tr>
                                ) : (
                                    vardhiGroups().map((group) => {
                                        const vardhiTotal = calculateVardhiTotal(group.items);
                                        return (
                                            <React.Fragment key={group.vardhi.id}>
                                                <tr className="bg-slate-200 font-semibold border-b-2 border-slate-300">
                                                    <td className="p-2 border-r border-slate-300">
                                                        <Badge variant="secondary" className="font-mono text-[10px]">
                                                            {group.vardhi.vardhi_number}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-2 border-r border-slate-300" colSpan={5}>
                                                        <span className="text-xs font-semibold">
                                                            {group.vardhi.name}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground ml-2">
                                                            ({group.vardhi.date ? new Date(group.vardhi.date).toLocaleDateString("en-GB") : "-"})
                                                        </span>
                                                    </td>
                                                    <td className="p-2 border-r border-slate-300 text-right font-semibold">
                                                        ₹{formatIndianCurrency(vardhiTotal)}
                                                    </td>
                                                </tr>
                                                {group.items.map((item: any, idx: number) => (
                                                    <tr key={item.id || idx} className="hover:bg-blue-50 transition-colors">
                                                        <td className="p-2 border-r text-left text-xs text-muted-foreground">
                                                        </td>
                                                        <td className="p-2 border-r">
                                                            <span className="text-xs">
                                                                {item.item_name || item.item?.item_name || item.custom_name || "-"}
                                                            </span>
                                                        </td>
                                                        <td className="p-2 border-r text-right">
                                                            <span className="text-xs">{item.size || "-"}</span>
                                                        </td>
                                                        <td className="p-2 border-r text-right">
                                                            <span className="text-xs">₹{formatIndianCurrency(Number(item.rate) || 0)}</span>
                                                        </td>
                                                        <td className="p-2 border-r text-right">
                                                            <span className="text-xs">{item.quantity || "-"}</span>
                                                        </td>
                                                        <td className="p-2 border-r">
                                                            <span className="text-xs">{item.unit_name || "-"}</span>
                                                        </td>
                                                        <td className="p-2 border-r text-right font-medium">
                                                            <span className="text-xs">₹{formatIndianCurrency(Number(item.amount) || 0)}</span>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </React.Fragment>
                                        );
                                    })
                                )}
                            </tbody>
                            <tfoot className="bg-slate-200 font-bold border-t-2 border-slate-300">
                                <tr>
                                    <td colSpan={6} className="p-3 text-right text-xs">Grand Total :</td>
                                    <td className="p-3 text-right text-xs">₹{formatIndianCurrency(grandTotal)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            </div>
            <style jsx global>{`@media print {  body {    margin: 10mm   }`}</style>
        </div>
    );
}
