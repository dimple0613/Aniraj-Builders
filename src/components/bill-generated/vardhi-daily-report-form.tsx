"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { calculateSizeFromString } from "@/lib/utils/sizeFormatter";
import {
    Loader2,
    Plus,
    Trash2,
    ChevronsUpDown,
    Paperclip, FileText, Image, Camera, File
} from "lucide-react";
import {
    vardhiDailyReportValidationSchema,
    vardhiDailyReportInitialValues,
} from "@/lib/validations/bill-generated";
import {
    VardhiDailyReportFormData,
    VardhiForDailyReport,
    VardhiDailyReportItemFormData,
} from "@/types/bill-generated";
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
import { useCompanyContext } from "@/lib/company-context";
import AttachmentModal from "@/components/vardhi/AttachmentModal";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

const MONTHS = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
];

interface MasterItem {
    id: string;
    item_name: string;
    unit_id: string;
    unit_name: string;
    ay_id?: string | null;
    ay_no?: string | null;
    work_type: boolean;
    workTypePrices?: Array<{
        work_type_id: string;
        price: number;
        workType?: { id: string; name: string };
    }>;
}

interface WorkType {
    id: string;
    name: string;
}

function generateWorkName(location: string, vardhis: VardhiForDailyReport[]): string {
    if (vardhis.length === 0) return "";

    let minDate = new Date(vardhis[0].vardhi_start_date);
    let maxDate = new Date(vardhis[0].vardhi_end_date);

    vardhis.forEach(v => {
        const start = new Date(v.vardhi_start_date);
        const end = new Date(v.vardhi_end_date);
        if (start < minDate) minDate = start;
        if (end > maxDate) maxDate = end;
    });

    const s = `${MONTHS[minDate.getMonth()]}-${String(minDate.getFullYear()).slice(-2)}`;
    const e = `${MONTHS[maxDate.getMonth()]}-${String(maxDate.getFullYear()).slice(-2)}`;
    const range = s === e ? s : `${s}/${e}`;

    // const locations = Array.from(new Set(vardhis.map(v => v.location))).join(", ");
    return `${location} એ માં વિવિધ જગ્યાએ પાણીની લાઇનના મરામત કામો (${range})`;
}

function generateMonthYear(vardhis: VardhiForDailyReport[]): string {
    if (vardhis.length === 0) return "";
    let minDate = new Date(vardhis[0].vardhi_start_date);
    let maxDate = new Date(vardhis[0].vardhi_end_date);

    vardhis.forEach(v => {
        const start = new Date(v.vardhi_start_date);
        const end = new Date(v.vardhi_end_date);
        if (start < minDate) minDate = start;
        if (end > maxDate) maxDate = end;
    });

    const s = `${MONTHS[minDate.getMonth()]}-${String(minDate.getFullYear()).slice(-2)}`;
    const e = `${MONTHS[maxDate.getMonth()]}-${String(maxDate.getFullYear()).slice(-2)}`;
    return s === e ? s : `${s}/${e}`;
}

interface VardhiGroup {
    vardhi: VardhiForDailyReport;
    items: VardhiDailyReportItemFormData[];
}

interface Props {
    estimationId?: string;
    isViewOnly?: boolean;
}

