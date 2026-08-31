'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from '@/components/ui/command';
import { Plus, Trash2, ChevronsUpDown, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';

interface CapitalSORItem {
    id: string;
    item_name: string;
    uom: string;
    currentPrice: string;
    searching_preference?: string;
    prices?: Array<{
        id: string;
        price: string;
        start_date: string;
        expiry_date: string | null;
    }>;
}

interface ProjectItemData {
    id?: string;
    capital_sor_id: string;
    capitalSOR?: CapitalSORItem | null;
    size: string;
    rate: string;
}

interface ProjectItemDetailsProps {
    values: ProjectItemData[];
    setFieldValue: (name: string, value: ProjectItemData[]) => void;
    errors?: string | string[];
    touched?: boolean;
    selectedProgressItemIds?: string[];
    onProgressItemIdsChange?: (ids: string[]) => void;
    sor_id?: string | null;
    department_id?: string | null;
    disabled?: boolean;
    asOfDate?: string | null;
    projectStatus?: string | null;
    purchaseEntryCount?: number;
    initialProgressItemIds?: string[];
}

export function ProjectItemDetails({
    values,
    setFieldValue,
    errors,
    touched,
    selectedProgressItemIds = [],
    onProgressItemIdsChange,
    sor_id,
    department_id,
    disabled,
    asOfDate,
    projectStatus,
    purchaseEntryCount = 0,
    initialProgressItemIds = [],
}: ProjectItemDetailsProps) {
    const [capitalSORItems, setCapitalSORItems] = useState<CapitalSORItem[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchOpen, setSearchOpen] = useState<number | null>(null);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [pendingTrackingId, setPendingTrackingId] = useState<string | null>(null);
    const valuesRef = useRef(values);
    valuesRef.current = values;
    const initialValueLengthRef = useRef(values.length);
    const prevSorDeptKeyRef = useRef<string | null>(null);

    const fetchCapitalSOR = async (sorId?: string | null, departmentId?: string | null, isReSelection = false) => {
        try {
            setIsLoading(true);
            const params: any = { limit: 999999 };
            
            if (sorId && departmentId) {
                params.sorId = sorId;
                params.departmentId = departmentId;
            }
            if (asOfDate) {
                params.asOfDate = asOfDate;
            }
            
            const response = await axios.get('/api/item-master', { params });
            if (response.data.success) {
                const items = response.data.data.flatMap((group: any) =>
                    (group.items || []).map((item: any) => ({
                        id: item.id,
                        item_name: item.item_name,
                        uom: item.uom || '',
                        currentPrice: item.current_price || '0',
                        searching_preference: item.searching_preference,
                        prices: item.prices,
                    }))
                );
                setCapitalSORItems(items);

                if (sorId && departmentId) {
                    if (initialValueLengthRef.current === 0 || isReSelection) {
                        // Create mode OR re-selection: replace all items
                        const autoItems: ProjectItemData[] = items.map((item: any) => ({
                            capital_sor_id: item.id,
                            capitalSOR: item,
                            size: '',
                            rate: item.currentPrice || '0',
                        }));
                        setFieldValue('projectItems', autoItems);
                        // Only first item gets Price Tracking checked by default (new or re-selected)
                        onProgressItemIdsChange?.(items.length > 0 ? [items[0].id] : []);
                    } else {
                        // Initial mount: reconcile items
                        const fetchedMap = new Map(items.map((item: any) => [item.id, item]));
                        const reconciled = valuesRef.current
                            .filter((v) => fetchedMap.has(v.capital_sor_id))
                            .map((v) => {
                                const fetched = fetchedMap.get(v.capital_sor_id);
                                // Draft project: always use latest rates from Item Master
                                if (projectStatus === 'DRAFT' && fetched) {
                                    return { ...v, rate: fetched.currentPrice || '0' };
                                }
                                return v;
                            });
                        if (reconciled.length !== valuesRef.current.length) {
                            setFieldValue('projectItems', reconciled);
                        } else if (projectStatus === 'DRAFT') {
                            // Same length but rates may have changed
                            const hasRateChanges = reconciled.some((v, i) => v.rate !== valuesRef.current[i]?.rate);
                            if (hasRateChanges) {
                                setFieldValue('projectItems', reconciled);
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('Failed to fetch Item Master items:', error);
            toast.error('Failed to load Item Master items');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (!sor_id || !department_id) return;

        const key = `${sor_id}|${department_id}`;
        const hasPrevKey = prevSorDeptKeyRef.current !== null;
        const isReSelection = hasPrevKey && prevSorDeptKeyRef.current !== key;
        prevSorDeptKeyRef.current = key;

        fetchCapitalSOR(sor_id, department_id, isReSelection);
    }, [sor_id, department_id]);

    useEffect(() => {
        try {
            const bc = new BroadcastChannel('item-master-sync');
            bc.onmessage = async (event) => {
                if (event.data.type === 'saved' && sor_id && department_id && event.data.sorId === sor_id && event.data.departmentId === department_id) {
                    try {
                        setIsLoading(true);
                        const params: any = { limit: 999999, sorId: sor_id, departmentId: department_id };
                        if (asOfDate) params.asOfDate = asOfDate;
                        const response = await axios.get('/api/item-master', { params });
                        if (response.data.success) {
                            const items = response.data.data.flatMap((group: any) =>
                                (group.items || []).map((item: any) => ({
                                    id: item.id,
                                    item_name: item.item_name,
                                    uom: item.uom || '',
                                    currentPrice: item.current_price || '0',
                                    searching_preference: item.searching_preference,
                                    prices: item.prices,
                                }))
                            );
                            setCapitalSORItems(items);

                            // Merge: add only items not already present in the project
                            const existingIds = new Set(valuesRef.current.map(v => v.capital_sor_id));
                            const newItems: ProjectItemData[] = items
                                .filter(item => !existingIds.has(item.id))
                                .map(item => ({
                                    capital_sor_id: item.id,
                                    capitalSOR: item,
                                    size: '',
                                    rate: item.currentPrice || '0',
                                }));
                            if (newItems.length > 0) {
                                setFieldValue('projectItems', [...valuesRef.current, ...newItems]);
                            }
                        }
                    } catch (error) {
                        console.error('Failed to sync Item Master items:', error);
                        toast.error('Failed to sync items from Item Master');
                    } finally {
                        setIsLoading(false);
                    }
                }
            };
            return () => { bc.close(); };
        } catch {}
    }, [sor_id, department_id, asOfDate]);

    const handleAddItem = () => {
        const newItem: ProjectItemData = {
            capital_sor_id: '',
            capitalSOR: null,
            size: '',
            rate: '',
        };
        setFieldValue('projectItems', [...values, newItem]);
    };

    const handleItemSelect = (index: number, item: CapitalSORItem) => {
        const alreadyAdded = values.some(
            (v, i) => i !== index && v.capital_sor_id === item.id
        );
        if (alreadyAdded) {
            toast.error('Item is already added');
            setSearchOpen(null);
            return;
        }
        const updatedItems = [...values];
        updatedItems[index] = {
            capital_sor_id: item.id,
            capitalSOR: item,
            size: updatedItems[index].size,
            rate: item.currentPrice || '0',
        };
        setFieldValue('projectItems', updatedItems);
        setSearchOpen(null);
    };

    const handleSizeChange = (index: number, value: string) => {
        const cleaned = value.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1");
        const updatedItems = [...values];
        updatedItems[index] = { ...updatedItems[index], size: cleaned };
        setFieldValue('projectItems', updatedItems);
    };

    const handleRateChange = (index: number, value: string) => {
        const updatedItems = [...values];
        updatedItems[index] = { ...updatedItems[index], rate: value };
        setFieldValue('projectItems', updatedItems);
    };

    const handleDeleteItem = (index: number) => {
        const updatedItems = values.filter((_, i) => i !== index);
        setFieldValue('projectItems', updatedItems);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between pb-2 border-b">
                <h3 className="text-sm font-medium text-muted-foreground">
                    Tender Estimate Item
                </h3>
            </div>

            <div className="rounded-md border overflow-hidden">
                <div className="overflow-auto max-h-[300px]">
                    <table className="w-full text-sm border-collapse">
                        <thead className="sticky top-0 z-10 bg-slate-100">
                            <tr className="text-[11px] uppercase tracking-wider text-slate-700 border-b-2 border-slate-300 text-left">
                                <th className="p-3 border-r font-bold w-[50px]">Price Tracking</th>
                                <th className="p-3 border-r font-bold w-[280px]">Item Name</th>
                                <th className="p-3 border-r font-bold w-[120px]">Qty</th>
                                <th className="p-3 border-r font-bold w-[100px]">Rate</th>
                                <th className="p-3 border-r font-bold w-[120px] text-right">Grand Total</th>
                                <th className="p-3 font-bold w-[60px] text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                        Loading items...
                                    </td>
                                </tr>
                            ) : !sor_id || !department_id ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                        Select SOR and Department first to view available items.
                                    </td>
                                </tr>
                            ) : values.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-muted-foreground">
                                        No items added. Click &quot;Add Item&quot; to add Item Master items.
                                    </td>
                                </tr>
                            ) : (
                                values.map((item, index) => (
                                    <tr key={index} className="hover:bg-blue-50 transition-colors">
                                        <td className="p-2 border-r text-center">
                                            <Checkbox
                                                checked={item.capital_sor_id ? selectedProgressItemIds.includes(item.capital_sor_id) : false}
                                                onCheckedChange={(checked) => {
                                                    const id = item.capital_sor_id;
                                                    if (!id) return;
                                                    if (!checked) return;
                                                    const isSelected = selectedProgressItemIds.includes(id);
                                                    if (isSelected) return;
                                                    if (purchaseEntryCount > 0 && !initialProgressItemIds.includes(id)) {
                                                        setPendingTrackingId(id);
                                                        setConfirmDialogOpen(true);
                                                        return;
                                                    }
                                                    onProgressItemIdsChange?.([id]);
                                                }}
                                                disabled={!item.capital_sor_id}
                                                className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                            />
                                        </td>
                                        <td className="p-2 border-r">
                                            <Popover
                                                open={searchOpen === index}
                                                onOpenChange={(open) => setSearchOpen(open ? index : null)}
                                            >
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full justify-between font-normal h-8 text-xs"
                                                        disabled={disabled}
                                                    >
                                                        <span className="max-w-[200px] truncate">
                                                            {item.capitalSOR?.item_name || 'Select item'}
                                                        </span>
                                                        <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[300px] p-0" align="start">
                                                    <Command>
                                                        <CommandInput placeholder="Search items..." className="h-8" />
                                                        <CommandEmpty>No item found.</CommandEmpty>
                                                        <CommandGroup className="max-h-60 overflow-auto">
                                                            {capitalSORItems.map((sor) => (
                                                                <CommandItem
                                                                    key={sor.id}
                                                                    value={`${sor.item_name?.toLowerCase()} ${sor.searching_preference?.toLowerCase() || ''}`}
                                                                    onSelect={() => handleItemSelect(index, sor)}
                                                                    className="cursor-pointer text-xs"
                                                                >
                                                                    <Check
                                                                        className={`mr-2 h-3 w-3 ${item.capital_sor_id === sor.id ? 'opacity-100' : 'opacity-0'}`}
                                                                    />
                                                                    <span className="truncate">{sor.item_name}</span>
                                                                    {sor.uom && (
                                                                        <span className="ml-2 text-muted-foreground">
                                                                            ({sor.uom})
                                                                        </span>
                                                                    )}
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </td>

                                        <td className="p-2 border-r">
                                            <div className="space-y-1">
                                                <Input
                                                    value={item.size}
                                                    onChange={(e) => handleSizeChange(index, e.target.value)}
                                                    placeholder="Qty"
                                                    disabled={disabled}
                                                    className={`h-8 text-xs ${Array.isArray(errors) && errors[index] ? 'border-red-500' : ''}`}
                                                />
                                                {Array.isArray(errors) && errors[index] && (
                                                    <p className="text-[10px] text-red-500">{errors[index]}</p>
                                                )}
                                            </div>
                                        </td>

                                        <td className="p-2 border-r">
                                            <Input
                                                type="number"
                                                value={item.rate}
                                                onChange={(e) => handleRateChange(index, e.target.value)}
                                                placeholder="0.00"
                                                className="h-8 text-xs text-right"
                                            disabled
                                            />
                                        </td>

                                        <td className="p-2 border-r text-right">
                                            <span className="text-xs font-medium">
                                                {(parseFloat(item.size || '0') * parseFloat(item.rate || '0')).toFixed(2)}
                                            </span>
                                        </td>

                                        <td className="p-2 text-right">
                                            <span className="inline-block">
                                                <TooltipProvider>
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <span>
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className={`h-7 w-7 text-destructive hover:bg-destructive/10 ${item.capital_sor_id && selectedProgressItemIds.includes(item.capital_sor_id) ? 'opacity-50' : ''}`}
                                                                    disabled={!!(item.capital_sor_id && selectedProgressItemIds.includes(item.capital_sor_id))}
                                                                    onClick={() => handleDeleteItem(index)}
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </Button>
                                                            </span>
                                                        </TooltipTrigger>
                                                        {item.capital_sor_id && selectedProgressItemIds.includes(item.capital_sor_id) ? (
                                                            <TooltipContent>
                                                                <p>This item cannot be deleted because it is being tracked in a project.</p>
                                                            </TooltipContent>
                                                        ) : null}
                                                    </Tooltip>
                                                </TooltipProvider>
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-2 bg-muted/10 border-t flex items-center justify-between">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddItem}
                        disabled={disabled}
                        className="text-primary text-xs h-7"
                    >
                        <Plus className="h-3 w-3 mr-1" />
                        Add Item
                    </Button>
                    <p className="text-xs font-semibold text-primary">
                        Grand Total: ₹{(values.filter((v) => v.capital_sor_id).reduce((sum, v) => sum + (parseFloat(v.size) || 0) * (parseFloat(v.rate) || 0), 0)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            {touched && errors && typeof errors === 'string' && (
                <p className="text-xs text-red-500 px-2">{errors}</p>
            )}

            <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <DialogContent hideCloseButton>
                    <DialogHeader>
                        <DialogTitle>Confirm Price Tracking Change</DialogTitle>
                        <DialogDescription>
                            Warning: This project already has Purchase Entries based on the current Price Tracking item(s). Adding a new Price Tracking item may cause incorrect calculations, inconsistencies, or data mismatches in existing Purchase Entries and project reports. Are you sure you want to continue?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setConfirmDialogOpen(false); setPendingTrackingId(null); }}>
                            Cancel
                        </Button>
                        <Button variant="default" onClick={() => {
                            if (pendingTrackingId) {
                                onProgressItemIdsChange?.([pendingTrackingId]);
                            }
                            setConfirmDialogOpen(false);
                            setPendingTrackingId(null);
                        }}>
                            Continue
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default ProjectItemDetails;
