"use client";

import React from "react";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import BillTrackingView from "./bill-tracking-view";
import PrintViewClient from "./print-view-client";
import ManjuriPrintView from "./manjuri-print-view";
import EstimationPrintView from "./estimation-print-view";
import InvoiceViewClient from "./invoice-view-client";
import VardhiWaterWorksDepartmentView from "./vardhi-water-works-department-view";
import { calculateSizeFromString } from "@/lib/utils/sizeFormatter";

interface Props {
    estimation: any;
    invoice?: any | null;
}

export default function BillViewAccordion({ estimation, invoice }: Props) {
    const allItems: any[] = [];

    (estimation.vardhis || []).forEach((vardhi: any) => {
        const vardhiId = vardhi.id;
        const vardhiItems = vardhi.vardhiItems || [];
        const additionalItems = vardhi.additionalItems || [];

        vardhiItems.forEach((vi: any) => {
            const qty = calculateSizeFromString(vi.size);

            const rate = vi.rate ? Number(vi.rate) : 0;

            allItems.push({
                ...vi,
                id: vi.id,
                vardhi_id: vardhiId,
                item_id: vi.item_id || null,
                custom_name: "",
                size: vi.size || "",
                rate: rate,
                quantity: qty,
                amount: qty * rate,
                item_name: vi.item?.item_name || "",
                unit_name: vi.item?.unit?.unit_name || "",
            });
        });

        additionalItems.forEach((ai: any) => {
            const qty = Number(ai.qty) || 0;
            const rate = Number(ai.rate) || 0;

            allItems.push({
                ...ai,
                id: ai.id,
                vardhi_id: vardhiId,
                item_id: ai.item_id || null,
                custom_name: ai.item_name || "",
                size: ai.size || "",
                rate: rate,
                quantity: qty,
                amount: Number(ai.amount) || qty * rate,
                item_name: ai.item_name || "",
                unit_name: ai.item?.unit?.unit_name || "",
            });
        });
    });

    // (estimation.items || []).forEach((item: any) => {
    //     const existingIndex = allItems.findIndex(
    //         mi => mi.vardhi_id === item.vardhi_id && mi.item_id === item.item_id && mi.size === item.size
    //     );

    //     if (existingIndex === -1) {
    //         allItems.push({
    //             id: item.id,
    //             vardhi_id: item.vardhi_id || null,
    //             item_id: item.item_id || null,
    //             custom_name: item.custom_name || "",
    //             size: item.size || "",
    //             rate: Number(item.rate) || 0,
    //             quantity: Number(item.quantity) || 0,
    //             amount: Number(item.amount) || 0,
    //             item_name: item.item?.item_name || item.custom_name || "",
    //             unit_name: item.unit?.unit_name || "",
    //         });
    //     }
    // });

    const billTrackingData = {
        file_no: estimation.file_no || "",
        zone_no: estimation.zone_no || "",
        contractor: estimation.contractor || "",
        work_name: estimation.work_name || "",
        vardhis: estimation.vardhis || [],
        items: allItems,
    };
    
    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Bill Tracking
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <PrintViewClient type="all" estimation={estimation} />
                </div>
            </div>



            <Accordion type="multiple"
                defaultValue={["item-1", "item-2", "item-3", "item-4", "item-5"]} className="rounded-lg border">
                <AccordionItem value="item-5" className="border-b last:border-b-0">
                    <AccordionTrigger className="px-4 py-3 text-base font-semibold rounded-md transition-colors no-underline">
                        Waterworks Department
                        <div className="ml-auto mr-[10px]">
                            <PrintViewClient type="gujarati-doc" estimation={estimation} />
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4">
                        <VardhiWaterWorksDepartmentView
                            estimationId={estimation.id}
                            workName={estimation.work_name}
                            zoneNo={estimation.zone_no}
                            contractor={estimation.contractor}
                            estimationNo={estimation.estimation_no}
                            amount={estimation.total_amount.toFixed(2)}
                            monthYear={estimation.month_year}
                        />
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-1" className="border-b last:border-b-0">
                    <AccordionTrigger className="px-4 py-3 text-base font-semibold  rounded-md transition-colors no-underline">
                        View Bill Generated
                        <div className="ml-auto mr-[10px]">
                            <PrintViewClient type="report" estimation={estimation} />
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4  *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 px-4 ">
                        <BillTrackingView data={billTrackingData} estimation={estimation} />
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-2">
                    <AccordionTrigger className="px-4 py-3 text-base font-semibold  rounded-md transition-colors  items-center justify-between">
                        Manjuri
                        <div className="ml-auto mr-[10px]">
                            <PrintViewClient type="manjuri" estimation={estimation} />
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 ">
                        <div>
                            <ManjuriPrintView estimation={estimation} />
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-3">
                    <AccordionTrigger className="px-4 py-3 text-base font-semibold  rounded-md transition-colors">
                        Estimate
                        <div className="ml-auto mr-[10px]">
                            <PrintViewClient type="estimate" estimation={estimation} />
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 ">
                        <div>
                            <EstimationPrintView estimation={estimation} />
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="item-4">
                    <AccordionTrigger className="px-4 py-3 text-base font-semibold  rounded-md transition-colors">
                        Invoice
                        <div className="ml-auto mr-[10px]">
                            <PrintViewClient type="invoice" estimation={estimation} />
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-4 ">
                        <div>
                            <InvoiceViewClient invoice={invoice} estimation={estimation} />
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>

            <style jsx global>{`@media print { body { margin: 10mm } }`}</style>
        </div >
    );
}
