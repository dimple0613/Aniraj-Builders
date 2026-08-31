'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import axios from 'axios';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';

import { Column, DataTable, DataTableFilter, FormModal } from '../common';
import { UnitManager } from '../common/UnitManager';
import { AYMasterManager } from '../common/AYMasterManager';
import { GroupManager } from './GroupManager';
import { InlineSelect } from '../common/InlineSelect';
import { Checkbox } from '../ui/checkbox';
import { sortEstimateItems, naturalCompare } from '@/lib/utils/sortEstimateItems';
import { Labels } from '../ui/labels';

interface Unit {
    id: string;
    unit_name: string;
}

interface AYMaster {
    id: string;
    ay_no: string;
}

interface WorkType {
    id: string;
    name: string;
}

interface WorkTypePrice {
    id?: string;
    work_type_id: string;
    price: number;
}

interface SearchPreference {
    id: string;
    value: string;
}

interface SORGroupType {
    id: string;
    name: string;
}

interface ItemManagement {
    id: string;
    item_name: string;
    unit_id: string;
    ay_id?: string;
    group_id?: string;
    group?: SORGroupType | null;
    work_type: boolean;
    unit: Unit;
    ay?: AYMaster;
    workTypePrices?: WorkTypePrice[];
    searchPreferences?: SearchPreference[];
    createdAt: string;
    updatedAt: string;
}


