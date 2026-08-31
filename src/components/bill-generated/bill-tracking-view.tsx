"use client";

import React, { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    FileText, Image, Camera, File
} from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import PrintViewClient from "./print-view-client";
import { Button } from "../ui/button";
import AttachmentModal from "../vardhi/AttachmentModal";

interface VardhiItem {
    id?: string;
    vardhi_id: string;
    item_id: string | null;
    custom_name: string;
    size: string;
    rate: number;
    quantity: number;
    amount: number;
    item_name: string;
    unit_name?: string;
    ay_no?: string;
}

interface Vardhi {
    id: string;
    vardhi_number: string;
    date: string;
    name?: string;
    location?: string;
    vardhiItems?: any[];
    employees?: any[];
    expenses?: any[];
    grand_total?: number;
}

interface BillTrackingData {
    file_no: string;
    zone_no: string;
    contractor: string;
    work_name: string;
    vardhis: Vardhi[];
    items: VardhiItem[];
}

interface Props {
    data: BillTrackingData;
    estimation?: any;
}

const attachmentTypes = [
    {
        label: "Site Photography",
        type: "site_photography",
        icon: Camera,
    },
    {
        label: "Site Clear Photo",
        type: "site_clear_photo",
        icon: Image,
    },
    {
        label: "Store Report",
        type: "other_attachment",
        icon: File,
    },
    {
        label: "Other PDF",
        type: "report_pdf",
        icon: FileText,
    },
];

const inputClassName = "border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none select-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs";

export default function BillTrackingView({ data, estimation }: Props) {
    const getVardhiItems = (vardhiId: string): VardhiItem[] => {
        return data.items.filter((item) => item.vardhi_id === vardhiId);
    };
    const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
    const [selectedVardhiForAttachment, setSelectedVardhiForAttachment] =
        useState<{ id: string; vardhi_number?: string; type?: string } | null>(null);
    const openAttachmentModal = (vardhi: { id: string; vardhi_number: string, type: any }) => {
        setSelectedVardhiForAttachment(vardhi);
        setAttachmentModalOpen(true);
    };

    return (
        <>
            <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b">Basic Information</h3>
                <div className="rounded-md border overflow-hidden">
                    <div className="overflow-auto">
                        <table className="w-full text-sm border-collapse">
                            <tbody className="divide-y">
                                <tr className="hover:bg-blue-50 transition-colors">
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                        File No. :
                                    </td>
                                    <td className="p-1 border-r">
                                        <Input
                                            value={data.file_no || ""}
                                            disabled
                                            className={inputClassName}
                                        />
                                    </td>

                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                        ઝોન નં :
                                    </td>
                                    <td className="p-1">
                                        <Input
                                            value={data.zone_no || ""}
                                            disabled
                                            className={inputClassName}
                                        />
                                    </td>
                                </tr>

                                <tr className="hover:bg-blue-50 transition-colors">
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                        કોન્ટ્રાકટર :
                                    </td>
                                    <td className="p-1" colSpan={3}>
                                        <Input
                                            value={data.contractor || ""}
                                            disabled
                                            className={inputClassName}
                                        />
                                    </td>
                                </tr>

                                <tr className="hover:bg-blue-50 transition-colors">
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                        કામનું નામ :
                                    </td>
                                    <td className="p-1" colSpan={3}>
                                        <Input
                                            value={data.work_name || ""}
                                            disabled
                                            className={inputClassName}
                                        />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {data.vardhis && data.vardhis.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b">
                        <h3 className="text-sm font-medium text-muted-foreground">Vardhi Details</h3>
                        {estimation && <PrintViewClient type="vardhi-details" estimation={estimation} />}
                    </div>
                    <div className="rounded-md border overflow-hidden">
                        <div className="overflow-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead className="bg-slate-100">
                                    <tr className="text-[11px] uppercase tracking-wider text-slate-700 border-b-2 border-slate-300 text-left">
                                        <th className="p-2 border-r font-bold w-[18%] border-slate-300">Vardhi No </th>
                                        <th className="p-2 border-r font-bold w-[350px] border-slate-300" colSpan={3}>Name </th>
                                        <th className="p-2 border-r font-bold w-[100px] border-slate-300">Date </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {data.vardhis.map((vardhi) => {
                                        const vardhiItems = getVardhiItems(vardhi.id);

                                        return (
                                            <React.Fragment key={vardhi.id}>
                                                <tr className="bg-slate-200 font-semibold border-b-2 border-slate-300">
                                                    <td className="p-2 border-r border-slate-300  w-[20%]" >
                                                        <Badge variant="secondary" className="font-mono">{vardhi.vardhi_number}</Badge>
                                                    </td>
                                                    <td className="p-2 border-r border-slate-300" colSpan={3}>
                                                        <div className="flex items-center gap-1 justify-between">
                                                            <span className="text-xs whitespace-normal break-words">{vardhi.name || vardhi.location || "-"}</span>
                                                        </div>
                                                    </td>

                                                    <td className="p-2 border-r border-slate-300" >
                                                        <span className="text-xs text-muted-foreground">
                                                            {new Date(vardhi.date).toLocaleDateString("en-GB")}
                                                        </span>
                                                    </td>
                                                </tr>
                                                {vardhiItems.map((item, idx) => {
                                                    return (
                                                        <tr key={`${vardhi.id}-item-${idx}`} className="hover:bg-blue-50 transition-colors">
                                                            <td className="p-2 border-r text-left text-xs text-muted-foreground w-[18%]">
                                                                {idx === 0 && (
                                                                    <div className="flex flex-wrap gap-2">
                                                                        <TooltipProvider>
                                                                            {attachmentTypes.map((att) => {
                                                                                const Icon = att.icon;
                                                                                return (
                                                                                    <Tooltip key={att.type}>
                                                                                        <TooltipTrigger asChild>
                                                                                            <Button
                                                                                                variant="ghost"
                                                                                                size="sm"
                                                                                                onClick={() =>
                                                                                                    openAttachmentModal({
                                                                                                        id: vardhi.id,
                                                                                                        vardhi_number: vardhi.vardhi_number,
                                                                                                        type: att.type,
                                                                                                    })
                                                                                                }
                                                                                                className="h-8 px-2 text-xs flex items-center gap-1"
                                                                                            >
                                                                                                <Icon className="h-4 w-4" />
                                                                                                {/* {att.label} */}
                                                                                            </Button>
                                                                                        </TooltipTrigger>
                                                                                        <TooltipContent>
                                                                                            <p>{att.label}</p>
                                                                                        </TooltipContent>
                                                                                    </Tooltip>
                                                                                );
                                                                            })}
                                                                        </TooltipProvider>
                                                                    </div>
                                                                )}
                                                            </td>

                                                            <td className="p-2 border-r w-[350px]">
                                                                <div className="flex flex-col">
                                                                    <span className="font-medium text-xs">{item.item_name || item.custom_name || "Select Item"}</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-2 border-r w-[170px]">
                                                                <Input
                                                                    value={item.size || ""}
                                                                    disabled
                                                                    className="border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs"
                                                                />
                                                            </td>
                                                            <td className="p-2 border-r text-xs text-muted-foreground">
                                                                {item.unit_name || "Nos"}
                                                            </td>
                                                            <td className="p-2 text-xs text-muted-foreground">

                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
            <AttachmentModal
                isOpen={attachmentModalOpen}
                onClose={() => setAttachmentModalOpen(false)}
                vardhiId={selectedVardhiForAttachment?.id || ''}
                vardhiNumber={selectedVardhiForAttachment?.vardhi_number}
                defaultType={selectedVardhiForAttachment?.type}
            />
        </>
    );
}