export default function VardhiDailyReportForm({ estimationId, isViewOnly = false }: Props) {
    const router = useRouter();
    const { currentCompany } = useCompanyContext();

    const searchParams = useSearchParams();
    const isEdit = !!estimationId && !isViewOnly;

    const [loading, setLoading] = useState(false);
    const [pageLoading, setPageLoading] = useState(isEdit || isViewOnly);
    const [status, setStatus] = useState<"DRAFT" | "FINAL" | "APPROVED">("DRAFT");
    const locked = isViewOnly || status !== "DRAFT";

    const [allVardhis, setAllVardhis] = useState<VardhiForDailyReport[]>([]);
    const [selectedVardhis, setSelectedVardhis] = useState<VardhiForDailyReport[]>([]);
    const [vardhiOpen, setVardhiOpen] = useState(false);
    const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);
    const [selectedVardhiForAttachment, setSelectedVardhiForAttachment] =
        useState<{ id: string; vardhi_number?: string; type?: string } | null>(null);
    const [allMasterItems, setAllMasterItems] = useState<MasterItem[]>([]);
    const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
    const [units, setUnits] = useState<Array<{ id: string; unit_name: string }>>([]);
    const [itemSearchOpen, setItemSearchOpen] = useState<number | null>(null);
    const [createdAtDate, setCreatedAtDate] = useState<any>(null);

    const [formData, setFormData] = useState<VardhiDailyReportFormData>(vardhiDailyReportInitialValues);

    useEffect(() => {
        const loadInitialData = async () => {
            try {
                const [vardhisRes, itemsRes, workTypesRes, unitsRes] = await Promise.all([
                    axios.get("/api/vardhi?limit=999999"),
                    axios.get("/api/item-management?limit=999999"),
                    axios.get("/api/work-type"),
                    axios.get("/api/units"),
                ]);

                setAllVardhis(vardhisRes.data?.data || vardhisRes.data || []);
                setAllMasterItems(itemsRes.data?.data || itemsRes.data || []);
                setWorkTypes(workTypesRes.data?.data || workTypesRes.data || []);
                setUnits(unitsRes.data?.data || unitsRes.data || []);

                const qVardhiIds = searchParams.get("vardhi_ids")?.split(",") || [];

                if (!isEdit && qVardhiIds.length > 0) {
                    const preSelected = (vardhisRes.data?.data || []).filter((v: any) => qVardhiIds.includes(v.id));
                    if (preSelected.length > 0) {
                        handleBatchSelectVardhis(preSelected);
                    }
                }

                const zone = searchParams.get("zone");
                const month = searchParams.get("month");
                const year = searchParams.get("year");

                const months = [
                    "January", "February", "March", "April", "May", "June",
                    "July", "August", "September", "October", "November", "December"
                ];

                if (!isEdit && (zone || month || year)) {
                    const filtered = vardhisRes.data?.data.filter((v: any) => {
                        let match = true;
                        if (zone) {
                            match = match && v.zone_id === zone;
                        }

                        if (month || year) {
                            const vardhiDate = new Date(v.date);

                            const monthIndex = month ? months.indexOf(month) : null;
                            const yearNumber = year ? Number(year) : null;

                            if (monthIndex !== -1 && monthIndex !== null) {
                                match = match && vardhiDate.getMonth() === monthIndex;
                            }

                            if (yearNumber) {
                                match = match && vardhiDate.getFullYear() === yearNumber;
                            }
                        }

                        return match;
                    });

                    if (filtered.length > 0) {
                        handleBatchSelectVardhis(filtered);
                    }
                }
            } catch (error) {
                console.error("Failed to load initial data:", error);
                toast.error("Failed to load initial data");
            }
        };
        loadInitialData();
    }, [searchParams, isEdit]);

    useEffect(() => {
        if (!estimationId) return;

        const fetchExisting = async () => {
            try {
                setPageLoading(true);
                const res = await axios.get(`/api/bill-generated/${estimationId}`);
                const est = res.data?.data;
                
                if (!est) {
                    console.error('[EditBill] No data returned from API');
                    toast.error("Bill Generated not found");
                    router.push("/bill-generated");
                    return;
                }
            
                const vardhiData = (est.vardhis || []).map((v: any) => ({
                    id: v.id,
                    vardhi_number: v.vardhi_number,
                    name: v.location || "",
                    date: v.date,
                    location: v.location,
                    vardhi_start_date: v.vardhi_start_date,
                    vardhi_end_date: v.vardhi_end_date,
                    work_type: v.work_type,
                    zone: v.zone || { id: "", name: "", file_no: 0 },
                }));
                
                setSelectedVardhis(vardhiData);
                setStatus(est.status);
                setCreatedAtDate(est.created_at);

                const mappedItems: VardhiDailyReportItemFormData[] = [];

                (est.vardhis || []).forEach((vardhi: any) => {
                    const vardhiId = vardhi.id;
                    const vardhiItems = vardhi.vardhiItems || [];
                    const additionalItems = vardhi.additionalItems || [];

                    vardhiItems.forEach((vi: any) => {
                        const qty = calculateSizeFromString(vi.size);
                        
                        const rate = vi.rate ? Number(vi.rate) : 0;
                        
                        mappedItems.push({
                            vardhi_id: vardhiId,
                            item_id: vi.item_id || null,
                            custom_name: "",
                            size: vi.size || "",
                            multiplier: "1",
                            rate: rate,
                            unit_id: vi.item?.unit_id || "",
                            unit_name: vi.item?.unit?.unit_name || "",
                            ay_id: vi.item?.ay_id || null,
                            ay_no: vi.item?.ay?.ay_no || "",
                            quantity: qty,
                            amount: qty * rate,
                            item_name: vi.item?.item_name || "",
                            isCustom: false,
                        });
                    });

                    additionalItems.forEach((ai: any) => {
                        const qty = Number(ai.qty) || 0;
                        const rate = Number(ai.rate) || 0;
                        
                        mappedItems.push({
                            vardhi_id: vardhiId,
                            item_id: null,
                            custom_name: ai.item_name || "",
                            size: ai.size || "",
                            multiplier: "1",
                            rate: rate,
                          unit_id: ai.item?.unit_id || "",
                            unit_name: ai.item?.unit?.unit_name || "",
                            ay_id: ai.item?.ay_id || null,
                            ay_no: ai.item?.ay?.ay_no || "",
                            quantity: qty,
                            amount: Number(ai.amount) || qty * rate,
                            item_name: ai.item_name || "",
                            isCustom: true,
                        });
                    });
                });

                (est.items || []).forEach((item: any) => {
                    const existingIndex = mappedItems.findIndex(
                        mi => mi.vardhi_id === item.vardhi_id && mi.item_id === item.item_id && mi.size === item.size
                    );
                    
                    if (existingIndex === -1) {
                        mappedItems.push({
                            vardhi_id: item.vardhi_id || null,
                            item_id: item.item_id || null,
                            custom_name: item.custom_name || "",
                            size: item.size || "",
                            multiplier: "1",
                            rate: Number(item.rate) || 0,
                            unit_id: item.unit_id || "",
                            unit_name: item.unit?.unit_name || "",
                            ay_id: item.ay_id || null,
                            ay_no: item.ay?.ay_no || "",
                            quantity: Number(item.quantity) || 0,
                            amount: Number(item.amount) || 0,
                            item_name: item.item?.item_name || item.custom_name || "",
                            isCustom: !item.item_id,
                        });
                    }
                });

                setFormData({
                    contractor: est.contractor || currentCompany?.company_name || "",
                    work_name: est.work_name || "",
                    file_no: est.file_no || "",
                    zone_no: est.zone_no || "",
                    month_year: est.month_year || "",
                    vardhi_ids: vardhiData.map((v: any) => v.id),
                    items: mappedItems,
                });
            } catch (error: any) {
                console.error('[EditBill] Error fetching bill:', error);
                const errorMsg = error.response?.data?.message || error.response?.data?.error || "Failed to load bill generated";
                toast.error(errorMsg);
            } finally {
                setPageLoading(false);
            }
        };
        fetchExisting();
    }, [estimationId, isEdit, router, currentCompany]);

    const vardhiGroups = useMemo((): VardhiGroup[] => {
        const groups: Map<string, VardhiGroup> = new Map();

        formData.items.forEach((item: any) => {
            const vardhiId = item.vardhi_id || "__custom__";
            if (!groups.has(vardhiId)) {
                const vardhi = vardhiId === "__custom__"
                    ? null
                    : selectedVardhis.find(v => v.id === vardhiId);

                groups.set(vardhiId, {
                    vardhi: vardhi || null as any,
                    items: []
                });
            }
            groups.get(vardhiId)!.items.push(item);
        });

        return Array.from(groups.values()).filter(g => g.vardhi !== null);
    }, [formData.items, selectedVardhis]);

    const getWorkTypeForVardhi = useCallback((vardhiId: string): WorkType | undefined => {
        const vardhi = selectedVardhis.find(v => v.id === vardhiId);
        if (!vardhi) return undefined;
        return workTypes.find(wt => wt.name === vardhi.work_type);
    }, [selectedVardhis, workTypes]);

    const getRateForItem = useCallback((itemId: string, vardhiId: string): number => {
        const masterItem = allMasterItems.find(i => i.id === itemId);
        if (!masterItem) return 0;

        const workType = getWorkTypeForVardhi(vardhiId);
        if (!workType) return 0;

        const price = masterItem.workTypePrices?.find(p => p.work_type_id === workType.id);
        return price?.price || 0;
    }, [allMasterItems, getWorkTypeForVardhi]);

    const openAttachmentModal = (vardhi: { id: string; vardhi_number: string, type: any }) => {
        setSelectedVardhiForAttachment(vardhi);
        setAttachmentModalOpen(true);
    };

    const handleBatchSelectVardhis = async (vardhis: VardhiForDailyReport[]) => {
        setSelectedVardhis(vardhis);

        const newVardhiIds = vardhis.map(v => v.id);

        if (vardhis.length > 0) {
            setFormData((prev: any) => ({
                ...prev,
                vardhi_ids: newVardhiIds,
                file_no: vardhis[0].zone?.file_no?.toString() || "",
                zone_no: vardhis[0].zone?.name || "",
                contractor: currentCompany?.company_name || "",
                work_name: generateWorkName(vardhis[0].zone?.name, vardhis),
                month_year: generateMonthYear(vardhis),
            }));

            try {
                const allItems: VardhiDailyReportItemFormData[] = [];

                for (const v of vardhis) {
                    const res = await axios.get(`/api/vardhi/items?vardhi_id=${v.id}`);
                    const workTypes_res = await axios.get(`/api/work-type`);
                    const allMasterItems_res = await axios.get(`/api/item-management?limit=999999`);
                    const workTypesData = workTypes_res.data.data;
                    const allMasterItemsData = allMasterItems_res.data.data;
                    const vardhiData = res.data.data;

                    if (vardhiData?.items) {
                        const workType = workTypesData.find((wt: any) => wt.id === v.work_type);
                        vardhiData.items.forEach((vi: any) => {
                            let rate = 0;
                            let sizeValue = 0;
                            if (workType && vi.item_id) {
                                const masterItem = allMasterItemsData.find((i: any) => i.id === vi.item_id);

                                if (masterItem.workTypePrices?.length) {
                                    const now = createdAtDate ? new Date(createdAtDate) : new Date();

                                    const sameWorkTypePrices = masterItem.workTypePrices
                                        .filter((wtp: any) => wtp.workType?.id === workType.id)
                                        .sort((a: any, b: any) =>
                                            new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
                                        );

                                    let activePrices = sameWorkTypePrices.find((wtp: any) => {
                                        const startDate = new Date(wtp.start_date).getTime();
                                        const expiryDate = wtp.expiry_date ? new Date(wtp.expiry_date).getTime() : Infinity;

                                        return startDate <= now.getTime() && now.getTime() <= expiryDate;
                                    });

                                    if (!activePrices) {
                                        activePrices = sameWorkTypePrices.find(
                                            (wtp: any) => new Date(wtp.start_date).getTime() > now.getTime()
                                        );
                                    }

                                    rate = activePrices ? Number(activePrices.price) || 0 : 0;

                                }
                                // if (masterItem?.workTypePrices?.length) {
                                //     const now = new Date(createdAtDate) ?? new Date();

                                //     const activePrices = masterItem.workTypePrices
                                //         .filter((p: any) => {
                                //             const isSameWorkType = p.work_type_id === workType.id;
                                //             const startValid = new Date(p.start_date) <= now;
                                //             const expiryValid = !p.expiry_date || new Date(p.expiry_date) >= now;

                                //             return isSameWorkType && startValid && expiryValid;
                                //         })
                                //         .sort((a: any, b: any) =>
                                //             new Date(b.start_date).getTime() - new Date(a.start_date).getTime()
                                //         );

                                //     rate = activePrices.length ? Number(activePrices[0].price) || 0 : 0;
                                // }
                            }

                            sizeValue = calculateSizeFromString(vi.size);

                            const quantity = sizeValue;

                            const rates = parseFloat(String(rate)) || 0;
                            const amount = rates * quantity;

                            allItems.push({
                                vardhi_id: v.id,
                                item_id: vi.item_id,
                                custom_name: "",
                                size: vi.size || "",
                                rate: rate,
                                unit_id: vi.unit_id,
                                unit_name: vi.unit_name || "Nos",
                                ay_id: vi.ay_id,
                                ay_no: vi.ay_no,
                                quantity: quantity || 0,
                                amount: amount || 0,
                                item_name: vi.item_name,
                                isCustom: false,
                            });
                        });
                    }
                }

                setFormData((prev: any) => ({ ...prev, items: allItems }));
            } catch (error) {
                console.error("Failed to load vardhi items:", error);
                toast.error("Failed to load items from Vardhis");
            }
        } else {
            setFormData((prev: any) => ({
                ...prev,
                vardhi_ids: [],
                items: [],
                file_no: "",
                zone_no: "",
                work_name: "",
                month_year: "",
            }));
        }
    };

    useEffect(() => {
        setFormData((prev: any) => ({ ...prev, contractor: currentCompany?.company_name || "", }));
    }, [currentCompany]);

    const toggleVardhi = (vardhi: VardhiForDailyReport) => {
        if (locked) return;
        const exists = selectedVardhis.find(v => v.id === vardhi.id);
        const newSelected = exists
            ? selectedVardhis.filter(v => v.id !== vardhi.id)
            : [...selectedVardhis, vardhi];

        const newItems = formData.items.filter((item: any) => {
            if (!exists) return true;
            return item.vardhi_id !== vardhi.id;
        });

        setFormData((prev: any) => ({ ...prev, items: newItems }));
        handleBatchSelectVardhis(newSelected);
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...formData.items];
        const item = { ...newItems[index] };


        if (field === "item_id" && value) {
            const masterItem: any = allMasterItems.find(i => i.id === value);
            if (masterItem) {
                item.item_id = value;
                item.item_name = masterItem.item_name;
                item.unit_id = masterItem.unit_id;
                item.unit_name = masterItem.unit_name || masterItem.unit.unit_name;
                item.ay_id = masterItem.ay_id;
                item.ay_no = masterItem.ay_no || masterItem.ay.ay_no || "";
                item.isCustom = false;

                // Get rate based on Vardhi work type
                if (item.vardhi_id) {
                    const vardhi = selectedVardhis.find(v => v.id === item.vardhi_id);
                    const vardhiWorkType = vardhi?.work_type || "";
                    // Find matching rate based on work type
                    let newRate = 0;
                    if (masterItem.workTypePrices?.length) {
                        const now = createdAtDate ? new Date(createdAtDate) : new Date();
                        const sameWorkTypePrices = masterItem.workTypePrices
                            .filter((wtp: any) => wtp.workType?.id === vardhiWorkType)
                            .sort((a: any, b: any) =>
                                new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
                            );

                        let matchingPrice = sameWorkTypePrices.find((wtp: any) => {
                            const startDate = new Date(wtp.start_date).getTime();
                            const expiryDate = wtp.expiry_date ? new Date(wtp.expiry_date).getTime() : Infinity;

                            return startDate <= now.getTime() && now.getTime() <= expiryDate;
                        });

                        if (!matchingPrice) {
                            matchingPrice = sameWorkTypePrices.find(
                                (wtp: any) => new Date(wtp.start_date).getTime() > now.getTime()
                            );
                        }

                        newRate = matchingPrice ? Number(matchingPrice.price) || 0 : 0;

                    }
                    item.rate = newRate;
                }
            }
        } else {
            (item as any)[field] = value;
        }


        if (field === "size") {
            let sizeValue = calculateSizeFromString(value as string);

            const multiplier = parseFloat(String(item.multiplier)) || 1;

            const rawQty = sizeValue * multiplier;

            // 👇 Proper rounding to 2 decimal (like 3.37)
            item.quantity = Math.floor(rawQty * 100) / 100;

            const rate = parseFloat(String(item.rate)) || 0;
            item.amount = item.quantity * rate;
        }

        if (field === "multiplier") {
            const size = parseFloat(String(item.size)) || 0;
            const multiplier = parseFloat(String(value)) || 1;
            item.quantity = size * multiplier;
            item.amount = (parseFloat(String(item.rate)) || 0) * item.quantity;
        }


        if (field === "rate" || field === "quantity") {
            const rate = parseFloat(String(field === "rate" ? value : item.rate)) || 0;
            const qty = parseFloat(String(field === "quantity" ? value : item.quantity)) || 0;
            item.amount = rate * qty;
        }


        if (field === "vardhi_id" && value && item.item_id) {
            const masterItem: any = allMasterItems.find(i => i.id === item.item_id);
            if (masterItem) {
                // Recalculate rate based on new vardhi's work type (ID-based comparison)
                item.rate = getRateForItem(masterItem, value);
            }
            item.amount = (parseFloat(String(item.rate)) || 0) * (parseFloat(String(item.quantity)) || 0);
        }

        newItems[index] = item;
        setFormData((prev: any) => ({ ...prev, items: newItems }));
    };

    const addItemToVardhi = (vardhiId: string) => {
        const vardhi = selectedVardhis.find(v => v.id === vardhiId);
        if (!vardhi) return;

        const newItem: VardhiDailyReportItemFormData = {
            vardhi_id: vardhiId,
            item_id: null,
            custom_name: "",
            size: "",
            multiplier: "1",
            rate: 0,
            unit_id: units[0]?.id || "",
            unit_name: units[0]?.unit_name || "Nos",
            quantity: 1,
            amount: 0,
            item_name: "",
            isCustom: true,
        };

        setFormData((prev: any) => ({
            ...prev,
            items: [...prev.items, newItem]
        }));
    };

    const addCustomItem = () => {
        const newItem: VardhiDailyReportItemFormData = {
            vardhi_id: null,
            item_id: null,
            custom_name: "",
            size: "",
            multiplier: "1",
            rate: 0,
            unit_id: units[0]?.id || "",
            unit_name: units[0]?.unit_name || "Nos",
            quantity: 1,
            amount: 0,
            item_name: "Custom Item",
            isCustom: true,
        };

        setFormData((prev: any) => ({
            ...prev,
            items: [...prev.items, newItem]
        }));
    };

    const removeItem = (index: number) => {
        if (locked) return;
        const newItems = formData.items.filter((_:any, i:any) => i !== index);
        setFormData((prev: any) => ({ ...prev, items: newItems }));
    };

    const calculateVardhiTotal = (items: VardhiDailyReportItemFormData[]): number => {
        return items.reduce((sum, item) => sum + ((parseFloat(String(item.rate)) || 0) * (parseFloat(String(item.quantity)) || 0)), 0);
    };

    const grandTotal = useMemo(() => {
        return formData.items.reduce((sum:any, item:any) =>
            sum + ((parseFloat(String(item.rate)) || 0) * (parseFloat(String(item.quantity)) || 0)), 0
        );
    }, [formData.items]);

    const handleSubmit = async () => {
        try {
            if (!formData.contractor.trim()) {
                toast.error("Contractor name is required");
                return;
            }
            if (!formData.work_name.trim()) {
                toast.error("Work name is required");
                return;
            }
            if (formData.items.length === 0) {
                toast.error("At least one item is required");
                return;
            }

            setLoading(true);

            const payload = {
                ...formData,
                items: formData.items.map((item: any) => ({
                    ...item,
                    amount: (parseFloat(String(item.rate)) || 0) * (parseFloat(String(item.quantity)) || 0),
                })),
            };

            if (isEdit) {
                await axios.put(`/api/bill-generated/${estimationId}`, payload);
                toast.success("Bill Generated updated successfully");
            } else {
                await axios.post("/api/bill-generated", payload);
                toast.success("Bill Generated created successfully");
            }
            router.push("/bill-generated");
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to save bill generated");
        } finally {
            setLoading(false);
        }
    };

    const handleStatusChange = async (newStatus: string) => {
        if (!isEdit) return;
        try {
            await axios.put(`/api/bill-generated/${estimationId}/status`, { status: newStatus });
            setStatus(newStatus as any);
            toast.success(`Status updated to ${newStatus}`);
        } catch (e: any) {
            toast.error(e.response?.data?.error || "Failed to update status");
        }
    };

    const handleInputChange = (field: keyof VardhiDailyReportFormData, value: string) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }));
    };

    if (pageLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        );
    }

    const attachmentTypes = [
        {
            label: "Report PDF",
            type: "report_pdf",
            icon: FileText,
        },
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
    ];

    return (
        <>
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        {isViewOnly ? "View Bill Generated" : isEdit ? "Edit Bill Generated" : "New Bill Generated"}
                    </h2>
                    <p className="text-muted-foreground text-sm">
                        {isViewOnly ? formData.work_name : isEdit ? formData.work_name : "Pricing for Multiple Work Orders"}
                    </p>
                </div>
            </div>


            <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b">Basic Information</h3>
                <div className="rounded-md border overflow-hidden">
                    <div className="overflow-auto">
                        <table className="w-full text-sm border-collapse">
                            <tbody className="divide-y">
                                <tr className="hover:bg-blue-50 transition-colors">
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                        File No. :
                                    </td>
                                    <td className="p-1 border-r">
                                        <Input
                                            value={formData.file_no}
                                            onChange={(e) => handleInputChange("file_no", e.target.value)}
                                            name="file_no"
                                            disabled={locked}
                                            className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none select-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs"
                                        />
                                    </td>

                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                        ઝોન નં :
                                    </td>
                                    <td className="p-1">
                                        <Input
                                            value={formData.zone_no}
                                            onChange={(e) => handleInputChange("zone_no", e.target.value)}
                                            name="zone_no"
                                            disabled={locked}
                                            className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none select-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs"
                                        />
                                    </td>
                                </tr>

                                <tr className="hover:bg-blue-50 transition-colors">
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                        કોન્ટ્રાકટર :--
                                    </td>
                                    <td className="p-1" colSpan={3}>
                                        <Input
                                            name="contractor"
                                            value={formData.contractor}
                                            onChange={(e) =>
                                                handleInputChange("contractor", e.target.value)
                                            }
                                            disabled={locked}
                                            required
                                            className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none select-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs"
                                        />
                                    </td>
                                </tr>

                                <tr className="hover:bg-blue-50 transition-colors">
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                        કામનું નામ :
                                    </td>
                                    <td className="p-1" colSpan={3}>
                                        <Input
                                            name="work_name"
                                            value={formData.work_name}
                                            onChange={(e) =>
                                                handleInputChange("work_name", e.target.value)
                                            }
                                            disabled={locked}
                                            required
                                            className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none select-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs"
                                        />
                                    </td>
                                </tr>


                                <tr className="hover:bg-blue-50 transition-colors hidden">
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                        Month / Year
                                    </td>
                                    <td className="p-1" colSpan={3}>
                                        <Input
                                            name="month_year"
                                            value={formData.month_year}
                                            onChange={(e) => handleInputChange("month_year", e.target.value)}
                                            disabled={locked}
                                            className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none select-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs"
                                        />
                                    </td>
                                </tr>

                                <tr className="hover:bg-blue-50 transition-colors hidden">
                                    <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                        Grand Total
                                    </td>
                                    <td className="p-1" colSpan={3}>
                                        <Input
                                            value={`₹${grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                                            disabled
                                            className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none select-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs"
                                        />
                                    </td>
                                </tr>
                                {!estimationId && (
                                    <tr className="hidden">
                                        <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold  hid">
                                            Selected Vardhis :
                                        </td>
                                        <td className="p-1" colSpan={3}>
                                            <Popover open={vardhiOpen} onOpenChange={setVardhiOpen}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="ghost"
                                                        className="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none select-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs"
                                                        disabled={locked}
                                                    >
                                                        {selectedVardhis.length > 0
                                                            ? `${selectedVardhis.length} Vardhis Selected`
                                                            : "Select Work Orders"}
                                                    </Button>
                                                </PopoverTrigger>

                                                <PopoverContent className="w-[500px] p-0">
                                                    <Command>
                                                        <CommandInput placeholder="Search work order..." />
                                                        <CommandEmpty>No work order found.</CommandEmpty>
                                                        <CommandGroup className="max-h-80 overflow-auto">
                                                            {allVardhis.map((v) => {
                                                                const isSelected = !!selectedVardhis.find(
                                                                    (s) => s.id === v.id
                                                                );
                                                                return (
                                                                    <CommandItem
                                                                        key={v.id}
                                                                        onSelect={() => toggleVardhi(v)}
                                                                    >
                                                                        <Checkbox checked={isSelected} />
                                                                        <span className="ml-2 font-mono">
                                                                            {v.vardhi_number}
                                                                        </span>
                                                                    </CommandItem>
                                                                );
                                                            })}
                                                        </CommandGroup>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </td>
                                    </tr>
                                )}

                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {selectedVardhis.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b">Vardhi Details</h3>
                    <div className="rounded-md border overflow-hidden">
                        <div className="overflow-auto">
                            <table className="w-full text-sm border-collapse">
                                <thead className="bg-slate-100">
                                    <tr className="text-[11px] uppercase tracking-wider text-slate-700 border-b-2 border-slate-300 text-left">


                                        <th className="p-3 border-r font-bold w-[18%] border-slate-300 ">Vardhi No </th>
                                        <th className="p-3 border-r font-bold w-[280px] border-slate-300" colSpan={3}>Name </th>
                                        <th className="p-3 border-r font-bold w-[80px] border-slate-300">Date </th>

                                        {!locked && <th className="p-3 w-[50px]"></th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {
                                        selectedVardhis.map((vardhi) => {
                                            const vardhiItems = formData.items.filter((item: any) => item.vardhi_id === vardhi.id);
                                            const vardhiTotal = calculateVardhiTotal(vardhiItems);

                                            return (
                                                <React.Fragment key={vardhi.id}>
                                                    <tr className="bg-slate-200 font-semibold border-b-2 border-slate-300">
                                                        <td className="p-2 border-r border-slate-300  w-[18%]" >
                                                            <Badge variant="secondary" className="font-mono">{vardhi.vardhi_number}</Badge>
                                                        </td>
                                                        <td className="p-2 border-r border-slate-300" colSpan={3}>
                                                            <div className="flex items-center gap-1 justify-between">
                                                                <span className="text-xs max-w-[200px] truncate ">{vardhi.name}</span>

                                                            </div>
                                                        </td>
                                                        <td className="p-2 border-r border-slate-300" >
                                                            <span className="text-xs text-muted-foreground">
                                                                {new Date(vardhi.date).toLocaleDateString("en-GB")}
                                                            </span>
                                                        </td>
                                                        <td className="p-2" >
                                                            <div className="flex items-center gap-1">
                                                                {!locked && (
                                                                    <Button
                                                                        variant="ghost"
                                                                        size="sm"
                                                                        onClick={() => addItemToVardhi(vardhi.id)}
                                                                        className="h-7 w-7 p-0 text-xs"
                                                                    >
                                                                        <Plus className="h-3 w-3" />
                                                                    </Button>
                                                                )}
                                                            </div>
                                                        </td>
                                                        {/* <td className="p-2 text-right font-mono bg-slate-100">
                                                            ₹{vardhiTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                        </td> */}
                                                        {/* {!locked && <td className="p-2"></td>} */}
                                                    </tr>
                                                    {vardhiItems.map((item:any, idx:any) => {
                                                        const actualIndex = formData.items.indexOf(item);
                                                        return (
                                                            <tr key={`${vardhi.id}-${actualIndex}`} className="hover:bg-blue-50 transition-colors">

                                                                <td className="p-2 border-r text-left text-xs text-muted-foreground">
                                                                    {
                                                                        idx === 0 && (
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
                                                                        )
                                                                    }
                                                                </td>

                                                                <td className="p-1 border-r">
                                                                    {locked ? (
                                                                        <div className="flex flex-col">
                                                                            <span className="font-medium text-xs">{item.item_name || item.custom_name || "Select Item"}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <Popover open={itemSearchOpen === actualIndex} onOpenChange={(open) => setItemSearchOpen(open ? actualIndex : null)}>
                                                                            <PopoverTrigger asChild>
                                                                                <Button
                                                                                    variant="outline"
                                                                                    size="sm"
                                                                                    className="w-full justify-between font-normal h-8 text-xs"
                                                                                >
                                                                                    {item.item_name || item.custom_name || "Select Item..."}
                                                                                    <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                                                                </Button>
                                                                            </PopoverTrigger>
                                                                            <PopoverContent className="w-[300px] p-0" align="start">
                                                                                <Command>
                                                                                    <CommandInput placeholder="Search items..." className="h-8" />
                                                                                    <CommandEmpty>No item found.</CommandEmpty>
                                                                                    <CommandGroup className="max-h-60 overflow-auto">
                                                                                        {allMasterItems.map((itm) => (
                                                                                            <CommandItem
                                                                                                key={itm.id}
                                                                                                onSelect={() => {
                                                                                                    updateItem(actualIndex, "item_id", itm.id);
                                                                                                    setItemSearchOpen(null);
                                                                                                }}
                                                                                                className="cursor-pointer text-xs"
                                                                                            >
                                                                                                {itm.item_name}
                                                                                            </CommandItem>
                                                                                        ))}
                                                                                    </CommandGroup>
                                                                                </Command>
                                                                            </PopoverContent>
                                                                        </Popover>
                                                                    )}
                                                                </td>
                                                                <td className="p-1 border-r">
                                                                    <Input
                                                                        value={item.size || ""}
                                                                        onChange={(e) => updateItem(actualIndex, "size", e.target.value)}
                                                                        className="border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs"
                                                                        disabled={locked}
                                                                    />
                                                                </td>

                                                                <td className="p-1 border-r hidden">
                                                                    <Input
                                                                        value={item.multiplier || "1"}
                                                                        onChange={(e) => updateItem(actualIndex, "multiplier", e.target.value)}
                                                                        className="border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs"
                                                                        disabled={locked}
                                                                        placeholder="1"
                                                                    />
                                                                </td>

                                                                <td className="p-2 border-r text-xs text-muted-foreground">
                                                                    {item.unit_name}
                                                                </td>

                                                                <td className="p-2 border-r text-xs text-muted-foreground hidden">
                                                                    {item.ay_no || "-"}
                                                                </td>
                                                                <td className="p-1 border-r hidden">
                                                                    <Input
                                                                        type="number"
                                                                        value={item.rate}
                                                                        onChange={(e) => updateItem(actualIndex, "rate", e.target.value)}
                                                                        className="border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs text-right min-w-[105px]"
                                                                        disabled={true}
                                                                    />
                                                                </td>
                                                                <td className="p-1 border-r hidden">
                                                                    <Input
                                                                        type="number"
                                                                        value={item.quantity}
                                                                        onChange={(e) => updateItem(actualIndex, "quantity", e.target.value)}
                                                                        className="border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs text-right"
                                                                        disabled={true}
                                                                    />
                                                                </td>
                                                                <td className="p-1 border-r ">

                                                                </td>
                                                                <td className="p-2   hidden border-r text-right font-mono text-xs tabular-nums ">
                                                                    {((parseFloat(String(item.rate)) || 0) * (parseFloat(String(item.quantity)) || 0)).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                                                </td>

                                                                {!locked && (
                                                                    <td className="p-1 text-center ">
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                                                            onClick={() => removeItem(actualIndex)}
                                                                        >
                                                                            <Trash2 className="h-3 w-3" />
                                                                        </Button>
                                                                    </td>
                                                                )}
                                                            </tr>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            );
                                        })
                                    }
                                </tbody>
                                <tfoot className="hidden">
                                    <tr className="bg-slate-800 text-white font-bold border-t-2">
                                        <td colSpan={locked ? 5 : 6} className="p-3 text-right text-xs">
                                            Grand Total:
                                        </td>
                                        <td className="p-3 text-right text-xs tabular-nums bg-slate-700 font-mono">
                                            ₹{grandTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                                        </td>
                                        {!locked && <td></td>}
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t">
                {isViewOnly ? (
                    <Button variant="outline" type="button" onClick={() => router.push('/bill-generated')}>
                        Back to List
                    </Button>
                ) : (
                    !locked && (
                        <Button onClick={handleSubmit} disabled={loading}>
                            {loading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
                        </Button>
                    )
                )}
            </div>
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