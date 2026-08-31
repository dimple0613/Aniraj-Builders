"use client";

import { useSearchParams } from "next/navigation";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { toast } from "sonner";
import axios from "axios";
import { useFormik, FormikProvider, FieldArray, Form } from "formik";
import * as Yup from "yup";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Plus, Trash2, Eye, Pencil, IndianRupee } from "lucide-react";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

import { Column, DataTable, DataTableFilter, FormModal, InlineSelect } from "../common";
import { DepartmentManager } from "../common/DepartmentManager";
import { SORManager } from "../common/SORManager";
import { UnitManager } from "../common/UnitManager";

interface Subcontractor {
    id: string;
    name: string;
}

interface SORItem {
    id: string;
    name: string;
}

interface Department {
    id: string;
    name: string;
}

interface Unit {
    id: string;
    unit_name: string;
}

interface CapitalSorItem {
    id: string;
    item_name: string;
    searching_preference?: string | null;
    uom: string;
    gst_master?: string | null;
    is_subcontractor: boolean;
    subcontractor_id?: string | null;
    subcontractor_name?: string | null;
    srNo?: string | null;
    itemNo?: string | null;
    rate?: number | null;
    current_price?: number | null;
    is_active: boolean;
    createdAt: string;
    other_item_ids?: string | null;
    other_item_id?: string | null;
}

interface GroupedItemMaster {
    id: string;
    sorId: string;
    sorName: string | null;
    departmentId: string;
    departmentName: string | null;
    items: CapitalSorItem[];
    itemsCount: number;
    createdAt: string;
}

interface Price {
    id: string;
    price: number;
    start_date: string;
    expiry_date: string | null;
}

interface ItemMasterFormValues {
    itemMasters: Array<{
        id?: string;
        sorId: string;
        departmentId: string;
        item_name: string;
        searchPreferences: string[];
        _searchInput?: string;
        uom: string;
        gst_master: string;
        is_subcontractor: boolean;
        subcontractor_id: string;
        other_item_id: string[];
        srNo?: string;
        itemNo: string;
        rate: string;
        currentPrice?: string;
        rateHistory?: Price[];
    }>;
}

const itemMasterRowSchema = Yup.object({
    sorId: Yup.string().trim().required("SOR is required"),
    departmentId: Yup.string().trim().required("Department is required"),
    item_name: Yup.string().required("Item name is required").max(255),
    searchPreferences: Yup.array().of(Yup.string().min(1).max(100)).max(20),
    uom: Yup.string().required("Unit is required").max(50),
    gst_master: Yup.string().max(50),
    is_subcontractor: Yup.boolean(),
    subcontractor_id: Yup.string().when("is_subcontractor", {
        is: true,
        then: (schema) => schema.required("Subcontractor is required"),
        otherwise: (schema) => schema.notRequired(),
    }),
    srNo: Yup.string().max(50),
    itemNo: Yup.string().required("Item No. is required").max(50),
    rate: Yup.string().required("Rate is required"),
});

const createSchema = Yup.object({
    itemMasters: Yup.array()
        .of(itemMasterRowSchema)
        .min(1, "At least one item is required"),
});