export default function ItemManagementClient() {
    const [data, setData] = useState<ItemManagement[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [ayMasters, setAyMasters] = useState<AYMaster[]>([]);
    const [groups, setGroups] = useState<any[]>([]);
    const [workTypes, setWorkTypes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ItemManagement | null>(null);
    const [filterUnit, setFilterUnit] = useState<string[]>([]);
    const [filterAy, setFilterAy] = useState<string[]>([]);
    const [filterGroup, setFilterGroup] = useState<string[]>([]);
    const [deleteItem, setDeleteItem] = useState<ItemManagement | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const [pagination, setPagination] = useState({
        page: 1,
        totalPages: 1,
    });

    const [formData, setFormData] = useState<any>({
        item_name: '',
        unit_id: '',
        ay_id: '',
        searchPreferences: [],
        prices: {},
        enabledWorkTypes: {},
        updateAllVardhis: {},
        group_id: '',
    });
    const [formLoading, setFormLoading] = useState(false);
    const [confirmVardhiWorkType, setConfirmVardhiWorkType] = useState<string | null>(null);
    const [searchPrefInput, setSearchPrefInput] = useState('');
    const [viewSearchPrefs, setViewSearchPrefs] = useState<string[] | null>(null);

    const fetchData = useCallback(async (
        page = 1,
        searchValue = search,
        sort = sortField,
        order = sortOrder,
        pageLimit = limit,
        unitFilter = filterUnit,
        ayFilter = filterAy,
        groupFilter = filterGroup
    ) => {
        try {
            setLoading(true);

            const response = await axios.get('/api/item-management', {
                params: {
                    page,
                    limit: pageLimit,
                    search: searchValue,
                    sortField: sort,
                    sortOrder: order,
                    unit_id: unitFilter,
                    ay_id: ayFilter,
                    group_id: groupFilter,
                },
            });

            setData(response.data.data);

            setPagination({
                page: response.data.pagination.page,
                totalPages: response.data.pagination.pages,
            });
        } catch (error) {
            toast.error('Failed to fetch items');
        } finally {
            setLoading(false);
        }
    }, [search, sortField, sortOrder, limit, filterUnit, filterAy, filterGroup]);

    const fetchUnits = useCallback(async () => {
        try {
            const response = await axios.get('/api/units?limit=9999');
            setUnits(response.data.data);
        } catch {
            toast.error('Failed to fetch Units');
        }
    }, []);

    const fetchAyMasters = useCallback(async () => {
        try {
            const response = await axios.get('/api/ay-masters?limit=9999');
            setAyMasters(response.data.data);
        } catch {
            toast.error('Failed to fetch Item Number');
        }
    }, []);

    const fetchGroups = useCallback(async () => {
        try {
            const response = await axios.get('/api/sor-groups?limit=9999');
            setGroups(response.data.data || []);
        } catch {
            toast.error('Failed to fetch Groups');
        }
    }, []);

    const fetchWorkTypes = useCallback(async () => {
        try {
            const response = await axios.get('/api/work-type?limit=9999');
            setWorkTypes(response.data.data || []);
        } catch {
            console.error('Failed to fetch Work Types');
        }
    }, []);

    useEffect(() => {
        const loadInitialData = async () => {
            await fetchWorkTypes();   // wait
            await fetchData();        // then fetch items
            fetchUnits();
            fetchAyMasters();
            fetchGroups();
        };

        loadInitialData();
    }, []);

    useEffect(() => {
        fetchData(1);
    }, [search, sortField, sortOrder, limit, filterUnit, filterAy, filterGroup]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.item_name.trim() || !formData.unit_id) {
            toast.error('Item name and unit are required');
            return;
        }

        // Validate prices for enabled work types
        for (const wt of workTypes) {
            if (formData.enabledWorkTypes[wt.id] && !formData.prices[wt.id]) {
                toast.error(`Price is required for ${wt.name}`);
                return;
            }
        }

        try {
            setFormLoading(true);

            const workTypePrices: { work_type_id: string; price: number, add_new: boolean, update_all_vardhis: boolean }[] = [];

            workTypes.forEach(wt => {
                if (formData?.enabledWorkTypes[wt.id]) {
                    workTypePrices.push({
                        work_type_id: wt.id,
                        price: parseFloat(formData?.prices[wt.id]),
                        add_new: formData?.updatePrices ? formData?.updatePrices[wt.id] : false,
                        update_all_vardhis: formData?.updateAllVardhis ? !!formData?.updateAllVardhis[wt.id] : false,
                    });
                }
            });

            const payload = {
                item_name: formData.item_name,
                unit_id: formData.unit_id,
                ay_id: formData.ay_id || null,
                group_id: formData.group_id || null,
                workTypePrices,
                searchPreferences: formData.searchPreferences,
            };

            if (editingItem) {
                await axios.put(`/api/item-management/${editingItem.id}`, payload);
                toast.success('Item updated successfully');
            } else {
                await axios.post('/api/item-management', payload);
                toast.success('Item created successfully');
            }

            setModalOpen(false);
            setEditingItem(null);
            resetForm();
            fetchData(pagination.page);
        } catch (error: any) {
            const err = error
            console.error("error", error)
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save item');
        } finally {
            setFormLoading(false);
        }
    };

    const handleEdit = (item: ItemManagement) => {
        const prices: Record<string, string> = {};
        const enabledWorkTypes: Record<string, boolean> = {};

        workTypes.forEach(wt => {
            const priceEntry = item.workTypePrices?.find((p: any) => p.work_type_id === wt.id && p.expiry_date == null);
            if (priceEntry) {
                enabledWorkTypes[wt.id] = true;
                prices[wt.id] = priceEntry.price.toString();
            } else {
                enabledWorkTypes[wt.id] = false;
                prices[wt.id] = '';
            }
        });

        const searchPrefValues = item.searchPreferences?.map(sp => sp.value) || [];

        setEditingItem(item);
        setFormData({
            item_name: item.item_name,
            unit_id: item.unit_id,
            ay_id: item.ay_id || '',
            searchPreferences: searchPrefValues,
            prices,
            enabledWorkTypes,
            updateAllVardhis: {},
            group_id: item.group_id || '',
        });
        setModalOpen(true);
    };

    const handleDelete = (item: ItemManagement) => {
        setDeleteItem(item);
    };

    const confirmDelete = async () => {
        if (!deleteItem) return;

        try {
            setDeleteLoading(true);
            await axios.delete(`/api/item-management/${deleteItem.id}`);
            toast.success('Item deleted successfully');
            fetchData(pagination.page);
            setDeleteItem(null);
        } catch (error: unknown) {
            const err = error as any;
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete item');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingItem(null);
        resetForm();
        setModalOpen(true);
    };

    const resetForm = () => {
        setFormData({
            item_name: '',
            unit_id: '',
            ay_id: '',
            searchPreferences: [],
            prices: {},
            enabledWorkTypes: {},
            updateAllVardhis: {},
            group_id: '',
        });
        setSearchPrefInput('');
    };

    const handleCreateUnit = async (value: string) => {
        try {
            const response = await axios.post('/api/units', { unit_name: value });

            const newUnit = response.data;
            await fetchUnits();
            return newUnit;

        } catch (error: any) {

            if (error.response?.status === 409) {
                toast.error(error.response.data.error);
                return null;
            }

            console.error(error);
            alert("Something went wrong");
            return null;
        }
    };

    const handleCreateAY = async (value: string) => {
        try {
            const response = await axios.post('/api/ay-masters', { ay_no: value });

            const newAY = response.data;
            await fetchAyMasters();
            return newAY;

        } catch (error: any) {

            if (error.response?.status === 409) {
                toast.error(error.response.data.error);
                return null;
            }

            console.error(error);
            alert("Something went wrong");
            return null;
        }
    };

    const handleCreateGroup = async (value: string) => {
        try {
            const response = await axios.post('/api/sor-groups', { name: value });

            const newGroup = response.data;
            await fetchGroups();
            return newGroup;

        } catch (error: any) {

            if (error.response?.status === 409) {
                toast.error(error.response.data.error);
                return null;
            }

            console.error(error);
            alert("Something went wrong");
            return null;
        }
    };

    const workTypeMap = useMemo(() => {
        const map: Record<string, string> = {};


        workTypes.forEach(wt => {
            map[String(wt.id)] = wt.name;
        });

        return map;
    }, [workTypes]);

    const addSearchPreference = () => {
        const trimmedValue = searchPrefInput.trim();
        if (!trimmedValue) {
            toast.error('Please enter a value');
            return;
        }
        if (formData.searchPreferences.some((sp: any) => sp.toLowerCase() === trimmedValue.toLowerCase())) {
            toast.error('Duplicate value not allowed');
            return;
        }
        setFormData((prev: any) => ({
            ...prev,
            searchPreferences: [...prev.searchPreferences, trimmedValue]
        }));
        setSearchPrefInput('');
    };

    const removeSearchPreference = (index: number) => {
        setFormData((prev: any) => ({
            ...prev,
            searchPreferences: prev.searchPreferences.filter((_: any, i: any) => i !== index)
        }));
    };

    const handleSearchPrefKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addSearchPreference();
        }
    };

    const progress = useMemo(() => {
        let filled = 0;
        let total = 0;

        // All static fields in the form
        const allFields = [
            { value: formData.item_name },
            { value: formData.unit_id },
            { value: formData.ay_id },
        ];

        allFields.forEach(field => {
            total++;
            if (field.value && field.value.toString().trim() !== '') {
                filled++;
            }
        });

        // searchPreferences (count as 1 field)
        total++;
        if (formData.searchPreferences && formData.searchPreferences.length > 0) {
            filled++;
        }

        // Work Type Pricing: count checkbox and price as separate fields
        workTypes.forEach((wt) => {
            const isEnabled = formData.enabledWorkTypes?.[wt.id] || false;

            // Count the checkbox (enable work type)
            total++;
            if (isEnabled) {
                filled++;

                // Count the price input if work type is enabled
                total++;
                const price = formData.prices?.[wt.id];
                if (price && price.toString().trim() !== '' && !isNaN(parseFloat(price))) {
                    filled++;
                }
            }
        });

        return total > 0 ? Math.round((filled / total) * 100) : 0;
    }, [formData, workTypes]);

    const sortedGroups = useMemo(() => {
        return [...groups].sort((a: any, b: any) => a.name?.localeCompare(b.name));
    }, [groups]);

    const columns = useMemo<Column<ItemManagement>[]>(() => {
        return [
            {
                header: 'Item',
                accessorKey: 'item_name',
                sortable: true,
                cell: (item) => {
                    return (
                        <div className="flex flex-col">
                            <span className="font-medium">
                                {item.item_name || '-'}
                            </span>

                            <span className="text-xs text-muted-foreground">
                                Unit: {item.unit?.unit_name || '-'} | Item Number: {item.ay?.ay_no || '-'}
                            </span>
                        </div>
                    );
                },
            },
            {
                header: 'Group',
                accessorKey: 'group_id',
                sortable: false,
                cell: (item) => {
                    return item.group?.name || '-';
                },
            },
            {
                header: 'Search Preference',
                accessorKey: 'searchPreferences',
                sortable: false,
                cell: (item) => {
                    if (!item.searchPreferences?.length) return '-';
                    const values = item.searchPreferences.map(sp => sp.value);
                    return (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground max-w-[150px] truncate">
                                {values.join(', ')}
                            </span>
                            <button
                                onClick={() => setViewSearchPrefs(values)}
                                className="text-xs text-blue-500 hover:text-blue-700 underline"
                            >
                                View
                            </button>
                        </div>
                    );
                },
            },
            {
                header: 'Prices',
                cell: (item) => {
                    if (!item.workTypePrices?.length) return '-';
                    return (
                        <div className="flex flex-col gap-1 text-xs">
                            <div className="flex flex-wrap gap-2">
                                {
                                    item.workTypePrices
                                        ?.filter((wtp: any) => wtp.expiry_date == null)
                                        .map((wtp: any) => {
                                            const wtName = workTypeMap[wtp.work_type_id] ?? 'Unknown';

                                            return (
                                                <span
                                                    key={wtp.id ?? wtp.work_type_id}
                                                    className="inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground"
                                                >
                                                    {wtName} :
                                                    <span className="max-w-[500px] truncate font-medium">
                                                        ₹{wtp.price}
                                                    </span>
                                                </span>
                                            );
                                        })
                                }
                            </div>
                        </div>
                    );
                },
            },
        ];
    }, [workTypeMap]);

    const sortedData = useMemo(() => {
        // If user explicitly sorted by a field, respect that sort
        if (sortField) {
            let sorted = sortEstimateItems(data, sortField as keyof EstimateItem);
            return sortOrder === 'desc' ? sorted.reverse() : sorted;
        } else {
            // No explicit sort field - data is already sorted by backend by Item Number (ay_no)
            return data;
        }
    }, [data, sortField, sortOrder]);

    const sortedAyMasters = useMemo(() => {
        return [...ayMasters].sort((a, b) => naturalCompare(a.ay_no || '', b.ay_no || ''));
    }, [ayMasters]);

    return (
        <div className="flex flex-col gap-4 md:gap-6  w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Maintenance SOR
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <UnitManager onSuccess={() => fetchUnits()} />
                    <AYMasterManager onSuccess={() => fetchAyMasters()} />
                    <GroupManager />
                </div>
            </div>

            <DataTable
                key={Object.keys(workTypeMap).length}
                data={sortedData}
                columns={columns}
                loading={loading}
                pagination={pagination}
                onPageChange={(page) => fetchData(page)}
                onSearch={(value) => setSearch(value)}
                onSortChange={(field, order) => {
                    setSortField(field);
                    setSortOrder(order);
                }}
                onLimitChange={(newLimit) => setLimit(newLimit)}
                onAdd={handleAdd}
                onEdit={handleEdit}
                onDelete={handleDelete}
                filters={(
                    <div className="flex flex-wrap items-center gap-2 order-[3] w-full sm:w-auto">
                        <DataTableFilter
                            title="Unit"
                            options={units?.map((unit) => ({
                                label: unit.unit_name,
                                value: unit.id,
                            }))}
                            selectedValues={filterUnit}
                            onChange={(values: any) => setFilterUnit(values)}
                        />

                        <DataTableFilter
                            title="Item Number"
                            options={sortedAyMasters.map((ay) => ({
                                label: ay.ay_no,
                                value: ay.id,
                            }))}
                            selectedValues={filterAy}
                            onChange={(values: any) => setFilterAy(values)}
                        />

                        <DataTableFilter
                            title="Group"
                            options={sortedGroups.map((g: any) => ({
                                label: g.name,
                                value: g.id,
                            }))}
                            selectedValues={filterGroup}
                            onChange={(values: any) => setFilterGroup(values)}
                        />

                        {(filterUnit && filterUnit.length > 0 || filterAy && filterAy.length > 0 || filterGroup && filterGroup.length > 0) && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setFilterUnit([]);
                                    setFilterAy([]);
                                    setFilterGroup([]);
                                }}
                                className='inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border gap-1.5'
                            >
                                Clear All
                            </Button>
                        )}
                    </div>
                )}
            />

            <FormModal
                title={editingItem ? 'Edit Item' : 'Add Item'}
                isOpen={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setEditingItem(null);
                    resetForm();
                }}
                loading={formLoading}
                progress={progress}
            >
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                        <div className="space-y-2 relative">
                            <Label>Group</Label>
                            <InlineSelect
                                value={formData.group_id}
                                onChange={(value: any) => setFormData({ ...formData, group_id: value })}
                                placeholder="Select group"
                                options={groups.map((g: any) => ({ label: g.name, value: g.id }))}
                                onAddNew={handleCreateGroup}
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="item_name">Item Name *</Label>
                            <Input
                                id="item_name"
                                value={formData.item_name}
                                onChange={(e) => setFormData({ ...formData, item_name: e.target.value })}
                                placeholder="Enter item name"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                        <div className="space-y-2 relative">
                            <Label>Searching Preference</Label>
                            <div className="flex gap-2">
                                <Input
                                    value={searchPrefInput}
                                    onChange={(e) => setSearchPrefInput(e.target.value)}
                                    onKeyDown={handleSearchPrefKeyDown}
                                    placeholder="Enter keyword and click Add"
                                    className="flex-1"
                                />
                                <Button
                                    type="button"
                                    onClick={addSearchPreference}
                                    variant="secondary"
                                >
                                    Add
                                </Button>
                            </div>
                            {formData.searchPreferences.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {formData.searchPreferences.map((pref: any, index: any) => (
                                        <span
                                            key={index}
                                            className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium bg-muted"
                                        >
                                            {pref}
                                            <button
                                                type="button"
                                                onClick={() => removeSearchPreference(index)}
                                                className="ml-1 text-destructive hover:text-red-600"
                                            >
                                                ×
                                            </button>
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 relative">
                            <Label>Unit *</Label>
                            <InlineSelect
                                value={formData.unit_id}
                                onChange={(value: any) => setFormData({ ...formData, unit_id: value })}
                                placeholder="Select unit"
                                options={units.map(u => ({ label: u.unit_name, value: u.id }))}
                                onAddNew={handleCreateUnit}
                            />
                        </div>
                        <div className="space-y-2 relative">
                            <Label>Item Number *</Label>
                            <InlineSelect
                                value={formData.ay_id}
                                onChange={(value: any) => setFormData({ ...formData, ay_id: value })}
                                placeholder="Select AY"
                                options={sortedAyMasters.map(a => ({ label: a.ay_no, value: a.id }))}
                                onAddNew={handleCreateAY}
                            />
                        </div>
                    </div>

                    <div className="border-t relative pt-4 mt-4 ">
                        <Labels className="text-base font-medium">Work Type Pricing</Labels>
                        <p className="text-sm text-muted-foreground mb-4">Select work types and enter prices</p>

                        <div className="space-y-4">
                            {workTypes.map((wt) => {
                                const activePriceEntry = editingItem?.workTypePrices?.find(
                                    (p: any) => p.work_type_id === wt.id && p.expiry_date == null
                                );

                                const oldPrices = editingItem?.workTypePrices?.filter(
                                    (p: any) => p.work_type_id === wt.id && p.expiry_date != null
                                );

                                const isEnabled = formData.enabledWorkTypes[wt.id] || false;
                                const isUpdating = formData?.updatePrices?.[wt.id] || false;

                                return (
                                    <div
                                        key={wt.id}
                                        className="border rounded-xl p-4 space-y-3 bg-muted/20"
                                    >
                                        {/* Top Row */}
                                        <div className="flex items-center justify-between flex-wrap gap-4">
                                            <div className="flex items-center gap-3">
                                                <Checkbox
                                                    id={`enable-${wt.id}`}
                                                    checked={isEnabled}
                                                        onCheckedChange={(checked) =>
                                                            setFormData((prev: any) => ({
                                                                ...prev,
                                                                enabledWorkTypes: {
                                                                    ...prev.enabledWorkTypes,
                                                                    [wt.id]: checked as boolean,
                                                                },
                                                                updatePrices: {
                                                                    ...prev.updatePrices,
                                                                    [wt.id]: false,
                                                                },
                                                                updateAllVardhis: {
                                                                    ...prev.updateAllVardhis,
                                                                    [wt.id]: false,
                                                                },
                                                            }))
                                                    }
                                                />

                                                <Labels htmlFor={`enable-${wt.id}`} className="font-semibold">
                                                    {wt.name}
                                                </Labels>
                                            </div>

                                            {/* Current Active Price */}
                                            {activePriceEntry && (
                                                <span className="text-sm font-medium text-primary">
                                                    Current: ₹{activePriceEntry.price}
                                                </span>
                                            )}
                                        </div>

                                        {/* Update Price Section */}
                                        {isEnabled && (
                                            <div className="space-y-2">
                                                <div className="flex items-center gap-3">
                                                    <Checkbox
                                                        id={`update-${wt.id}`}
                                                        checked={isUpdating}
                                                        // disabled={!activePriceEntry}
                                                        onCheckedChange={(checked) =>
                                                            setFormData((prev: any) => ({
                                                                ...prev,
                                                                updatePrices: {
                                                                    ...prev.updatePrices,
                                                                    [wt.id]: checked as boolean,
                                                                },
                                                                updateAllVardhis: checked ? prev.updateAllVardhis : {
                                                                    ...prev.updateAllVardhis,
                                                                    [wt.id]: false,
                                                                },
                                                            }))
                                                        }
                                                    />
                                                    <Labels
                                                        htmlFor={`update-${wt.id}`}
                                                        className="text-sm font-medium"
                                                    >
                                                        Update Price
                                                    </Labels>
                                                    {/* Price Input */}
                                                    <div className="flex items-center gap-2  ml-auto pl-[10px]">
                                                        <span className="text-sm text-muted-foreground">₹</span>
                                                        <Input
                                                            type="number"
                                                            step="0.01"
                                                            className="w-40 h-9"
                                                            disabled={!isUpdating}
                                                            value={formData.prices[wt.id] || ""}
                                                            onChange={(e) =>
                                                                setFormData((prev: any) => ({
                                                                    ...prev,
                                                                    prices: {
                                                                        ...prev.prices,
                                                                        [wt.id]: e.target.value,
                                                                    },
                                                                }))
                                                            }
                                                            placeholder="Enter new price"
                                                        />
                                                    </div>
                                                </div>

                                                {isUpdating && (
                                                    <div className="flex items-center gap-2 mt-2 ml-6">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            className="text-xs h-7"
                                                            onClick={() => setConfirmVardhiWorkType(wt.id)}
                                                        >
                                                            Update in All Vardhis
                                                        </Button>
                                                        {formData?.updateAllVardhis?.[wt.id] && (
                                                            <span className="text-xs text-green-600 font-medium">
                                                                Will update all Vardhis for {wt.name}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Old Price History */}
                                                {oldPrices && oldPrices.length > 0 && (
                                                    <div className="flex flex-wrap gap-2 mt-2">
                                                        {oldPrices.map((old) => (
                                                            <span
                                                                key={old.id}
                                                                className="text-xs px-2 py-1 rounded-full border bg-background text-muted-foreground"
                                                            >
                                                                ₹{old.price}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                            {workTypes.length === 0 && (
                                <p className="text-sm text-muted-foreground italic">No work types found. Please add work types in Master Settings.</p>
                            )}
                        </div>
                    </div>

                    <Button
                        type="submit"
                        disabled={formLoading || !formData.item_name.trim() || !formData.unit_id}
                        className="w-full"
                    >
                        {formLoading ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                    </Button>
                </form>
            </FormModal>

            <Dialog
                open={!!confirmVardhiWorkType}
                onOpenChange={(open) => {
                    if (!open) setConfirmVardhiWorkType(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Update All Vardhis</DialogTitle>
                    </DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to update this item price in all existing Vardhis for this work type?
                    </DialogDescription>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setConfirmVardhiWorkType(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={() => {
                                if (confirmVardhiWorkType) {
                                    setFormData((prev: any) => ({
                                        ...prev,
                                        updateAllVardhis: {
                                            ...prev.updateAllVardhis,
                                            [confirmVardhiWorkType]: true,
                                        },
                                    }));
                                }
                                setConfirmVardhiWorkType(null);
                            }}
                        >
                            OK
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!deleteItem}
                onOpenChange={(open) => {
                    if (!open) setDeleteItem(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                    </DialogHeader>

                    <DialogDescription className="py-4">
                        Are you sure you want to delete{' '}
                        <strong>{deleteItem?.item_name}</strong>?
                    </DialogDescription>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteItem(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDelete}
                            disabled={deleteLoading}
                        >
                            {deleteLoading ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={viewSearchPrefs !== null} onOpenChange={() => setViewSearchPrefs(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Search Preferences</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        {viewSearchPrefs && viewSearchPrefs.length > 0 ? (
                            <ul className="space-y-2">
                                {viewSearchPrefs.map((pref, idx) => (
                                    <li key={idx} className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-primary" />
                                        {pref}
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-muted-foreground">No search preferences</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
