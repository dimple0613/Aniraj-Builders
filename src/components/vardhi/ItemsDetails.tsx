"use client";

import { Field, FieldArray } from "formik";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, ChevronsUpDown, Pencil } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import axios from "axios";
import { toast } from "sonner";
import { InlineSelect } from "@/components/common/InlineSelect";
import {
    normalizeSize,
    calculateSizeFromString,
} from "@/lib/utils/sizeFormatter";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from "@/components/ui/command";
import { useEffect, useState } from "react";

interface MasterItem {
    id: string;
    item_name: string;
    unit_id: string;
    unit_name: string;
    ay_id?: string | null;
    ay_no?: string | null;
    group_id?: string | null;
    work_type: boolean;
    unit?: { unit_name?: string };
    ay?: { ay_no?: string };
    group?: { id: string; name: string };
    searchPreferences?: Array<{ value: string }>;
    workTypePrices?: Array<{
        work_type_id: string;
        price: number;
        start_date: string;
        expiry_date?: string | null;
        workType?: { id: string; name: string };
    }>;
}

interface WorkType {
    id: string;
    name: string;
}

const getRateForItem = (
    masterItem: MasterItem | undefined,
    workType: WorkType | undefined,
    createdAtDate: string | Date | null,
): number => {
    if (!masterItem || !workType) return 0;

    if (!masterItem.workTypePrices?.length) return 0;

    const now = createdAtDate ? new Date(createdAtDate) : new Date();

    const sameWorkTypePrices = masterItem.workTypePrices
        .filter((wtp: any) => wtp.workType?.id === workType.id)
        .sort(
            (a: any, b: any) =>
                new Date(a.start_date).getTime() - new Date(b.start_date).getTime(),
        );
    
    let activePrice = sameWorkTypePrices.find((wtp: any) => {
        const startDate = new Date(wtp.start_date).getTime();
        const expiryDate = wtp.expiry_date
            ? new Date(wtp.expiry_date).getTime()
            : Infinity;

        return startDate <= now.getTime() && now.getTime() <= expiryDate;
    });
    

    if (!activePrice) {
        activePrice = sameWorkTypePrices.find(
            (wtp: any) => new Date(wtp.start_date).getTime() > now.getTime(),
        );
    }

    // const activePrice = sameWorkTypePrices[sameWorkTypePrices.length - 1];
 
    return activePrice ? Number(activePrice.price) || 0 : 0;
};