export default function ItemMasterClient({
    canCreate,
    canEdit,
    canDelete,
}: {
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
}) {
    const [data, setData] = useState<GroupedItemMaster[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [sortField, setSortField] = useState("sorName");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [limit, setLimit] = useState(10);
    const [formLoading, setFormLoading] = useState(false);
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [editingGroup, setEditingGroup] = useState<GroupedItemMaster | null>(null);
    const [isOtherItems, setIsOtherItems] = useState(false);
    const [viewMode, setViewMode] = useState<"items" | "other">("items");
    const [deleteGroup, setDeleteGroup] = useState<GroupedItemMaster | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteOtherItem, setDeleteOtherItem] = useState<CapitalSorItem | null>(null);
    const [deleteOtherItemLoading, setDeleteOtherItemLoading] = useState(false);
    const originalItemIdsRef = useRef<string[]>([]);
    const [viewGroup, setViewGroup] = useState<GroupedItemMaster | null>(null);
    const [priceItem, setPriceItem] = useState<CapitalSorItem | null>(null);
    const [prices, setPrices] = useState<Price[]>([]);
    const [priceLoading, setPriceLoading] = useState(false);
    const [priceForm, setPriceForm] = useState({
        price: "",
        start_date: "",
        expiry_date: "",
    });
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
    const tableScrollRef = useRef<HTMLDivElement>(null);

    const [subcontractors, setSubcontractors] = useState<Subcontractor[]>([]);
    const [sorItems, setSorItems] = useState<SORItem[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [searchPrefInput, setSearchPrefInput] = useState("");

    const [rateItem, setRateItem] = useState<CapitalSorItem | null>(null);
    const [rateHistory, setRateHistory] = useState<Price[]>([]);
    const [rateHistoryLoading, setRateHistoryLoading] = useState(false);
    const [rateUpdateForm, setRateUpdateForm] = useState({
        newRate: "",
        effectiveDate: new Date().toISOString().split("T")[0],
    });
    const [rateUpdateLoading, setRateUpdateLoading] = useState(false);
    const [confirmOtherItemDialogOpen, setConfirmOtherItemDialogOpen] = useState(false);
    const [pendingOtherItemChange, setPendingOtherItemChange] = useState<{
        index: number;
        oldValue: string[];
        newValue: string[];
    } | null>(null);

    useEffect(() => {
        if (editingGroup) {
            const firstItem = editingGroup.items[0];
            const searchPrefs = firstItem?.searching_preference
                ? firstItem.searching_preference
                    .split(",")
                    .map((s: string) => s.trim())
                    .filter(Boolean)
                : [];
            createFormik.setValues({
                itemMasters: editingGroup.items.map((item) => ({
                    id: item.id,
                    sorId: editingGroup.sorId || "",
                    departmentId: editingGroup.departmentId || "",
                    item_name: item.item_name || "",
                    searchPreferences: item.searching_preference
                        ? item.searching_preference.split(",").map((s: string) => s.trim()).filter(Boolean)
                        : [],
                    _searchInput: "",
                    uom: item.uom || "",
                    gst_master: item.gst_master || "",
                    is_subcontractor: item.is_subcontractor || false,
                    subcontractor_id: item.subcontractor_id || "",
                    other_item_id: item.other_item_ids
                        ? item.other_item_ids.split(',').filter(Boolean)
                        : [],
                    itemNo: item.itemNo || "",
                    rate: item.rate?.toString() || "",
                    currentPrice: item.current_price ? Number(item.current_price).toString() : "",
                    rateHistory: [],
                })),
            });
            editingGroup.items.forEach((item, idx) => {
                (async () => {
                    try {
                        const response = await axios.get(
                            `/api/item-master/rate-history?capitalSorId=${item.id}`,
                        );
                        createFormik.setFieldValue(
                            `itemMasters.${idx}.rateHistory`,
                            response.data.data || [],
                        );
                    } catch {
                        // Silently fail
                    }
                })();
            });
            // Store original item IDs to detect deletions on save
            originalItemIdsRef.current = editingGroup.items.map((item) => item.id);
        } else {
            createFormik.resetForm();
            originalItemIdsRef.current = [];
        }
    }, [editingGroup]);

    const fetchData = useCallback(
        async (
            page = 1,
            searchValue = search,
            sort = sortField,
            order = sortOrder,
            pageLimit = limit,
        ) => {
            try {
                setLoading(true);
                const params: any = {
                    page,
                    limit: pageLimit,
                    search: searchValue,
                    sortField: sort,
                    sortOrder: order,
                };
                const response = await axios.get("/api/item-master", { params });
                setData(response.data.data || []);
                setPagination({
                    page: response.data.pagination?.page || 1,
                    totalPages: response.data.pagination?.pages || 1,
                });
            } catch {
                toast.error("Failed to fetch Item Master");
            } finally {
                setLoading(false);
            }
        },
        [search, sortField, sortOrder, limit],
    );

    const fetchSubcontractors = useCallback(async () => {
        try {
            const response = await axios.get("/api/subcontractor-management");
            setSubcontractors(response.data.data || []);
        } catch {
            toast.error("Failed to fetch subcontractors");
        }
    }, []);

    const fetchSorItems = useCallback(async () => {
        try {
            const response = await axios.get("/api/sor-items", { params: { limit: 99999 } });
            setSorItems(response.data.data || []);
        } catch {
            toast.error("Failed to fetch SOR items");
        }
    }, []);

    const fetchDepartments = useCallback(async () => {
        try {
            const response = await axios.get("/api/departments");
            setDepartments(response.data.data || []);
        } catch {
            toast.error("Failed to fetch departments");
        }
    }, []);

    const fetchUnits = useCallback(async () => {
        try {
            const response = await axios.get("/api/units?limit=200");
            setUnits(response.data.data || []);
        } catch {
            toast.error("Failed to fetch units");
        }
    }, []);

    useEffect(() => {
        fetchData();
        fetchSubcontractors();
        fetchSorItems();
        fetchDepartments();
        fetchUnits();
    }, [fetchData, fetchSubcontractors, fetchSorItems, fetchDepartments, fetchUnits]);

    const handleEdit = (group: GroupedItemMaster) => {
        setEditingGroup(group);
        setSubmitAttempted(false);
        setShowForm(true);
    };

    const handleDelete = (group: GroupedItemMaster) => {
        setDeleteGroup(group);
    };

    const handleDeleteConfirm = async () => {
        if (!deleteGroup) return;
        setDeleteLoading(true);
        try {
            await axios.delete(`/api/item-master?itemMasterId=${deleteGroup.id}`);
            toast.success("Group deleted successfully");
            setDeleteGroup(null);
            fetchData(pagination.page);
            try { const bc = new BroadcastChannel('item-master-sync'); bc.postMessage({ type: 'saved', sorId: deleteGroup.sorId, departmentId: deleteGroup.departmentId }); bc.close(); } catch {}
            try { localStorage.setItem('im-refresh', Date.now().toString()); } catch {}
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to delete");
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleDeleteOtherItemConfirm = async () => {
        if (!deleteOtherItem) return;
        setDeleteOtherItemLoading(true);
        try {
            await axios.delete(`/api/item-master?id=${deleteOtherItem.id}`);
            toast.success("Item deleted successfully");
            setDeleteOtherItem(null);
            fetchData();
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to delete item");
        } finally {
            setDeleteOtherItemLoading(false);
        }
    };

    const handleViewPrices = async (item: CapitalSorItem) => {
        setPriceItem(item);
        setPriceLoading(true);
        try {
            const response = await axios.get(
                `/api/item-master/prices?capitalSorId=${item.id}`,
            );
            setPrices(response.data.data || []);
        } catch {
            toast.error("Failed to fetch prices");
        } finally {
            setPriceLoading(false);
        }
    };

    const handleAddPrice = async () => {
        if (!priceItem || !priceForm.price) return;
        try {
            await axios.post("/api/item-master/add-price", {
                capitalSorId: priceItem.id,
                price: parseFloat(priceForm.price),
                start_date: priceForm.start_date || new Date(),
                expiry_date: priceForm.expiry_date || null,
            });
            toast.success("Price added successfully");
            setPriceForm({ price: "", start_date: "", expiry_date: "" });
            handleViewPrices(priceItem);
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to add price");
        }
    };

    const handleOpenRateUpdate = async (item: CapitalSorItem) => {
        setRateItem(item);
        setRateHistoryLoading(true);
        setRateUpdateForm({
            newRate: "",
            effectiveDate: new Date().toISOString().split("T")[0],
        });
        try {
            const response = await axios.get(
                `/api/item-master/rate-history?capitalSorId=${item.id}`,
            );
            setRateHistory(response.data.data || []);
        } catch {
            toast.error("Failed to fetch rate history");
        } finally {
            setRateHistoryLoading(false);
        }
    };

    const handleUpdateRate = async () => {
        if (!rateItem || !rateUpdateForm.newRate || !rateUpdateForm.effectiveDate) return;
        setRateUpdateLoading(true);
        try {
            await axios.post("/api/item-master/update-rate", {
                capitalSorId: rateItem.id,
                newRate: parseFloat(rateUpdateForm.newRate),
                effectiveDate: rateUpdateForm.effectiveDate,
            });
            toast.success("Rate updated successfully");

            const itemIndex = createFormik.values.itemMasters.findIndex(
                (item) => item.id === rateItem.id,
            );
            if (itemIndex !== -1) {
                const response = await axios.get(
                    `/api/item-master/rate-history?capitalSorId=${rateItem.id}`,
                );
                createFormik.setFieldValue(
                    `itemMasters.${itemIndex}.rateHistory`,
                    response.data.data || [],
                );
                createFormik.setFieldValue(
                    `itemMasters.${itemIndex}.rate`,
                    rateUpdateForm.newRate,
                );
            }

            setRateItem(null);
            fetchData(pagination.page);
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to update rate");
        } finally {
            setRateUpdateLoading(false);
        }
    };

    const createFormik = useFormik<ItemMasterFormValues>({
        initialValues: {
            itemMasters: [
                {
                    id: undefined,
                    sorId: "",
                    departmentId: "",
                    item_name: "",
                    searchPreferences: [],
                    _searchInput: "",
                    uom: "",
                    gst_master: "",
                    is_subcontractor: false,
                    subcontractor_id: "",
                    other_item_id: [],
                    srNo: "",
                    itemNo: "",
                    rate: "",
                    currentPrice: "",
                    rateHistory: [],
                },
            ],
        },
        validationSchema: createSchema,
        onSubmit: async (values) => {
            setFormLoading(true);
            try {
                const itemsToProcess = values.itemMasters
                    .filter((item) => item.item_name?.trim())
                    .map((item, i) => ({ ...item, srNo: (i + 1).toString() }));

                if (editingGroup) {
                    // In edit mode: update existing items (with id) and create new items (without id)
                    const existingItems = itemsToProcess.filter((item) => item.id);
                    const newItems = itemsToProcess.filter((item) => !item.id);
                    const submittedIds = new Set(existingItems.map((item) => item.id));

                    // Delete items removed from the form
                    const removedIds = originalItemIdsRef.current.filter(
                        (id) => !submittedIds.has(id),
                    );
                    for (const removedId of removedIds) {
                        await axios.delete(`/api/item-master?id=${removedId}`);
                    }

                    // Update existing items
                    for (const item of existingItems) {
                        await axios.put("/api/item-master", {
                            id: item.id,
                            item_name: item.item_name,
                            searching_preference: item.searchPreferences.join(", "),
                            uom: item.uom,
                            gst_master: item.gst_master,
                            is_subcontractor: item.is_subcontractor,
                            subcontractor_id: item.is_subcontractor ? item.subcontractor_id : null,
                            other_item_ids: item.other_item_id.length > 0 ? item.other_item_id.join(",") : null,
                            srNo: item.srNo,
                            itemNo: item.itemNo,
                            rate: item.rate ? parseFloat(item.rate) : undefined,
                        });
                    }

                    // Create new items
                    if (newItems.length > 0) {
                        await axios.post("/api/item-master", newItems.map(item => ({
                            sorId: item.sorId,
                            departmentId: item.departmentId,
                            itemMasterId: editingGroup.id,
                            item_name: item.item_name,
                            searching_preference: item.searchPreferences.join(", "),
                            uom: item.uom,
                            gst_master: item.gst_master,
                            is_subcontractor: item.is_subcontractor,
                            subcontractor_id: item.is_subcontractor ? item.subcontractor_id : null,
                            other_item_ids: item.other_item_id.length > 0 ? item.other_item_id.join(",") : null,
                            srNo: item.srNo,
                            itemNo: item.itemNo,
                            rate: item.rate ? parseFloat(item.rate) : undefined,
                        })));
                    }

                    const deletedCount = removedIds.length;
                    toast.success(
                        `${existingItems.length} item(s) updated, ${newItems.length} item(s) added${deletedCount > 0 ? `, ${deletedCount} item(s) deleted` : ""}`,
                    );
                    setFormLoading(false);
                    setSubmitAttempted(false);
                    createFormik.resetForm();
                    setEditingGroup(null);
                    setShowForm(false);
                    fetchData(pagination.page);
                    try { const bc = new BroadcastChannel('item-master-sync'); bc.postMessage({ type: 'saved', sorId: editingGroup.sorId, departmentId: editingGroup.departmentId }); bc.close(); } catch {}
                    try { localStorage.setItem('im-refresh', Date.now().toString()); } catch {}
                } else {
                    // Create mode - send all items in single API call
                    // API handles creating single itemMaster and all capitalSOR items
                    await axios.post("/api/item-master", itemsToProcess.map(item => ({
                        sorId: item.sorId,
                        departmentId: item.departmentId,
                        item_name: item.item_name,
                        searching_preference: item.searchPreferences.length > 0 ? item.searchPreferences.join(", ") : null,
                        uom: item.uom,
                        gst_master: item.gst_master,
                        is_subcontractor: item.is_subcontractor,
                        subcontractor_id: item.is_subcontractor ? item.subcontractor_id : null,
                        other_item_ids: item.other_item_id.length > 0 ? item.other_item_id.join(",") : null,
                        srNo: item.srNo,
                        itemNo: item.itemNo,
                        rate: item.rate ? parseFloat(item.rate) : undefined,
                    })));

                    toast.success(
                        `${itemsToProcess.length} item(s) created successfully`,
                    );
                    setFormLoading(false);
                    setSubmitAttempted(false);
                    createFormik.resetForm();
                    setShowForm(false);
                    fetchData(pagination.page);
                    try { const first = values.itemMasters[0]; const bc = new BroadcastChannel('item-master-sync'); bc.postMessage({ type: 'saved', sorId: first.sorId, departmentId: first.departmentId }); bc.close(); } catch {}
                    try { localStorage.setItem('im-refresh', Date.now().toString()); } catch {}
                }
            } catch (error: any) {
                toast.error(
                    error.response?.data?.message ||
                    `Failed to ${editingGroup ? "update" : "create"} Item Master`,
                );
                setFormLoading(false);
            }
        },
    });
    const columns: Column<GroupedItemMaster>[] = useMemo(
        () => [
            {
                header: "SOR",
                accessorKey: "sorName",
                cell: (group) => group.sorName || "-",
            },
            {
                header: "Department",
                accessorKey: "departmentName",
                cell: (group) => group.departmentName || "-",
            },
            {
                header: "Items",
                cell: (group) => (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewGroup(group)}
                        className="flex items-center gap-1"
                    >
                        <Eye className="h-4 w-4" />
                        {group.itemsCount} item{group.itemsCount !== 1 ? 's' : ''}
                    </Button>
                ),
            },
            {
                header: "Actions",
                cell: (group) => (
                    <div className="flex items-center gap-2 justify-end">
                        {canEdit && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(group)}
                            >
                                <Pencil className="h-4 w-4" />
                            </Button>
                        )}
                        {canDelete && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-destructive"
                                onClick={() => handleDelete(group)}
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                ),
            },
        ],
        [pagination.page],
    );

    const searchParams = useSearchParams();
    const [urlProcessed, setUrlProcessed] = useState(false);

    useEffect(() => {
        if (urlProcessed) return;
        const sorId = searchParams.get('sorId');
        const departmentId = searchParams.get('departmentId');
        const openForm = searchParams.get('openForm');
        if (!sorId && !departmentId && !openForm) return;
        if (data.length === 0) return;
        setUrlProcessed(true);

        if (sorId && departmentId) {
            const group = data.find(
                (g) => g.sorId === sorId && g.departmentId === departmentId
            );
            if (group) {
                handleEdit(group);
                return;
            }
        }

        // Open add form (with optional pre-fill)
        setEditingGroup(null);
        setShowForm(true);
        if (sorId || departmentId) {
            setTimeout(() => {
                createFormik.setValues({
                    itemMasters: [{
                        id: undefined,
                        sorId: sorId || "",
                        departmentId: departmentId || "",
                        item_name: "",
                        searchPreferences: [],
                        _searchInput: "",
                        uom: "",
                        gst_master: "",
                    is_subcontractor: false,
                    subcontractor_id: "",
                    other_item_id: [],
                    srNo: "",
                        itemNo: "",
                        rate: "",
                        currentPrice: "",
                        rateHistory: [],
                    }]
                });
            }, 0);
        }
    }, [searchParams, data, urlProcessed]);

    const handleOtherItems = useCallback(async () => {
        try {
            let sorId = sorItems.find(s => s.name === "OTHER ITEM")?.id;
            if (!sorId) {
                try {
                    const res = await axios.post('/api/sor-items', { name: "OTHER ITEM" });
                    const created = res.data.data || res.data;
                    setSorItems((prev) => [...prev, created]);
                    sorId = created.id;
                } catch (err: any) {
                    if (err.response?.status === 409) {
                        const searchRes = await axios.get('/api/sor-items', { params: { search: "OTHER ITEM", limit: 1 } });
                        const existing = searchRes.data.data?.[0];
                        if (existing) {
                            setSorItems((prev) => [...prev, existing]);
                            sorId = existing.id;
                        } else {
                            throw err;
                        }
                    } else {
                        throw err;
                    }
                }
            }

            let deptId = departments.find(d => d.name === "PURCHASE")?.id;
            if (!deptId) {
                const searchRes = await axios.get('/api/departments', { params: { search: "PURCHASE", includeHidden: true, limit: 1 } });
                const existing = searchRes.data.data?.[0];
                if (existing) {
                    setDepartments((prev) => [...prev, existing]);
                    deptId = existing.id;
                } else {
                    const res = await axios.post('/api/departments', { name: "PURCHASE" });
                    const created = res.data.data || res.data;
                    setDepartments((prev) => [...prev, created]);
                    deptId = created.id;
                }
            }

            const existingGroup = data.find(d => d.sorName === "OTHER ITEM" && d.departmentName === "PURCHASE");
            if (existingGroup) {
                setIsOtherItems(true);
                handleEdit(existingGroup);
                return;
            }

            setEditingGroup(null);
            setSubmitAttempted(false);
            setIsOtherItems(true);
            createFormik.setValues({
                itemMasters: [{
                    id: undefined,
                    sorId: sorId || "",
                    departmentId: deptId || "",
                    item_name: "",
                    searchPreferences: [],
                    _searchInput: "",
                    uom: "",
                    gst_master: "",
                    is_subcontractor: false,
                    subcontractor_id: "",
                    other_item_id: [],
                    srNo: "",
                    itemNo: "",
                    rate: "",
                    currentPrice: "",
                    rateHistory: [],
                }],
            });
            setShowForm(true);
        } catch (error: any) {
            toast.error("Failed to set up Other Items form");
        }
    }, [sorItems, departments, createFormik]);

    const ensureOtherItemsSorDept = useCallback(async () => {
        let sorId = sorItems.find(s => s.name === "OTHER ITEM")?.id;
        if (!sorId) {
            try {
                const res = await axios.post('/api/sor-items', { name: "OTHER ITEM" });
                const created = res.data.data || res.data;
                setSorItems((prev) => [...prev, created]);
                sorId = created.id;
            } catch (err: any) {
                if (err.response?.status === 409) {
                    const searchRes = await axios.get('/api/sor-items', { params: { search: "OTHER ITEM", limit: 1 } });
                    const existing = searchRes.data.data?.[0];
                    if (existing) {
                        setSorItems((prev) => [...prev, existing]);
                        sorId = existing.id;
                    } else {
                        throw err;
                    }
                } else {
                    throw err;
                }
            }
        }
        let deptId = departments.find(d => d.name === "PURCHASE")?.id;
        if (!deptId) {
            const searchRes = await axios.get('/api/departments', { params: { search: "PURCHASE", includeHidden: true, limit: 1 } });
            const existing = searchRes.data.data?.[0];
            if (existing) {
                setDepartments((prev) => [...prev, existing]);
                deptId = existing.id;
            } else {
                const res = await axios.post('/api/departments', { name: "PURCHASE" });
                const created = res.data.data || res.data;
                setDepartments((prev) => [...prev, created]);
                deptId = created.id;
            }
        }
        return { sorId: sorId || "", deptId: deptId || "" };
    }, [sorItems, departments]);

    const handleAddOtherItem = useCallback(async (name: string) => {
        try {
            const { sorId, deptId } = await ensureOtherItemsSorDept();
            let itemMasterId = data.find(d => d.sorName === "OTHER ITEM" && d.departmentName === "PURCHASE")?.id;
            if (!itemMasterId) {
                const existingRes = await axios.get("/api/item-master", { params: { sorId, departmentId: deptId, limit: 1 } });
                const existingGroup = existingRes.data.data?.[0];
                itemMasterId = existingGroup?.id || undefined;
            }
            const res = await axios.post("/api/item-master", {
                sorId,
                departmentId: deptId,
                itemMasterId,
                item_name: name.toUpperCase(),
                searching_preference: null,
                uom: "",
                gst_master: "",
                is_subcontractor: false,
                subcontractor_id: null,
                srNo: "1",
                itemNo: "1",
                rate: 0,
            });
            const created = res.data.data || res.data;
            const item = Array.isArray(created) ? created[0] : created;
            fetchData();
            return { id: item.id, label: item.item_name };
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to create Other Item");
            return null;
        }
    }, [ensureOtherItemsSorDept, fetchData, data]);

    const filteredData = useMemo(() => {
        if (viewMode === "other") {
            return data.filter(d => d.sorName === "OTHER ITEM" && d.departmentName === "PURCHASE");
        }
        return data.filter(d => d.sorName !== "OTHER ITEM");
    }, [data, viewMode]);

    const otherItems = useMemo(() => {
        const group = data.find(d => d.sorName === "OTHER ITEM" && d.departmentName === "PURCHASE");
        return group?.items || [];
    }, [data]);

    return (
        <div className="flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Item Master
                    </h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={handleOtherItems}>
                        Other Items
                    </Button>
                    <UnitManager />
                    <SORManager />
                    <DepartmentManager />
                </div>
            </div>

            <div className="flex bg-slate-100 rounded-lg p-1 w-fit">
                <Button
                    type="button"
                    variant={viewMode === "items" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("items")}
                    className="gap-1"
                >
                    Items
                </Button>
                <Button
                    type="button"
                    variant={viewMode === "other" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("other")}
                    className="gap-1"
                >
                    Other Items
                </Button>
            </div>

            {viewMode === "other" ? (
                otherItems.length > 0 ? (
                    <div className="rounded-md border overflow-hidden">
                        <div className="overflow-auto max-h-[60vh]">
                            <table className="w-full text-sm border-collapse">
                                <thead className="sticky top-0 z-10 bg-slate-50">
                                    <tr className="text-xs uppercase tracking-wider text-slate-700 border-b">
                                        <th className="p-3 text-left">Sr No.</th>
                                        <th className="p-3 text-left">Item No.</th>
                                        <th className="p-3 text-left">Item Name</th>
                                        <th className="p-3 text-left">Unit</th>
                                        <th className="p-3 text-right">Rate</th>
                                        <th className="p-3 text-center">GST %</th>
                                        <th className="p-3 text-center">Subcontractor</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {otherItems.map((item) => (
                                        <tr key={item.id} className="hover:bg-slate-50">
                                            <td className="p-3">{item.srNo || "-"}</td>
                                            <td className="p-3">{item.itemNo || "-"}</td>
                                            <td className="p-3 font-medium">{item.item_name}</td>
                                            <td className="p-3">{item.uom || "-"}</td>
                                            <td className="p-3 text-right">{item.rate ?? "-"}</td>
                                            <td className="p-3 text-center">{item.gst_master || "-"}</td>
                                            <td className="p-3 text-center">
                                                {item.is_subcontractor && item.subcontractor_name ? item.subcontractor_name : "-"}
                                            </td>
                                            <td className="p-3 text-center">
                                                <div className="flex items-center justify-center gap-1">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7"
                                                                    onClick={() => handleOpenRateUpdate(item)}
                                                                >
                                                                    <IndianRupee className="h-3.5 w-3.5" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                Change Rate
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                    {canDelete && (
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeleteOtherItem(item)}
                                                            className="text-destructive hover:text-destructive/80 transition-colors"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <p className="text-center text-muted-foreground py-4">No other items found</p>
                )
            ) : (
                <DataTable
                    data={filteredData}
                    columns={columns}
                    loading={loading}
                    pagination={pagination}
                    onPageChange={(page) => fetchData(page)}
                    onSearch={(value) => {
                        setSearch(value);
                        fetchData(1, value);
                    }}
                    onSortChange={(field: string, order: "asc" | "desc") => {
                        setSortField(field);
                        setSortOrder(order);
                        fetchData(1, search, sortField, order);
                    }}
                    onLimitChange={(limit) => {
                        setLimit(limit);
                        fetchData(1, search, sortField, sortOrder, limit);
                    }}
                    onAdd={
                        canCreate
                            ? () => {
                                setEditingGroup(null);
                                setSubmitAttempted(false);
                                setIsOtherItems(false);
                                setShowForm(true);
                            }
                            : undefined
                    }
                    addLabel="Add Item"
                />
            )}

            {/* Create/Edit Form Modal */}
            <FormModal
                isOpen={showForm}
                onClose={() => {
                    setShowForm(false);
                    setEditingGroup(null);
                    setSubmitAttempted(false);
                    setIsOtherItems(false);
                }}
                title={editingGroup ? "Edit Items" : "Create Item"}
                description={isOtherItems ? undefined : (editingGroup ? "Add items to existing SOR + Department items" : "Create new item with SOR and Department")}
                loading={formLoading}
                onSubmit={(e: any) => {
                    e.preventDefault();
                    setSubmitAttempted(true);
                    createFormik.handleSubmit();
                }}
                size="full"
                compact={isOtherItems}
                topContent={
                    <div className="-ml-[25px] -mr-[25px]">
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden bg-red-500 -mt-[1.5rem] ">
                        <div
                            className="h-full bg-blue-600 transition-all duration-300"
                            style={{
                                width: `${(() => {
                                    const items = createFormik.values.itemMasters;
                                    const perItemFields = ['item_name', 'srNo', 'itemNo', 'uom', 'rate', 'gst_master', 'searchPreferences'] as const;
                                    const globalFields = [
                                        { filled: (createFormik.values.itemMasters[0]?.sorId || '').trim() !== '' },
                                        { filled: (createFormik.values.itemMasters[0]?.departmentId || '').trim() !== '' },
                                    ];
                                    const totalGlobal = globalFields.length;
                                    const filledGlobal = globalFields.filter(g => g.filled).length;
                                    const totalItemFields = items.length * perItemFields.length;
                                    const totalFields = totalItemFields + totalGlobal;
                                    if (totalFields === 0) return 0;
                                    const filledItemFields = items.reduce((count, item) => {
                                        return count + perItemFields.filter((field) => {
                                            const val = (item as any)[field];
                                            if (Array.isArray(val)) return val.length > 0;
                                            return typeof val === 'string' ? val.trim() !== '' : val !== null && val !== undefined;
                                        }).length;
                                    }, 0);
                                    return Math.round(((filledItemFields + filledGlobal) / totalFields) * 100);
                                })()}%`,
                            }}
                        />
                    </div>
                    </div>
                }
            >
                {/* SOR and Department dropdowns after title */}
                <div className="flex gap-4 mb-4 px-1">
                    {!isOtherItems && (
                    <div className="flex-1 space-y-2 relative">
                        <Label>SOR *</Label>
                        <InlineSelect
                            value={createFormik.values.itemMasters[0]?.sorId || ""}
                            onChange={(value) => {
                                createFormik.values.itemMasters.forEach((_, idx) => {
                                    createFormik.setFieldValue(
                                        `itemMasters.${idx}.sorId`,
                                        value,
                                    );
                                });
                            }}
                            placeholder="Select SOR"
                            options={sorItems
                                .filter((sor) => isOtherItems || sor.name !== "OTHER ITEM")
                                .map((sor) => ({
                                label: sor.name,
                                value: sor.id,
                            }))}
                            disabled={!!editingGroup || isOtherItems}
                            onAddNew={!editingGroup && !isOtherItems ? async (newValue) => {
                                try {
                                    const response = await axios.post('/api/sor-items', { name: newValue });
                                    const created = response.data.data || response.data;
                                    setSorItems((prev) => [...prev, created]);
                                    return { id: created.id, label: created.name };
                                } catch (error: any) {
                                    throw new Error(error?.response?.data?.message || 'Failed to create SOR item');
                                }
                            } : undefined}
                        />
                        {submitAttempted &&
                            (createFormik.errors.itemMasters?.[0] as any)?.sorId && (
                                <p className="text-[10px] text-red-500 mt-1">
                                    {(createFormik.errors.itemMasters?.[0] as any)?.sorId}
                                </p>
                            )}
                    </div>
                    )}
                    {!isOtherItems && (
                    <div className="flex-1 space-y-2 relative">
                        <Label>Department *</Label>
                        <InlineSelect
                            value={createFormik.values.itemMasters[0]?.departmentId || ""}
                            onChange={(value) => {
                                createFormik.values.itemMasters.forEach((_, idx) => {
                                    createFormik.setFieldValue(
                                        `itemMasters.${idx}.departmentId`,
                                        value,
                                    );
                                });
                            }}
                            placeholder="Select Department"
                            options={departments
                                .filter((dept) => isOtherItems || dept.name !== "PURCHASE")
                                .map((dept) => ({
                                label: dept.name,
                                value: dept.id,
                            }))}
                            disabled={!!editingGroup || isOtherItems}
                            onAddNew={!editingGroup && !isOtherItems ? async (newValue) => {
                                try {
                                    const response = await axios.post('/api/departments', { name: newValue });
                                    const created = response.data.data || response.data;
                                    setDepartments((prev) => [...prev, created]);
                                    return { id: created.id, label: created.name };
                                } catch (error: any) {
                                    throw new Error(error?.response?.data?.message || 'Failed to create department');
                                }
                            } : undefined}
                        />
                        {submitAttempted &&
                            (createFormik.errors.itemMasters?.[0] as any)?.departmentId && (
                                <p className="text-[10px] text-red-500 mt-1">
                                    {(createFormik.errors.itemMasters?.[0] as any)?.departmentId}
                                </p>
                            )}
                    </div>
                    )}
                </div>

                <FormikProvider value={createFormik}>
                    <Form>
                        <FieldArray name="itemMasters">
                                            {({ push, remove }) => {
                                                return (
                                                <div className="space-y-4">
                                                    <div className="rounded-md border">
                                                        <div ref={tableScrollRef} className="overflow-auto max-h-[40vh]">
                                            <table className="w-full text-sm border-collapse min-w-[1200px]">
                                                <thead className="sticky top-0 z-10 bg-gradient-to-r from-slate-50 to-slate-100">
                                                    <tr className="text-[11px] uppercase tracking-wider text-slate-700 border-b-2 border-slate-300">
                                                        <th className="p-3 border-r border-slate-200 font-semibold text-left w-[80px] bg-slate-50">
                                                            Sr No. *
                                                        </th>
                                                        <th className="p-3 border-r border-slate-200 font-semibold text-left w-[100px] bg-slate-50">
                                                            Item No. *
                                                        </th>
                                                        <th className="p-3 border-r border-slate-200 font-semibold text-left min-w-[150px] bg-slate-50">
                                                            Search Pref.
                                                        </th>
                                                        <th className="p-3 border-r border-slate-200 font-semibold text-left min-w-[250px] bg-slate-50">
                                                            Item Name *
                                                        </th>
                                                        {!isOtherItems && (
                                                            <th className="p-3 border-r border-slate-200 font-semibold text-left w-[200px] bg-slate-50">
                                                                Other Item
                                                            </th>
                                                        )}
                                                        <th className="p-3 border-r border-slate-200 font-semibold text-left w-[180px] bg-slate-50">
                                                            Subcontractor
                                                        </th>
                                                        <th className="p-3 border-r border-slate-200 font-semibold text-left w-[120px] bg-slate-50">
                                                            Unit *
                                                        </th>

                                                        <th className="p-3 border-r border-slate-200 font-semibold text-left w-[110px] bg-slate-50">
                                                            Rate *
                                                        </th>
                                                        <th className="p-3 border-r border-slate-200 font-semibold text-left w-[80px] bg-slate-50">
                                                            GST %
                                                        </th>
                                                        <th className="p-3 font-semibold text-left w-[50px] bg-slate-50">
                                                            Action
                                                        </th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-200">
                                                    {createFormik.values.itemMasters.map((_, index) => {
                                                        const rowErrors = createFormik.errors.itemMasters?.[
                                                            index
                                                        ] as any;
                                                        const rowTouched = createFormik.touched
                                                            .itemMasters?.[index] as any;
                                                        return (
                                                            <tr
                                                                key={index}
                                                                className="hover:bg-blue-50/50 transition-colors group"
                                                            >
                                                                 <td className="p-2 border-r border-slate-100 text-center">
                                                                     <span className="text-sm font-medium text-slate-600">{index + 1}</span>
                                                                 </td>
                                                                <td className="p-2 border-r border-slate-100 text-center">
                                                                    <Input
                                                                        name={`itemMasters.${index}.itemNo`}
                                                                        value={
                                                                            createFormik.values.itemMasters[index]
                                                                                .itemNo
                                                                        }
                                                                        onChange={(e) => {
                                                                            createFormik.setFieldValue(
                                                                                `itemMasters.${index}.itemNo`,
                                                                                e.target.value.toUpperCase(),
                                                                            );
                                                                        }}
                                                                        placeholder="Item No."
                                                                        className={`h-9 text-sm text-center placeholder:text-muted-foreground ${rowTouched?.itemNo && rowErrors?.itemNo ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                                                                    />
                                                                    {rowTouched?.itemNo &&
                                                                        rowErrors?.itemNo && (
                                                                            <p className="text-[10px] text-red-500 mt-0.5">
                                                                                {rowErrors.itemNo}
                                                                            </p>
                                                                        )}
                                                                </td>
                                                                <td className="p-2 border-r border-slate-100">
                                                                    <div className="flex gap-1">
                                                                        <Input
                                                                            value={
                                                                                createFormik.values.itemMasters[index]
                                                                                    ._searchInput || ""
                                                                            }
                                                                            onChange={(e) =>
                                                                                createFormik.setFieldValue(
                                                                                    `itemMasters.${index}._searchInput`,
                                                                                    e.target.value.toUpperCase(),
                                                                                )
                                                                            }
                                                                            onKeyDown={(e) => {
                                                                                if (
                                                                                    e.key === "Enter" &&
                                                                                    createFormik.values.itemMasters[
                                                                                        index
                                                                                    ]._searchInput?.trim()
                                                                                ) {
                                                                                    e.preventDefault();
                                                                                    const val =
                                                                                        createFormik.values.itemMasters[
                                                                                            index
                                                                                        ]._searchInput!.trim().toUpperCase();
                                                                                    const existingPrefs =
                                                                                        createFormik.values.itemMasters[
                                                                                            index
                                                                                        ].searchPreferences;
                                                                                    if (
                                                                                        existingPrefs.some(
                                                                                            (p: string) =>
                                                                                                p.toLowerCase() ===
                                                                                                val.toLowerCase(),
                                                                                        )
                                                                                    ) {
                                                                                        return;
                                                                                    }
                                                                                    const newPrefs = [
                                                                                        ...existingPrefs,
                                                                                        val,
                                                                                    ];
                                                                                    createFormik.setFieldValue(
                                                                                        `itemMasters.${index}.searchPreferences`,
                                                                                        newPrefs,
                                                                                    );
                                                                                    createFormik.setFieldValue(
                                                                                        `itemMasters.${index}._searchInput`,
                                                                                        "",
                                                                                    );
                                                                                }
                                                                            }}
                                                                            placeholder="Enter keyword and click Add"
                                                                            className="flex-1 h-9 text-sm px-2 placeholder:text-muted-foreground"
                                                                        />
                                                                        <Button
                                                                            type="button"
                                                                            variant="secondary"
                                                                            size="sm"
                                                                            onClick={() => {
                                                                                const val =
                                                                                    createFormik.values.itemMasters[
                                                                                        index
                                                                                    ]._searchInput?.trim().toUpperCase();
                                                                                if (!val) return;
                                                                                const existingPrefs =
                                                                                    createFormik.values.itemMasters[
                                                                                        index
                                                                                    ].searchPreferences;
                                                                                if (
                                                                                    existingPrefs.some(
                                                                                        (p: string) =>
                                                                                            p.toLowerCase() ===
                                                                                            val.toLowerCase(),
                                                                                    )
                                                                                ) {
                                                                                    return;
                                                                                }
                                                                                const newPrefs = [
                                                                                    ...existingPrefs,
                                                                                    val,
                                                                                ];
                                                                                createFormik.setFieldValue(
                                                                                    `itemMasters.${index}.searchPreferences`,
                                                                                    newPrefs,
                                                                                );
                                                                                createFormik.setFieldValue(
                                                                                    `itemMasters.${index}._searchInput`,
                                                                                    "",
                                                                                );
                                                                            }}
                                                                            className="h-9 px-3 text-sm"
                                                                        >
                                                                            Add
                                                                        </Button>
                                                                    </div>
                                                                    {createFormik.values.itemMasters[
                                                                        index
                                                                    ].searchPreferences.length > 0 && (
                                                                            <div className="flex flex-wrap gap-1 mt-2">
                                                                                {createFormik.values.itemMasters[
                                                                                    index
                                                                                ].searchPreferences.map(
                                                                                    (pref: string, pIdx: number) => (
                                                                                        <span
                                                                                            key={pIdx}
                                                                                            className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium bg-muted"
                                                                                        >
                                                                                            {pref}
                                                                                            <button
                                                                                                type="button"
                                                                                                onClick={() => {
                                                                                                    const newPrefs = [
                                                                                                        ...createFormik.values
                                                                                                            .itemMasters[index]
                                                                                                            .searchPreferences,
                                                                                                    ];
                                                                                                    newPrefs.splice(pIdx, 1);
                                                                                                    createFormik.setFieldValue(
                                                                                                        `itemMasters.${index}.searchPreferences`,
                                                                                                        newPrefs,
                                                                                                    );
                                                                                                }}
                                                                                                className="ml-1 text-destructive hover:text-red-600"
                                                                                            >
                                                                                                ×
                                                                                            </button>
                                                                                        </span>
                                                                                    ),
                                                                                )}
                                                                            </div>
                                                                        )}
                                                                </td>
                                                                <td className="p-2 border-r border-slate-100">
                                                                    <Input
                                                                        name={`itemMasters.${index}.item_name`}
                                                                        value={
                                                                            createFormik.values.itemMasters[index]
                                                                                .item_name
                                                                        }
                                                                        onChange={(e) => {
                                                                            createFormik.setFieldValue(
                                                                                `itemMasters.${index}.item_name`,
                                                                                e.target.value.toUpperCase(),
                                                                            );
                                                                        }}
                                                                        placeholder="Enter item name"
                                                                        className={`h-9 text-sm placeholder:text-muted-foreground ${rowTouched?.item_name && rowErrors?.item_name ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                                                                    />
                                                                    {rowTouched?.item_name &&
                                                                        rowErrors?.item_name && (
                                                                            <p className="text-[10px] text-red-500 mt-0.5">
                                                                                {rowErrors.item_name}
                                                                            </p>
                                                                        )}
                                                                 </td>
                                                                   {!isOtherItems && (
                                                                      <td className="p-2 border-r border-slate-100 text-center">
                                                                          <InlineSelect
                                                                              multiple={true}
                                                                              value={createFormik.values.itemMasters[index].other_item_id}
                                                                              onChange={async (value) => {
                                                                                  const oldValue = createFormik.values.itemMasters[index].other_item_id;
                                                                                  const removedIds = oldValue.filter((id: string) => !(value as string[]).includes(id));
                                                                                  if (removedIds.length > 0) {
                                                                                      for (const removedId of removedIds) {
                                                                                          try {
                                                                                              const res = await axios.get(`/api/item-master/check-purchase`, {
                                                                                                  params: { capitalSorId: removedId },
                                                                                              });
                                                                                              if (res.data.data?.hasEntries) {
                                                                                                  setPendingOtherItemChange({ index, oldValue, newValue: value as string[] });
                                                                                                  createFormik.setFieldValue(`itemMasters.${index}.other_item_id`, value);
                                                                                                  setConfirmOtherItemDialogOpen(true);
                                                                                                  return;
                                                                                              }
                                                                                          } catch {
                                                                                          }
                                                                                      }
                                                                                  }
                                                                                  createFormik.setFieldValue(`itemMasters.${index}.other_item_id`, value);
                                                                              }}
                                                                              placeholder="Select"
                                                                              options={otherItems.map((item) => ({
                                                                                  label: item.item_name,
                                                                                  value: item.id,
                                                                              }))}
                                                                              className="h-9 text-sm text-center w-[200px]"
                                                                         />
                                                                     </td>
                                                                  )}
                                                                 <td className="p-2 border-r border-slate-100 text-center">
                                                                     <div className="flex flex-col items-center gap-1">
                                                                         <label className="flex items-center gap-1.5 cursor-pointer">
                                                                             <input
                                                                                 type="checkbox"
                                                                                 checked={createFormik.values.itemMasters[index].is_subcontractor}
                                                                                 onChange={(e) => {
                                                                                     createFormik.setFieldValue(
                                                                                         `itemMasters.${index}.is_subcontractor`,
                                                                                         e.target.checked,
                                                                                     );
                                                                                     if (!e.target.checked) {
                                                                                         createFormik.setFieldValue(
                                                                                             `itemMasters.${index}.subcontractor_id`,
                                                                                             "",
                                                                                         );
                                                                                     }
                                                                                 }}
                                                                                 className="w-3.5 h-3.5"
                                                                             />
                                                                             <span className="text-xs">Subcontractor</span>
                                                                         </label>
                                                                          {createFormik.values.itemMasters[index].is_subcontractor && (
                                                                              <div className="flex flex-col items-center gap-1">
                                                                                  <InlineSelect
                                                                                      value={createFormik.values.itemMasters[index].subcontractor_id || ""}
                                                                                      onChange={(value) => {
                                                                                          createFormik.setFieldValue(
                                                                                              `itemMasters.${index}.subcontractor_id`,
                                                                                              value,
                                                                                          );
                                                                                      }}
                                                                                      placeholder="Select"
                                                                                       options={subcontractors.map((s) => ({
                                                                                           label: s.name,
                                                                                           value: s.id,
                                                                                      }))}
                                                                                       className="h-9 text-sm text-center w-[160px]"
                                                                                       error={!!(rowTouched?.subcontractor_id && rowErrors?.subcontractor_id)}
                                                                                  />
                                                                                  {rowTouched?.subcontractor_id &&
                                                                                      rowErrors?.subcontractor_id && (
                                                                                          <p className="text-[10px] text-red-500 mt-0.5">
                                                                                              {rowErrors.subcontractor_id}
                                                                                          </p>
                                                                                      )}
                                                                              </div>
                                                                          )}
                                                                     </div>
                                                                 </td>
                                                                  <td className="p-2 border-r border-slate-100 text-center">
                                                                      <InlineSelect
                                                                          value={
                                                                              createFormik.values.itemMasters[index].uom
                                                                          }
                                                                          onChange={(value) => {
                                                                              createFormik.setFieldValue(
                                                                                  `itemMasters.${index}.uom`,
                                                                                  value,
                                                                              );
                                                                          }}
                                                                          placeholder="Unit"
                                                                          options={units.map((unit) => ({
                                                                              label: unit.unit_name,
                                                                              value: unit.unit_name,
                                                                          }))}
                                                                          className="h-9 text-sm text-center"
                                                                          error={!!(rowTouched?.uom && rowErrors?.uom)}
                                                                          onAddNew={async (newValue) => {
                                                                              try {
                                                                                  const response = await axios.post('/api/units', { unit_name: newValue });
                                                                                  const created = response.data.data || response.data;
                                                                                  setUnits((prev) => [...prev, created]);
                                                                                  return { id: created.unit_name, label: created.unit_name };
                                                                              } catch (error: any) {
                                                                                  throw new Error(error?.response?.data?.message || 'Failed to create unit');
                                                                              }
                                                                          }}
                                                                      />
                                                                      {rowTouched?.uom &&
                                                                          rowErrors?.uom && (
                                                                              <p className="text-[10px] text-red-500 mt-0.5">
                                                                                  {rowErrors.uom}
                                                                              </p>
                                                                          )}
                                                                  </td>
                                                                 <td className="p-2 border-r border-slate-100 text-right">
                                                                     <Input
                                                                         name={`itemMasters.${index}.rate`}
                                                                         value={
                                                                             createFormik.values.itemMasters[index]
                                                                                 .rate
                                                                         }
                                                                         onChange={createFormik.handleChange}
                                                                         placeholder="0.00"
                                                                         type="number"
                                                                         disabled={!!editingGroup && !!createFormik.values.itemMasters[index].id}
                                                                         className={`h-9 text-sm text-right placeholder:text-muted-foreground ${editingGroup && createFormik.values.itemMasters[index].id ? "cursor-not-allowed opacity-60" : ""} ${rowTouched?.rate && rowErrors?.rate ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                                                                     />
                                                                     {rowTouched?.rate &&
                                                                         rowErrors?.rate && (
                                                                             <p className="text-[10px] text-red-500 mt-0.5">
                                                                                 {rowErrors.rate}
                                                                             </p>
                                                                         )}
                                                                     {editingGroup && createFormik.values.itemMasters[index].id && createFormik.values.itemMasters[index].rateHistory && createFormik.values.itemMasters[index].rateHistory!.length > 0 && (
                                                                         <div className="mt-1 hidden space-y-0.5">
                                                                             {[...createFormik.values.itemMasters[index].rateHistory!]
                                                                                 .sort((a: Price, b: Price) => {
                                                                                     const aCurrent = a.expiry_date === null;
                                                                                     const bCurrent = b.expiry_date === null;
                                                                                     if (aCurrent && !bCurrent) return -1;
                                                                                     if (!aCurrent && bCurrent) return 1;
                                                                                     return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
                                                                                 })
                                                                                 .map((p: Price, hIdx: number) => {
                                                                                     const isCurrent = p.expiry_date === null;
                                                                                     return (
                                                                                         <div key={p.id} className={`text-[9px] px-1 py-0.5 rounded ${isCurrent ? "bg-green-50 text-green-700 font-medium" : "text-muted-foreground"}`}>
                                                                                             ₹{Number(p.price).toFixed(2)}
                                                                                             {isCurrent && <span className="ml-0.5">(Current)</span>}
                                                                                             {!isCurrent && <span className="ml-0.5">({new Date(p.start_date).toLocaleDateString()} - {p.expiry_date ? new Date(p.expiry_date).toLocaleDateString() : "active"})</span>}
                                                                                         </div>
                                                                                     );
                                                                                 })}
                                                                         </div>
                                                                     )}
                                                                 </td>
                                                                 <td className="p-2 border-r border-slate-100 text-center">
                                                                     <Input
                                                                         name={`itemMasters.${index}.gst_master`}
                                                                         value={
                                                                             createFormik.values.itemMasters[index]
                                                                                 .gst_master
                                                                         }
                                                                          onChange={(e) => {
                                                                              const val = e.target.value.replace(/\D/g, "");
                                                                              createFormik.setFieldValue(
                                                                                  `itemMasters.${index}.gst_master`,
                                                                                  val,
                                                                              );
                                                                          }}
                                                                         placeholder="GST"
                                                                         className="h-9 text-sm text-center placeholder:text-muted-foreground"
                                                                     />
                                                                  </td>
                                                                 <td className="p-2 text-center">
                                                                    <div className="flex items-center justify-center gap-1">
                                                                        {createFormik.values.itemMasters[index].id && (
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <Button
                                                                                            type="button"
                                                                                            variant="ghost"
                                                                                            size="icon"
                                                                                            className="h-7 w-7"
                                                                                            onClick={() => handleOpenRateUpdate({
                                                                                                id: createFormik.values.itemMasters[index].id!,
                                                                                                item_name: createFormik.values.itemMasters[index].item_name,
                                                                                                rate: createFormik.values.itemMasters[index].rate ? parseFloat(createFormik.values.itemMasters[index].rate) : null,
                                                                                                searching_preference: null,
                                                                                                uom: "",
                                                                                                gst_master: "",
                                                                                                is_subcontractor: false,
                                                                                                subcontractor_id: "",
                                                                                                srNo: "",
                                                                                                itemNo: "",
                                                                                                current_price: null,
                                                                                                is_active: true,
                                                                                                createdAt: new Date().toISOString(),
                                                                                            })}
                                                                                        >
                                                                                            <IndianRupee className="h-3.5 w-3.5" />
                                                                                        </Button>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent>
                                                                                        Change Rate
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        )}
                                                                        <Button
                                                                            type="button"
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                            onClick={() => remove(index)}
                                                                            disabled={
                                                                                createFormik.values.itemMasters.length ===
                                                                                1
                                                                            }
                                                                        >
                                                                            <Trash2 className="h-3.5 w-3.5" />
                                                                        </Button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="p-3 bg-slate-50 border-t border-slate-200">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                    onClick={() => {
                                                        push({
                                                            id: undefined,
                                                            sorId: editingGroup?.sorId || createFormik.values.itemMasters[0]?.sorId || "",
                                                            departmentId: editingGroup?.departmentId || createFormik.values.itemMasters[0]?.departmentId || "",
                                                            item_name: "",
                                                            searchPreferences: [],
                                                            _searchInput: "",
                                                            uom: "",
                                                            gst_master: "",
                                                            is_subcontractor: false,
                                                            subcontractor_id: "",
                                                            other_item_id: [],
                                                            itemNo: "",
                                                            rate: "",
                                                            currentPrice: "",
                                                            rateHistory: [],
                                                        });
                                                        setTimeout(() => {
                                                            if (tableScrollRef.current) {
                                                                tableScrollRef.current.scrollTop = tableScrollRef.current.scrollHeight;
                                                            }
                                                        }, 0);
                                                    }}
                                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 text-sm h-8"
                                            >
                                                <Plus className="h-4 w-4 mr-1.5" />
                                                Add More Item
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            );
                        }
                    }
                        </FieldArray>
                    </Form>
                </FormikProvider>
            </FormModal>

            {/* Delete Confirmation */}
            <Dialog
                open={!!deleteGroup}
                onOpenChange={(open) => {
                    if (!open) setDeleteGroup(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this group (SOR: {deleteGroup?.sorName}, Department: {deleteGroup?.departmentName}) with {deleteGroup?.itemsCount} item(s)? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteGroup(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteConfirm}
                            disabled={deleteLoading}
                        >
                            {deleteLoading ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Other Item Confirmation */}
            <Dialog
                open={!!deleteOtherItem}
                onOpenChange={(open) => {
                    if (!open) setDeleteOtherItem(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete "{deleteOtherItem?.item_name}"? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteOtherItem(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteOtherItemConfirm}
                            disabled={deleteOtherItemLoading}
                        >
                            {deleteOtherItemLoading ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Other Item Change Confirmation */}
            <Dialog
                open={confirmOtherItemDialogOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setConfirmOtherItemDialogOpen(false);
                        setPendingOtherItemChange(null);
                    }
                }}
            >
                <DialogContent hideCloseButton>
                    <DialogHeader>
                        <DialogTitle>Confirm Other Item Change</DialogTitle>
                        <DialogDescription>
                            Warning: This item has already been used in one or more Purchase Entries. Removing it from the Other Item category may cause incorrect calculations or inconsistencies in existing Purchase Entries and the Project Abstract. Are you sure you want to continue?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => {
                            if (pendingOtherItemChange) {
                                createFormik.setFieldValue(
                                    `itemMasters.${pendingOtherItemChange.index}.other_item_id`,
                                    pendingOtherItemChange.oldValue,
                                );
                            }
                            setConfirmOtherItemDialogOpen(false);
                            setPendingOtherItemChange(null);
                        }}>
                            Cancel
                        </Button>
                        <Button variant="default" onClick={() => {
                            setConfirmOtherItemDialogOpen(false);
                            setPendingOtherItemChange(null);
                        }}>
                            Continue
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Price Management Dialog */}
            <Dialog
                open={!!priceItem}
                onOpenChange={(open) => {
                    if (!open) {
                        setPriceItem(null);
                        setPrices([]);
                    }
                }}
            >
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Manage Prices - {priceItem?.item_name}</DialogTitle>
                        <DialogDescription>
                            Add new prices or view price history for this item
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <div className="mb-4 p-4 border rounded">
                            <h3 className="font-semibold mb-2">Add New Price</h3>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <Label>Price *</Label>
                                    <Input
                                        type="number"
                                        value={priceForm.price}
                                        onChange={(e) =>
                                            setPriceForm({ ...priceForm, price: e.target.value })
                                        }
                                        placeholder="Price"
                                    />
                                </div>
                                <div>
                                    <Label>Start Date</Label>
                                    <Input
                                        type="date"
                                        value={priceForm.start_date}
                                        onChange={(e) =>
                                            setPriceForm({ ...priceForm, start_date: e.target.value })
                                        }
                                    />
                                </div>
                                <div>
                                    <Label>Expiry Date (Optional)</Label>
                                    <Input
                                        type="date"
                                        value={priceForm.expiry_date}
                                        onChange={(e) =>
                                            setPriceForm({
                                                ...priceForm,
                                                expiry_date: e.target.value,
                                            })
                                        }
                                    />
                                </div>
                            </div>
                            <Button className="mt-4" onClick={handleAddPrice}>
                                Add Price
                            </Button>
                        </div>
                        <h3 className="font-semibold mb-2">Price History</h3>
                        {priceLoading ? (
                            <p>Loading...</p>
                        ) : (
                            <table className="w-full text-sm border-collapse">
                                <thead>
                                    <tr className="border-b bg-slate-100">
                                        <th className="p-2 text-left">Price</th>
                                        <th className="p-2 text-left">Start Date</th>
                                        <th className="p-2 text-left">Expiry Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {prices.map((p) => (
                                        <tr key={p.id} className="border-b">
                                            <td className="p-2">{p.price}</td>
                                            <td className="p-2">
                                                {new Date(p.start_date).toLocaleDateString()}
                                            </td>
                                            <td className="p-2">
                                                {p.expiry_date
                                                    ? new Date(p.expiry_date).toLocaleDateString()
                                                    : "Active"}
                                            </td>
                                        </tr>
                                    ))}
                                    {prices.length === 0 && (
                                        <tr>
                                            <td
                                                colSpan={3}
                                                className="p-4 text-center text-muted-foreground"
                                            >
                                                No prices found
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* View Group Items Modal */}
            <Dialog
                open={!!viewGroup}
                onOpenChange={(open) => {
                    if (!open) setViewGroup(null);
                }}
            >
                <DialogContent className="max-w-5xl">
                    <DialogHeader>
                        <DialogTitle>
                            Items - SOR: {viewGroup?.sorName} | Department: {viewGroup?.departmentName}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        {viewGroup?.items && viewGroup.items.length > 0 ? (
                            <div className="rounded-md border overflow-hidden">
                                <div className="overflow-auto max-h-[60vh]">
                                    <table className="w-full text-sm border-collapse">
                                        <thead className="sticky top-0 z-10 bg-slate-50">
                                            <tr className="text-xs uppercase tracking-wider text-slate-700 border-b">
                                                <th className="p-3 text-left">Sr No.</th>
                                                <th className="p-3 text-left">Item No.</th>
                                                <th className="p-3 text-left">Item Name</th>
                                                <th className="p-3 text-left">Unit</th>
                                                <th className="p-3 text-right">Rate</th>
                                                <th className="p-3 text-center">GST %</th>
                                        <th className="p-3 text-center">Subcontractor</th>
                                        <th className="p-3 text-center w-[60px]">Action</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200">
                                            {viewGroup.items.flatMap((item) => {
                                                const subItemIds = item.other_item_ids
                                                    ? item.other_item_ids.split(',').filter(Boolean)
                                                    : [];
                                                const subItems = subItemIds
                                                    .map((id) => otherItems.find((oi) => oi.id === id))
                                                    .filter(Boolean) as CapitalSorItem[];
                                                return [
                                                    <tr key={item.id} className="hover:bg-slate-50">
                                                        <td className="p-3">{item.srNo || "-"}</td>
                                                        <td className="p-3">{item.itemNo || "-"}</td>
                                                        <td className="p-3 font-medium">{item.item_name}</td>
                                                        <td className="p-3">{item.uom || "-"}</td>
                                                        <td className="p-3 text-right">{item.rate ?? "-"}</td>
                                                        <td className="p-3 text-center">{item.gst_master || "-"}</td>
                                                        <td className="p-3 text-center">
                                                            {item.is_subcontractor && item.subcontractor_name ? item.subcontractor_name : "-"}
                                                        </td>
                                                    </tr>,
                                                    ...subItems.map((subItem) => (
                                                        <tr key={`${item.id}-${subItem.id}`} className="hover:bg-slate-50 bg-slate-50/50">
                                                            <td className="p-3"></td>
                                                            <td className="p-3"></td>
                                                            <td className="p-3 pl-8 text-sm text-muted-foreground">
                                                                <span className="text-xs text-muted-foreground mr-1">↳</span>
                                                                {subItem.item_name}
                                                            </td>
                                                            <td className="p-3 text-sm text-muted-foreground">{subItem.uom || "-"}</td>
                                                            <td className="p-3 text-right text-sm text-muted-foreground">{subItem.rate ?? "-"}</td>
                                                            <td className="p-3 text-center text-sm text-muted-foreground">{subItem.gst_master || "-"}</td>
                                                            <td className="p-3 text-center text-sm text-muted-foreground">
                                                                {subItem.is_subcontractor && subItem.subcontractor_name ? subItem.subcontractor_name : "-"}
                                                            </td>
                                                        </tr>
                                                    )),
                                                ];
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        ) : (
                            <p className="text-center text-muted-foreground py-4">No items found in this group</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Rate Update Modal */}
            <Dialog
                open={!!rateItem}
                onOpenChange={(open) => {
                    if (!open) {
                        setRateItem(null);
                        setRateHistory([]);
                    }
                }}
            >
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Update Rate - {rateItem?.item_name}</DialogTitle>
                        <DialogDescription>
                            Update the rate for this item and view rate history
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 max-h-[60vh] overflow-y-auto">
                        <div className="mb-6 p-4 border rounded">
                            <h3 className="font-semibold mb-4">Update Rate</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex-1 space-y-2 relative">
                                    <Label>New Rate *</Label>
                                    <Input
                                        type="number"
                                        value={rateUpdateForm.newRate}
                                        onChange={(e) =>
                                            setRateUpdateForm({ ...rateUpdateForm, newRate: e.target.value })
                                        }
                                        placeholder="Enter new rate"
                                    />
                                </div>
                                <div className="flex-1 space-y-2 relative">
                                    <Label>Effective Date *</Label>
                                    <Input
                                        type="date"
                                        value={rateUpdateForm.effectiveDate}
                                        min={new Date().toISOString().split('T')[0]}
                                        onChange={(e) =>
                                            setRateUpdateForm({ ...rateUpdateForm, effectiveDate: e.target.value })
                                        }
                                    />
                                </div>
                            </div>
                            <Button className="mt-4" onClick={handleUpdateRate} disabled={rateUpdateLoading}>
                                {rateUpdateLoading ? "Updating..." : "Update Rate"}
                            </Button>
                        </div>
                        {rateHistory.length > 0 && (
                            <>
                                <h3 className="font-semibold mb-2">Rate History</h3>
                                {rateHistoryLoading ? (
                                    <p className="text-muted-foreground">Loading...</p>
                                ) : (
                                    <div className="space-y-2">
                                        {rateHistory.map((p, index) => {
                                            const isCurrent = p.expiry_date === null;
                                            const prevRate = rateHistory[index + 1];
                                            return (
                                                <div key={p.id} className={`p-3 border rounded ${isCurrent ? "bg-green-50 border-green-200" : "bg-muted"}`}>
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <p className="font-medium">
                                                                ₹{Number(p.price).toFixed(2)}
                                                                {isCurrent && (
                                                                    <span className="ml-2 text-[10px] font-semibold text-green-600">(Current)</span>
                                                                )}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                Effective: {new Date(p.start_date).toLocaleDateString()}
                                                                {p.expiry_date && (
                                                                    <> - Until: {new Date(p.expiry_date).toLocaleDateString()}</>
                                                                )}
                                                            </p>
                                                        </div>
                                                        {prevRate && (
                                                            <div className="text-right text-xs text-muted-foreground">
                                                                <p>Previous: ₹{Number(prevRate.price).toFixed(2)}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