export default function ItemsDetails({
    values,
    itemSearchOpen,
    setItemSearchOpen,
    setFieldValue,
    allMasterItems,
    touched,
    errors,
    workType,
    createdAtDate,
    disabled = false,
    isZoneRole = false,
    originalItemCount = 0,
}: any) {
    const [activeCorrections, setActiveCorrections] = useState<number[]>([]);

    const toggleCorrection = (index: number) => {
        setActiveCorrections(prev =>
            prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index],
        );
    };

    const isExistingItem = (index: number) => isZoneRole && index < originalItemCount;
    const isItemEditable = (index: number) => !isExistingItem(index) || activeCorrections.includes(index);
    const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
    const [selectedGroupId, setSelectedGroupId] = useState<string>("");

    useEffect(() => {
        const fetchGroups = async () => {
            try {
                const res = await axios.get("/api/sor-groups?limit=9999");
                setGroups(res.data?.data || []);
            } catch {
                console.error("Failed to fetch groups");
            }
        };
        fetchGroups();
    }, []);

    const handleCreateGroup = async (value: string) => {
        try {
            const res = await axios.post("/api/sor-groups", { name: value });
            const newGroup = res.data;
            await axios.get("/api/sor-groups?limit=9999").then((r) => setGroups(r.data?.data || []));
            return { id: newGroup.id, label: newGroup.name };
        } catch (error: any) {
            if (error.response?.status === 409) {
                toast.error(error.response.data.error);
                return null;
            }
            console.error(error);
            toast.error("Something went wrong");
            return null;
        }
    };

    const handleGroupChange = (groupId: string) => {
        setSelectedGroupId(groupId);
        if (!groupId) return;

        const existingIds = new Set(
            (values.vardhiItems || []).map((itm: any) => itm.item_id).filter(Boolean),
        );

        const matchingItems = allMasterItems.filter(
            (itm: MasterItem) => itm.group_id === groupId && !existingIds.has(itm.id),
        );

        const newItems = matchingItems.map((itm: MasterItem) => {
            const calculatedRate = getRateForItem(itm, workType, createdAtDate);
            return {
                item_id: itm.id,
                item_name: itm.item_name,
                unit_id: itm.unit_id,
                unit_name: itm.unit_name || itm.unit?.unit_name || "",
                ay_id: itm.ay_id,
                ay_no: itm.ay_no || itm.ay?.ay_no || "",
                size: "",
                qty: "",
                rate: calculatedRate,
                amount: 0,
            };
        });

        setFieldValue("vardhiItems", [...(values.vardhiItems || []), ...newItems]);
    };
    useEffect(() => {
        if (values.vardhiItems && values.vardhiItems.length > 0) {
            values.vardhiItems.forEach((item: any, index: number) => {
                const calculatedQty = calculateSizeFromString(item.size || "");
                const rate = parseFloat(item.rate) || 0;
                const calculatedAmount = calculatedQty * rate;

                if (parseFloat(item.qty) !== calculatedQty) {
                    setFieldValue(`vardhiItems.${index}.qty`, calculatedQty);
                }
                if (parseFloat(item.amount) !== calculatedAmount) {
                    setFieldValue(`vardhiItems.${index}.amount`, calculatedAmount);
                }
            });
        }
    }, [values.vardhiItems, setFieldValue]);

    const handleItemSelect = (index: number, itm: MasterItem) => {
        setFieldValue(`vardhiItems.${index}.item_id`, itm.id);
        setFieldValue(`vardhiItems.${index}.item_name`, itm.item_name);
        setFieldValue(`vardhiItems.${index}.unit_id`, itm.unit_id);
        setFieldValue(
            `vardhiItems.${index}.unit_name`,
            itm.unit_name || itm.unit?.unit_name || "",
        );
        setFieldValue(`vardhiItems.${index}.ay_id`, itm.ay_id);
        setFieldValue(
            `vardhiItems.${index}.ay_no`,
            itm.ay_no || itm.ay?.ay_no || "",
        );

        const calculatedRate = getRateForItem(itm, workType, createdAtDate);
        setFieldValue(`vardhiItems.${index}.rate`, calculatedRate);

        const qty = parseFloat(values.vardhiItems[index]?.qty) || 0;
        const amount = qty * calculatedRate;
        setFieldValue(`vardhiItems.${index}.amount`, amount);

        setItemSearchOpen(null);
    };

    const handleSizeChange = (index: number, value: string) => {
        const normalizedSize = normalizeSize(value);
        setFieldValue(`vardhiItems.${index}.size`, normalizedSize);
        const calculatedQty = calculateSizeFromString(normalizedSize);
        const rate = parseFloat(values.vardhiItems[index]?.rate) || 0;
        setFieldValue(`vardhiItems.${index}.qty`, calculatedQty);
        setFieldValue(`vardhiItems.${index}.amount`, calculatedQty * rate);
    };

    const handleRateChange = (index: number, value: string) => {
        setFieldValue(`vardhiItems.${index}.rate`, value);
        const qty = parseFloat(values.vardhiItems[index]?.qty) || 0;
        const rate = parseFloat(value) || 0;
        setFieldValue(`vardhiItems.${index}.amount`, qty * rate);
    };
    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
                <h3 className="text-sm font-medium text-muted-foreground">
                    Items Details
                </h3>

            </div>

            <div className="rounded-md border overflow-hidden">
                <FieldArray name="vardhiItems">
                    {({ push, remove }) => (
                        <div className="overflow-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead className="sticky top-0 z-10 bg-slate-100">
                                    <tr className="text-[11px] uppercase tracking-wider text-slate-700 border-b-2 border-slate-300 text-left">
                                        <th className="p-3 border-r font-bold w-[50px]">SR No</th>
                                        <th className="p-3 border-r font-bold w-[80px]">Item No</th>
                                        <th className="p-3 border-r font-bold w-[180px]">
                                            Item Name
                                        </th>
                                        <th className="p-3 border-r font-bold w-[80px]">Size</th>
                                        <th className="p-3 border-r font-bold w-[70px]">Rate</th>
                                        <th className="p-3 border-r font-bold w-[70px]">Qty</th>
                                        <th className="p-3 border-r font-bold w-[100px]">
                                            Subtotal
                                        </th>
                                        <th className="p-3 border-r font-bold w-[45px] text-right">
                                            Action
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {values.vardhiItems.map((item: any, index: number) => (
                                        <tr
                                            key={index}
                                            className="hover:bg-blue-50 transition-colors"
                                        >
                                            <td className="p-2 border-r text-center text-xs">
                                                {index + 1}
                                            </td>
                                            <td className="p-2 border-r text-xs">
                                                {item.ay_no || '-'}
                                            </td>
                                            <td className="p-2 space-y-2 border-r">
                                                <Popover
                                                    open={itemSearchOpen === index}
                                                    onOpenChange={(open) =>
                                                        setItemSearchOpen(open ? index : null)
                                                    }
                                                >
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            className="w-full justify-between font-normal h-8 text-xs"
                                                            disabled={disabled || (isExistingItem(index) && !isItemEditable(index))}
                                                        >
                                                            <span className="">
                                                                {item.item_name || "Select item"}
                                                            </span>
                                                            <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                                        </Button>
                                                    </PopoverTrigger>

                                                    <PopoverContent
                                                        className="w-[300px] p-0"
                                                        align="start"
                                                    >
                                                        <Command>
                                                            <CommandInput
                                                                placeholder="Search items..."
                                                                className="h-8"
                                                            />
                                                            <CommandEmpty>No item found.</CommandEmpty>

                                                            <CommandGroup className="max-h-60 overflow-auto">
                                                                {allMasterItems?.map((itm: MasterItem) => (
                                                                    <CommandItem
                                                                        key={itm.id}
                                                                        value={`${itm.item_name?.toLowerCase()} ${itm.searchPreferences?.map((sp: any) => sp.value.toLowerCase()).join(" ")}`}
                                                                        onSelect={() =>
                                                                            handleItemSelect(index, itm)
                                                                        }
                                                                        className="cursor-pointer text-xs"
                                                                    >
                                                                        {itm.item_name}
                                                                    </CommandItem>
                                                                ))}
                                                            </CommandGroup>
                                                        </Command>
                                                    </PopoverContent>
                                                </Popover>
                                                {touched.vardhiItems?.[index]?.item_id &&
                                                    typeof errors.vardhiItems?.[index] === "object" &&
                                                    errors.vardhiItems?.[index]?.item_id && (
                                                        <p className="text-xs text-red-500">
                                                            {errors.vardhiItems[index]?.item_id}
                                                        </p>
                                                    )}
                                            </td>

                                            <td className="p-2 border-r">
                                                <Field
                                                    as={Input}
                                                    name={`vardhiItems.${index}.size`}
                                                    placeholder="Size"
                                                    className="h-8 text-xs"
                                                    onChange={(e: any) =>
                                                        handleSizeChange(index, e.target.value)
                                                    }
                                                    disabled={disabled || (isExistingItem(index) && !isItemEditable(index))}
                                                />
                                                {touched.vardhiItems?.[index]?.size &&
                                                    typeof errors.vardhiItems?.[index] === "object" &&
                                                    errors.vardhiItems?.[index]?.size && (
                                                        <p className="text-xs text-red-500">
                                                            {errors.vardhiItems[index]?.size}
                                                        </p>
                                                    )}
                                            </td>

                                            <td className="p-2 border-r">
                                                <Field
                                                    as={Input}
                                                    type="number"
                                                    name={`vardhiItems.${index}.rate`}
                                                    placeholder="0.00"
                                                    className="h-8 text-xs text-right"
                                                    onChange={(e: any) =>
                                                        handleRateChange(index, e.target.value)
                                                    }
                                                    disabled
                                                />
                                                {touched.vardhiItems?.[index]?.rate &&
                                                    typeof errors.vardhiItems?.[index] === "object" &&
                                                    errors.vardhiItems?.[index]?.rate && (
                                                        <p className="text-xs text-red-500">
                                                            {errors.vardhiItems[index]?.rate}
                                                        </p>
                                                    )}
                                            </td>

                                            <td className="p-2 border-r text-right font-medium">
                                                <span
                                                    className={`${touched.vardhiItems?.[index]?.size && errors.vardhiItems?.[index]?.qty ? "text-red-500" : ""}`}
                                                >
                                                    {calculateSizeFromString(item.size || "")}
                                                </span>
                                                {touched.vardhiItems?.[index]?.size &&
                                                    errors.vardhiItems?.[index]?.qty && (
                                                        <p className="text-xs text-red-500">
                                                            {errors.vardhiItems[index]?.qty}
                                                        </p>
                                                    )}
                                            </td>

                                            <td className="p-2 border-r text-right font-medium">
                                                ₹
                                                {(parseFloat(item.amount) || 0).toLocaleString(
                                                    "en-IN",
                                                    { minimumFractionDigits: 2 },
                                                )}
                                            </td>

                                            <td className="p-2 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {isExistingItem(index) && (
                                                        <TooltipProvider>
                                                            <Tooltip>
                                                                <TooltipTrigger asChild>
                                                                    <Button
                                                                        type="button"
                                                                        variant="ghost"
                                                                        size="icon"
                                                                        className={`h-7 w-7 ${activeCorrections.includes(index) ? 'text-blue-600 hover:bg-blue-100' : 'text-muted-foreground hover:bg-muted'}`}
                                                                        onClick={() => toggleCorrection(index)}
                                                                    >
                                                                        <Pencil className="h-3 w-3" />
                                                                    </Button>
                                                                </TooltipTrigger>
                                                                <TooltipContent>
                                                                    <p>Correction</p>
                                                                </TooltipContent>
                                                            </Tooltip>
                                                        </TooltipProvider>
                                                    )}
                                                    {values.vardhiItems.length > 1 && (
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                                            onClick={() => remove(index)}
                                                            disabled={disabled}
                                                        >
                                                            <Trash2 className="h-3 w-3" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            <div className="p-2 bg-muted/10 border-t flex items-center gap-2">
                                <InlineSelect
                                    value={selectedGroupId}
                                    onChange={(value: any) => handleGroupChange(value)}
                                    placeholder="Select group"
                                    options={groups.map((g) => ({ label: g.name, value: g.id }))}
                                    disabled={disabled && !isZoneRole}
                                    className="w-[180px]"
                                />
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        push({
                                            item_id: "",
                                            item_name: "",
                                            size: "",
                                            qty: "",
                                            rate: "",
                                            amount: "",
                                        })
                                    }
                                    className="text-primary text-xs h-7"
                                    disabled={disabled && !isZoneRole}
                                >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Add Item
                                </Button>
                            </div>
                        </div>
                    )}
                </FieldArray>
                {touched.vardhiItems &&
                    typeof errors.vardhiItems === "string" &&
                    errors.vardhiItems && (
                        <p className="p-2 text-xs text-red-500">{errors.vardhiItems}</p>
                    )}
            </div>
        </div>
    );
}
