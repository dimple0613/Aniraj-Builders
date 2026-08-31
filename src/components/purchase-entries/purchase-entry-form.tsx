'use client';

import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import axios from 'axios';
import { Loader2, Plus, Trash2, ChevronDown, Check, X, Pencil } from 'lucide-react';
import { toast } from 'sonner';

function formatBrsValue(qty: number): string {
    const brs = qty / 9.29;
    return parseFloat(brs.toFixed(10)).toString();
}

function generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
}

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { InlineSelect } from '@/components/common/InlineSelect';
import { VOUCHER_TYPES, ACCOUNT_TYPES } from '@/lib/constants';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Textarea } from '../ui/textarea';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
} from '@/components/ui/command';
import { Labels } from '../ui/labels';


interface CapitalSORItem {
    id: string;
    item_name: string;
    uom: string;
    currentPrice: string;
    searching_preference?: string;
    gst_master?: string;
    subcontractor_id?: string | null;
}

interface Employee {
    id: string;
    name: string;
}

interface Project {
    id: string;
    name: string;
    unique_name: string;
}

interface ProjectLocation {
    location_id: string;
    location?: { id: string; name: string };
}

interface PurchaseEntry {
    id: string;
    sr_no: number;
    entry_no?: string;
    entry_date: string;
    voucher_type: string;
    account_type: string;
    transaction_type: string;
    project_id: string | null;
    party_id: string;
    instrument_no: string | null;
    received_by?: string | null;
    custom_name?: string | null;
    remark: string | null;
    materials: Array<{
        id: string;
        material_id: string;
        qty: number;
        rate: number;
        total: number;
        subcontractor_ids?: string;
    }>;
    locations: Array<{
        location_id: string;
        location?: { id: string; name: string };
    }>;
}

interface PurchaseEntryFormProps {
    entry?: PurchaseEntry | null;
    defaultProjectId?: string;
    onSuccess: () => void;
    onCancel: () => void;
    onProgress?: (progress: number) => void;
}

interface LineItem {
    id: string;
    capital_sor_id: string | undefined;
    capital_sor_name: string;
    brs: string;
    rate: string;
    gst: string;
    total: string;
    subcontractor_ids: string[];
}

const lineItemValidationSchema = Yup.object({
    capital_sor_id: Yup.string().required('Item is required'),
    brs: Yup.string()
        .required('BRS is required')
        .test('valid-brs', 'BRS must be a positive number', (value) => {
            if (!value) return false;
            const num = parseFloat(value);
            return !isNaN(num) && num > 0;
        }),
    rate: Yup.string()
        .required('Rate is required')
        .test('valid-rate', 'Rate must be a positive number', (value) => {
            if (!value) return false;
            const num = parseFloat(value);
            return !isNaN(num) && num >= 0;
        }),
});

const validationSchema = Yup.object({
    entry_date: Yup.date().required('Entry date is required'),
    voucher_type: Yup.string().oneOf(['PURCHASE_VOUCHER', 'RETURN', 'JOURNAL']).default('PURCHASE_VOUCHER'),
    account_type: Yup.string().oneOf(['DEBIT', 'CREDIT']).required('Account Type is required'),
    transaction_type: Yup.string().oneOf(['LOCAL', 'INTER_STATE']).default('LOCAL'),
    project_id: Yup.string().required('Project is required'),
    party_id: Yup.string().required('Party is required'),
    instrument_no: Yup.string().nullable().optional(),
    location_ids: Yup.array().of(Yup.string()).optional(),
    received_by: Yup.string().nullable().optional(),
    custom_name: Yup.string().nullable().optional(),
    remark: Yup.string().nullable().optional(),
});

type ValidationSchemaType = Yup.InferType<typeof validationSchema>;

interface MemoizedLineItemProps {
    item: LineItem;
    index: number;
    capitalSOROptions: CapitalSORItem[];
    onChange: (index: number, field: keyof LineItem, value: any) => void;
    onRemove: (index: number) => void;
    canRemove: boolean;
    errors?: { capital_sor_id?: string; brs?: string };
    disabled?: boolean;
    otherItemRateSnapshot?: Record<string, number>;
}

const MemoizedLineItem = memo(function MemoizedLineItem({
    item,
    index,
    capitalSOROptions,
    onChange,
    onRemove,
    canRemove,
    errors,
    disabled,
    otherItemRateSnapshot,
}: MemoizedLineItemProps) {
    const [searchOpen, setSearchOpen] = useState(false);

    return (
        <TableRow>
            <TableCell className="min-w-[250px]">
                <Popover open={disabled ? false : searchOpen} onOpenChange={disabled ? undefined : setSearchOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={disabled}
                            className={`w-full justify-between font-normal h-9 text-xs ${errors?.capital_sor_id ? "border-destructive" : ""}`}
                        >
                            <span className="max-w-[200px] truncate">
                                {item.capital_sor_name || 'Select item'}
                            </span>
                            <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[300px] p-0" align="start">
                        <Command>
                            <CommandInput placeholder="Search items..." className="h-8" />
                            <CommandEmpty>No item found.</CommandEmpty>
                            <CommandGroup className="max-h-60 overflow-auto">
                                {capitalSOROptions.map((sor) => (
                                    <CommandItem
                                        key={sor.id}
                                        value={`${sor.item_name?.toLowerCase()} ${sor.searching_preference?.toLowerCase() || ''}`}
                                        onSelect={() => {
                                            onChange(index, 'capital_sor_id', sor.id);
                                            onChange(index, 'capital_sor_name', sor.item_name);
                                            onChange(index, 'subcontractor_ids', []);
                                            const snapshotRate = otherItemRateSnapshot?.[sor.id];
                                            if (snapshotRate !== undefined) {
                                                onChange(index, 'rate', snapshotRate.toString());
                                            } else {
                                                onChange(index, 'rate', sor.currentPrice || '0');
                                            }
                                            onChange(index, 'gst', sor.gst_master || '0');
                                            setSearchOpen(false);
                                        }}
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
            </TableCell>
            <TableCell className="min-w-[100px]">
                <Input
                    type="number"
                    value={item.brs}
                    onChange={(e) => onChange(index, 'brs', e.target.value)}
                    placeholder="0"
                    min="0"
                    step="any"
                    className={`h-9 text-xs text-center ${errors?.brs ? "border-destructive" : ""}`}
                />
                {errors?.brs && (
                    <p className="text-xs text-destructive mt-1">{errors.brs}</p>
                )}
            </TableCell>
            <TableCell className="min-w-[100px]">
                <Input
                    type="number"
                    value={item.rate}
                    onChange={(e) => onChange(index, 'rate', e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className="h-9 text-xs text-right"
                    disabled
                />
            </TableCell>
            <TableCell className="min-w-[100px]">
                <Input
                    type="number"
                    value={item.gst}
                    placeholder="0"
                    min="0"
                    max="100"
                    step="0.01"
                    className="h-9 text-xs text-right"
                    disabled
                />
            </TableCell>
            <TableCell className="min-w-[100px]">
                <Input
                    type="number"
                    value={parseFloat(item.total || '0').toFixed(2)}
                    readOnly
                    className="h-9 text-xs text-right bg-gray-50"
                />
            </TableCell>
            {canRemove && (
                <TableCell className="w-[50px]">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onRemove(index)}
                    >
                        <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                </TableCell>
            )}
        </TableRow>
    );
});

export function PurchaseEntryForm({ entry, defaultProjectId, onSuccess, onCancel, onProgress }: PurchaseEntryFormProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [allPartyOptions, setAllPartyOptions] = useState<Array<{ label: string; value: string }>>([]);
    const [filteredPartyOptions, setFilteredPartyOptions] = useState<Array<{ label: string; value: string }>>([]);
    const [projectOptions, setProjectOptions] = useState<Array<{ label: string; value: string }>>([]);
    const [allCapitalSOROptions, setAllCapitalSOROptions] = useState<CapitalSORItem[]>([]);
    const [otherCapitalSOROptions, setOtherCapitalSOROptions] = useState<CapitalSORItem[]>([]);
    const [projectCapitalSOROptions, setProjectCapitalSOROptions] = useState<CapitalSORItem[]>([]);
    const [projectLocations, setProjectLocations] = useState<Array<{ label: string; value: string }>>([]);
    const [selectedProjectLocations, setSelectedProjectLocations] = useState<string[]>([]);
    const [isLoadingLocations, setIsLoadingLocations] = useState(false);
    const [isLoadingOptions, setIsLoadingOptions] = useState(true);
    const [employees, setEmployees] = useState<Array<{ label: string; value: string }>>([]);
    const [receivedByOther, setReceivedByOther] = useState(false);
    const [subcontractorOptions, setSubcontractorOptions] = useState<Array<{ label: string; value: string }>>([]);
    const [submitAttempted, setSubmitAttempted] = useState(false);
    const projectLocationsMapRef = useRef<Record<string, Array<{ label: string; value: string }>>>({});
    const [projectAssignedQty, setProjectAssignedQty] = useState(0);
    const [projectPurchasedQty, setProjectPurchasedQty] = useState(0);
    const [projectPriceTrackingIds, setProjectPriceTrackingIds] = useState<Set<string>>(new Set());
    const [projectOtherItemIds, setProjectOtherItemIds] = useState<Set<string>>(new Set());
    const otherItemRateSnapshotRef = useRef<Record<string, number>>({});
    const prevPartyIdRef = useRef<string | null>(null);
    const [partySupplierItemMap, setPartySupplierItemMap] = useState<Record<string, number>>({});
    const [partySupplierItemIds, setPartySupplierItemIds] = useState<Set<string>>(new Set());
    const [partyHideProjectItems, setPartyHideProjectItems] = useState(false);
    const [searchOpenOtherIndex, setSearchOpenOtherIndex] = useState<number | null>(null);
    const [subcontractorPopupIndex, setSubcontractorPopupIndex] = useState<number>(-1);
    const [subcontractorPopupValue, setSubcontractorPopupValue] = useState<string>('');
    const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
    const [blockConfirmIndex, setBlockConfirmIndex] = useState<number>(-1);
    const [blockConfirmValue, setBlockConfirmValue] = useState<string>('');

    const formik = useFormik<ValidationSchemaType>({
        initialValues: {
            entry_date: entry?.entry_date ? new Date(entry.entry_date) : new Date(),
            voucher_type: (entry?.voucher_type || 'PURCHASE_VOUCHER') as any,
            account_type: (entry?.account_type || 'DEBIT') as any,
            transaction_type: (entry?.transaction_type || 'LOCAL') as any,
            project_id: entry?.project_id || defaultProjectId || '',
            party_id: entry?.party_id || '',
            instrument_no: entry?.instrument_no || null,
            received_by: entry?.received_by || null,
            custom_name: entry?.custom_name || null,
            location_ids: entry?.locations?.map((l) => l.location_id) || [],
            remark: entry?.remark || null,
        },
        validationSchema,
        onSubmit: async (values) => {
            const activeLineItems = partyHideProjectItems ? [] : lineItems;
            const allItems = [...activeLineItems, ...otherLineItems];
            const hasIncomplete = allItems.some((item) => {
                if (!item.capital_sor_id) return false;
                return !item.brs || parseFloat(item.brs) <= 0 || !item.rate || parseFloat(item.rate) < 0;
            });

            if (hasIncomplete) {
                setSubmitAttempted(true);
                toast.error('Please fill BRS and Rate for all selected items.');
                return;
            }

            const validLineItems = activeLineItems.filter((item) => item.capital_sor_id && item.brs && item.rate);
            const validOtherLineItems = otherLineItems.filter((item) => item.capital_sor_id && item.brs && item.rate);
            const allValidItems = [...validLineItems, ...validOtherLineItems];

            if (allValidItems.length === 0) {
                setSubmitAttempted(true);
                toast.error('At least one item is required');
                return;
            }

            for (const item of allValidItems) {
                const brs = parseFloat(item.brs);
                const qty = brs * 9.29;
                const rate = parseFloat(item.rate);

                if (isNaN(brs) || brs <= 0) {
                    toast.error(`BRS must be positive for ${item.capital_sor_name || 'item'}`);
                    return;
                }

                if (isNaN(rate) || rate < 0) {
                    toast.error(`Rate must be a valid number for ${item.capital_sor_name || 'item'}`);
                    return;
                }
            }

            setIsSubmitting(true);
            try {
                const submitReceivedBy = receivedByOther ? null : values.received_by;
                const submitCustomName = receivedByOther ? values.custom_name : null;
                const submitData: any = {
                    entry_date: new Date(values.entry_date),
                    voucher_type: values.voucher_type,
                    account_type: values.account_type,
                    transaction_type: values.transaction_type,
                    project_id: values.project_id,
                    party_id: values.party_id,
                    instrument_no: values.instrument_no || undefined,
                    received_by: submitReceivedBy,
                    custom_name: submitCustomName,
                    location_ids: selectedProjectLocations.length > 0 ? selectedProjectLocations : undefined,
                    remark: values.remark || undefined,
                    materials: allValidItems.map((item) => {
                        const brs = parseFloat(item.brs);
                        const qty = brs * 9.29;
                        const rate = parseFloat(item.rate);
                        const gst = parseFloat(item.gst) || 0;
                        const subtotal = qty * rate;
                        return {
                            capital_sor_id: item.capital_sor_id,
                            qty,
                            rate,
                            gst_percent: gst,
                            total: subtotal,
                            subcontractor_ids: item.subcontractor_ids,
                        };
                    }),
                };

                if (entry) {
                    const updateResponse = await axios.put(`/api/purchase-entries/${entry.id}`, submitData);
                    toast.success(`Purchase entry updated successfully${updateResponse.data.data?.entry_no ? ` - ${updateResponse.data.data.entry_no}` : ''}`);
                } else {
                    const createResponse = await axios.post('/api/purchase-entries', submitData);
                    toast.success(`Purchase entry created successfully${createResponse.data.data?.entry_no ? ` - ${createResponse.data.data.entry_no}` : ''}`);
                }
                onSuccess();
            } catch (error: any) {
                toast.error(error.response?.data?.message || 'Failed to save purchase entry');
            } finally {
                setIsSubmitting(false);
            }
        },
    });

    const [lineItems, setLineItems] = useState<LineItem[]>(
        entry?.materials?.length && entry.materials.length > 0
            ? entry.materials.map((m) => {
                let parsedSubIds: string[] = [];
                if (m.subcontractor_ids) {
                    try {
                        const parsed = JSON.parse(m.subcontractor_ids);
                        if (Array.isArray(parsed)) parsedSubIds = parsed;
                    } catch { parsedSubIds = []; }
                }
                return {
                    id: m.id || generateId(),
                    capital_sor_id: m.material_id,
                    capital_sor_name: (m as any).capitalSOR?.name || (m as any).capitalSOR?.item_name || 'Unknown Item',
                    brs: formatBrsValue(Number(m.qty)),
                    rate: m.rate.toString(),
                    gst: ((m as any).gst_percent || 0).toString(),
                    total: (Number(m.qty) * Number(m.rate)).toFixed(2),
                    subcontractor_ids: parsedSubIds,
                };
            })
            : [{ id: generateId(), capital_sor_id: undefined as any, capital_sor_name: '', brs: '', rate: '', gst: '0', total: '', subcontractor_ids: [] }]
    );

    const [otherLineItems, setOtherLineItems] = useState<LineItem[]>([]);

    const fetchProjectLocations = useCallback(async (projectId: string) => {
        if (!projectId) {
            setProjectLocations([]);
            setSelectedProjectLocations([]);
            return;
        }

        setIsLoadingLocations(true);
        try {
            const response = await axios.get(`/api/projects/${projectId}`);
            const locations: ProjectLocation[] = response.data?.data?.locations || [];
            const locationOptions = locations.map((loc) => ({
                label: loc.location?.name || 'Unknown',
                value: loc.location_id,
            }));
            setProjectLocations(locationOptions);

            if (locationOptions.length > 0) {
                setSelectedProjectLocations(locationOptions.map((o) => o.value));
            } else {
                setSelectedProjectLocations([]);
            }
        } catch (error) {
            setProjectLocations([]);
            setSelectedProjectLocations([]);
        } finally {
            setIsLoadingLocations(false);
        }
    }, []);

    useEffect(() => {
        const fetchOptions = async () => {
            try {
                setIsLoadingOptions(true);
                const [partiesRes, projectsRes, capitalSORRes, employeesRes, subcontractorsRes] = await Promise.all([
                    axios.get('/api/parties?limit=9999&type=SELLER'),
                    axios.get('/api/projects?limit=9999'),
                    axios.get('/api/item-master?limit=9999'),
                    axios.get('/api/employee-management?limit=9999'),
                    axios.get('/api/subcontractor-management?limit=9999'),
                ]);

                const partiesData = partiesRes.data.data || partiesRes.data;
                const projectsData = projectsRes.data.data || projectsRes.data;
                const capitalSORData = capitalSORRes.data.data || capitalSORRes.data;
                const employeesData = employeesRes.data.data || employeesRes.data;

                const partyList = Array.isArray(partiesData)
                    ? partiesData.map((p: { id: string; name: string }) => ({ label: p.name, value: p.id }))
                    : [];
                setAllPartyOptions(partyList);

                setProjectOptions(
                    Array.isArray(projectsData)
                        ? projectsData.map((p: Project) => ({ label: p.unique_name, value: p.id }))
                        : []
                );

                const map: Record<string, Array<{ label: string; value: string }>> = {};
                if (Array.isArray(projectsData)) {
                    projectsData.forEach((p: any) => {
                        const locs = (p.locations || []).map((loc: any) => ({
                            label: loc.location?.name || 'Unknown',
                            value: loc.location_id,
                        }));
                        if (locs.length > 0) map[p.id] = locs;
                    });
                }
                projectLocationsMapRef.current = map;

                const rawData = Array.isArray(capitalSORData) ? capitalSORData : [];
                const otherItemsFromData = rawData
                    .filter((g: any) => g.sorName === "OTHER ITEM" && g.departmentName === "PURCHASE")
                    .flatMap((g: any) =>
                        (g.items || []).map((item: any) => ({
                            id: item.id,
                            item_name: item.item_name,
                            uom: item.uom || '',
                            currentPrice: item.current_price?.toString() || item.rate?.toString() || '0',
                            searching_preference: item.searching_preference,
                            gst_master: item.gst_master || '',
                            subcontractor_id: item.subcontractor_id || null,
                        }))
                    );
                setOtherCapitalSOROptions(otherItemsFromData);

                setAllCapitalSOROptions(
                    Array.isArray(capitalSORData)
                        ? capitalSORData
                            .filter((g: any) => !(g.sorName === "OTHER ITEM" && g.departmentName === "PURCHASE"))
                            .flatMap((m: any) =>
                            (m.items || []).map((item: any) => ({
                                id: item.id,
                                item_name: item.item_name,
                                uom: item.uom || '',
                                currentPrice: item.current_price?.toString() || item.rate?.toString() || '0',
                                searching_preference: item.searching_preference,
                                gst_master: item.gst_master || '',
                                subcontractor_id: item.subcontractor_id || null,
                            }))
                          )
                        : []
                );

                const employeeList = Array.isArray(employeesData)
                    ? employeesData.map((e: Employee) => ({ label: e.name, value: e.id }))
                    : [];
                setEmployees([...employeeList, { label: 'Other', value: 'OTHER' }]);

                const subcontractorsData = subcontractorsRes.data.data || subcontractorsRes.data;
                setSubcontractorOptions(
                    Array.isArray(subcontractorsData)
                        ? subcontractorsData.map((s: { id: string; name: string }) => ({ label: s.name, value: s.id }))
                        : []
                );
            } catch (error) {
                console.error('Failed to fetch options:', error);
            } finally {
                setIsLoadingOptions(false);
            }
        };
        fetchOptions();
    }, []);

    useEffect(() => {
        const filterSellerParties = () => {
            const sellerParties = allPartyOptions;
            setFilteredPartyOptions(sellerParties);
        };
        filterSellerParties();
    }, [allPartyOptions]);

    useEffect(() => {
        if (entry) {
            formik.resetForm({
                values: {
                    entry_date: entry.entry_date ? new Date(entry.entry_date) : new Date(),
                    voucher_type: (entry.voucher_type || 'PURCHASE_VOUCHER') as any,
                    account_type: (entry.account_type || 'DEBIT') as any,
                    transaction_type: (entry.transaction_type || 'LOCAL') as any,
                    project_id: entry.project_id || '',
                    party_id: entry.party_id || '',
                    instrument_no: entry.instrument_no || null,
                    received_by: entry.received_by || null,
                    custom_name: entry.custom_name || null,
                    location_ids: entry.locations?.map((l) => l.location_id) || [],
                    remark: entry.remark || null,
                },
            });
            setSelectedProjectLocations(entry.locations?.map((l) => l.location_id) || []);
            const matchedEmployee = entry.received_by
                ? employees.find(e => e.value === entry.received_by)
                : null;
            if (matchedEmployee) {
                formik.setFieldValue('received_by', matchedEmployee.value);
                formik.setFieldValue('custom_name', null);
            }
            setReceivedByOther(!matchedEmployee && !!entry.custom_name && entry.custom_name !== '-');
        }
    }, [entry?.id, employees]);

    useEffect(() => {
        if (entry && otherCapitalSOROptions.length > 0) {
            const otherItemIds = new Set(otherCapitalSOROptions.map((oi) => oi.id));
            const allMats = entry.materials || [];
            const otherMats: LineItem[] = [];
            const regularMats: LineItem[] = [];
            allMats.forEach((m: any) => {
                let parsedSubIds: string[] = [];
                if (m.subcontractor_ids) {
                    try {
                        const parsed = JSON.parse(m.subcontractor_ids);
                        if (Array.isArray(parsed)) parsedSubIds = parsed;
                    } catch { parsedSubIds = []; }
                }
                const masterItem = otherCapitalSOROptions.find((o) => o.id === m.material_id) || allCapitalSOROptions.find((o) => o.id === m.material_id);
                const lineItem: LineItem = {
                    id: m.id || generateId(),
                    capital_sor_id: m.material_id,
                    capital_sor_name: (m as any).capitalSOR?.name || (m as any).capitalSOR?.item_name || 'Unknown Item',
                    brs: formatBrsValue(Number(m.qty)),
                    rate: m.rate?.toString() || '0',
                    gst: masterItem?.gst_master || m.gst_percent?.toString() || '0',
                    total: (Number(m.qty) * Number(m.rate)).toFixed(2),
                    subcontractor_ids: parsedSubIds.length > 0 ? parsedSubIds : (masterItem?.subcontractor_id ? [masterItem.subcontractor_id] : []),
                };
                if (otherItemIds.has(m.material_id)) {
                    otherMats.push(lineItem);
                } else {
                    regularMats.push(lineItem);
                }
            });
            setLineItems(regularMats.length > 0 ? regularMats : [{ id: generateId(), capital_sor_id: undefined as any, capital_sor_name: '', brs: '', rate: '', gst: '0', total: '', subcontractor_ids: [] }]);
            setOtherLineItems(otherMats.length > 0 ? otherMats : []);
            const snapshot: Record<string, number> = {};
            otherMats.forEach((m) => {
                if (m.capital_sor_id) {
                    snapshot[m.capital_sor_id] = parseFloat(m.rate) || 0;
                }
            });
            otherItemRateSnapshotRef.current = snapshot;
        }
    }, [entry?.id, otherCapitalSOROptions]);

    useEffect(() => {
        const values = formik.values;
        let filled = 0;
        let total = 0;

        const stringFields = [
            'entry_date', 'voucher_type', 'account_type', 'transaction_type',
            'project_id', 'party_id', 'instrument_no', 'remark',
        ];

        stringFields.forEach(field => {
            total++;
            const val = (values as any)[field];
            if (val && val.toString().trim() !== '') {
                filled++;
            }
        });

        total++;
        const receivedByVal = values.received_by;
        const customNameVal = values.custom_name;
        if ((receivedByVal && receivedByVal.toString().trim() !== '') ||
            (customNameVal && customNameVal.toString().trim() !== '')) {
            filled++;
        }

        const result = total > 0 ? Math.round((filled / total) * 100) : 0;
        onProgress?.(result);
    }, [formik.values, onProgress]);

    useEffect(() => {
        if (formik.values.project_id) {
            const cached = projectLocationsMapRef.current[formik.values.project_id];
            if (cached && cached.length > 0) {
                setProjectLocations(cached);
                setSelectedProjectLocations(cached.map((o) => o.value));
            } else {
                fetchProjectLocations(formik.values.project_id);
            }
            fetchProjectItems(formik.values.project_id);
        } else {
            setProjectLocations([]);
            setSelectedProjectLocations([]);
            setProjectCapitalSOROptions([]);
            setProjectOtherItemIds(new Set());
            if (!entry) {
                setOtherLineItems([]);
            }
        }
    }, [formik.values.project_id, fetchProjectLocations]);

    useEffect(() => {
        const fetchPartySupplierItems = async () => {
            if (!formik.values.party_id) {
                setPartySupplierItemMap({});
                setPartySupplierItemIds(new Set());
                prevPartyIdRef.current = null;
                return;
            }
            try {
                const dateParam = entry?.entry_date ? `&date=${entry.entry_date}` : '';
                const res = await axios.get(`/api/parties/supplier-items?partyId=${formik.values.party_id}${dateParam}`);
                const data = res.data.data || [];
                const map: Record<string, number> = {};
                const ids = new Set<string>();
                data.forEach((item: any) => {
                    const rate = parseFloat(item.rate?.toString() || '0') || 0;
                    if (item.capital_sor_id) {
                        ids.add(item.capital_sor_id);
                        if (rate > 0) {
                            map[item.capital_sor_id] = rate;
                        }
                    }
                });
                setPartySupplierItemMap(map);
                setPartySupplierItemIds(ids);

                const prevPartyId = prevPartyIdRef.current;
                const partyChanged = entry && prevPartyId !== null && prevPartyId !== formik.values.party_id;

                if (!entry || partyChanged) {
                    setOtherLineItems((prev) =>
                        prev.map((item) => {
                            if (!item.capital_sor_id) return item;
                            if (map[item.capital_sor_id] !== undefined) {
                                return { ...item, rate: map[item.capital_sor_id].toString() };
                            }
                            const masterItem = otherCapitalSOROptions.find((o) => o.id === item.capital_sor_id);
                            return { ...item, rate: masterItem?.currentPrice || item.rate };
                        })
                    );

                    const updatedSnapshot = { ...otherItemRateSnapshotRef.current };
                    Object.keys(updatedSnapshot).forEach((itemId) => {
                        if (map[itemId] !== undefined) {
                            updatedSnapshot[itemId] = map[itemId];
                        } else {
                            const masterItem = otherCapitalSOROptions.find((o) => o.id === itemId);
                            if (masterItem) {
                                updatedSnapshot[itemId] = parseFloat(masterItem.currentPrice) || 0;
                            }
                        }
                    });
                    otherItemRateSnapshotRef.current = updatedSnapshot;
                }

                prevPartyIdRef.current = formik.values.party_id;
            } catch {
                setPartySupplierItemMap({});
                setPartySupplierItemIds(new Set());
            }
        };
        fetchPartySupplierItems();
    }, [formik.values.party_id, otherCapitalSOROptions]);

    useEffect(() => {
        const fetchPartyDetails = async () => {
            if (!formik.values.party_id) {
                setPartyHideProjectItems(false);
                return;
            }
            try {
                const res = await axios.get(`/api/parties/${formik.values.party_id}`);
                const partyData = res.data?.data;
                const nowHidden = !!partyData?.hide_project_items;
                setPartyHideProjectItems(nowHidden);

                if (!nowHidden && entry && formik.values.project_id) {
                    const hasRealItems = lineItems.some((item) => item.capital_sor_id);
                    if (!hasRealItems) {
                        fetchProjectItems(formik.values.project_id, true);
                    }
                }
            } catch {
                setPartyHideProjectItems(false);
            }
        };
        fetchPartyDetails();
    }, [formik.values.party_id]);



    const fetchProjectItems = useCallback(async (projectId: string, repopulateLineItems = false) => {
        try {
            const response = await axios.get(`/api/projects/${projectId}`);
            const project = response.data?.data;
            
            if (project?.items && Array.isArray(project.items)) {
                const priceTrackingItems = project.items.filter((item: any) => item.is_price_tracking === true);
                const priceTrackingIds = new Set(priceTrackingItems.map((item: any) => item.capital_sor_id));
                
                setProjectPriceTrackingIds(priceTrackingIds);
                setProjectAssignedQty(project.progress?.totalQty || 0);
                setProjectPurchasedQty(project.progress?.purchasedQty || 0);

                const otherIds = new Set<string>();
                project.items.forEach((item: any) => {
                    if (item.capitalSOR?.other_item_ids) {
                        item.capitalSOR.other_item_ids.split(',').filter(Boolean).forEach((id: string) => otherIds.add(id));
                    }
                });
                setProjectOtherItemIds(otherIds);

                if (!entry || repopulateLineItems) {
                    setOtherLineItems([]);
                }

                const filteredOptions = allCapitalSOROptions.filter(opt => priceTrackingIds.has(opt.id));
                setProjectCapitalSOROptions(filteredOptions);

                if ((!entry || repopulateLineItems) && priceTrackingItems.length > 0) {
                    const autoItems: LineItem[] = priceTrackingItems.map((item: any) => {
                        const sorItem = allCapitalSOROptions.find(opt => opt.id === item.capital_sor_id);
                        return {
                            id: generateId(),
                            capital_sor_id: item.capital_sor_id,
                            capital_sor_name: sorItem?.item_name || 'Unknown Item',
                            brs: '',
                            rate: sorItem?.currentPrice || '0',
                            gst: sorItem?.gst_master || '0',
                            total: '',
                            subcontractor_ids: sorItem?.subcontractor_id ? [sorItem.subcontractor_id] : [],
                        };
                    });
                    setLineItems(autoItems);
                }
            } else {
                setProjectCapitalSOROptions([]);
                setProjectPriceTrackingIds(new Set());
                setProjectOtherItemIds(new Set());
                setProjectAssignedQty(0);
                setProjectPurchasedQty(0);
                if (!entry || repopulateLineItems) {
                    setLineItems([{ id: generateId(), capital_sor_id: undefined as any, capital_sor_name: '', brs: '', rate: '', gst: '0', total: '', subcontractor_ids: [] }]);
                    setOtherLineItems([]);
                }
            }
        } catch (error) {
            console.error('Failed to fetch project items:', error);
            setProjectCapitalSOROptions([]);
            setProjectOtherItemIds(new Set());
        }
    }, [allCapitalSOROptions, entry]);

    useEffect(() => {
        if (formik.values.project_id && allCapitalSOROptions.length > 0) {
            fetchProjectItems(formik.values.project_id);
        }
    }, [allCapitalSOROptions, formik.values.project_id, fetchProjectItems]);

    const prevPartyHideProjectItemsRef = useRef(partyHideProjectItems);
    useEffect(() => {
        const wasHidden = prevPartyHideProjectItemsRef.current;
        prevPartyHideProjectItemsRef.current = partyHideProjectItems;
        if (wasHidden && !partyHideProjectItems && formik.values.project_id) {
            fetchProjectItems(formik.values.project_id, true);
        }
    }, [partyHideProjectItems, formik.values.project_id, fetchProjectItems]);

    const handleLineItemChange = useCallback(
        (index: number, field: keyof LineItem, value: any) => {
            setLineItems((prev) => {
                const newLineItems = [...prev];
                (newLineItems[index] as any)[field] = value;

                if (field === 'brs' || field === 'rate' || field === 'gst') {
                    const brs = parseFloat(newLineItems[index].brs) || 0;
                    const qty = brs * 9.29;
                    const rate = parseFloat(newLineItems[index].rate) || 0;
                    const subtotal = qty * rate;
                    newLineItems[index].total = subtotal.toString();
                }

                return newLineItems;
            });
        },
        []
    );

    const addLineItem = () => {
        setLineItems((prev) => [
            ...prev,
            {
                id: generateId(),
                capital_sor_id: undefined as any,
                capital_sor_name: '',
                brs: '',
                rate: '',
                gst: '0',
                total: '',
                subcontractor_ids: [],
            },
        ]);
    };

    const removeLineItem = (index: number) => {
        if (lineItems.length > 1) {
            setLineItems((prev) => prev.filter((_, i) => i !== index));
        }
    };

    const handleOtherLineItemChange = useCallback(
        (index: number, field: keyof LineItem, value: any) => {
            setOtherLineItems((prev) => {
                const newItems = [...prev];
                (newItems[index] as any)[field] = value;

                if (field === 'brs' || field === 'rate' || field === 'gst') {
                    const brs = parseFloat(newItems[index].brs) || 0;
                    const qty = brs * 9.29;
                    const rate = parseFloat(newItems[index].rate) || 0;
                    const subtotal = qty * rate;
                    newItems[index].total = subtotal.toString();
                }

                return newItems;
            });
        },
        []
    );

    const addOtherLineItem = () => {
        setOtherLineItems((prev) => [
            ...prev,
            {
                id: generateId(),
                capital_sor_id: undefined as any,
                capital_sor_name: '',
                brs: '',
                rate: '',
                gst: '0',
                total: '',
                subcontractor_ids: [],
            },
        ]);
    };

    const removeOtherLineItem = (index: number) => {
        setOtherLineItems((prev) => prev.filter((_, i) => i !== index));
    };

    const calculateTotal = useCallback(() => {
        const projectTotal = lineItems.reduce((sum, item) => {
            const brs = parseFloat(item.brs) || 0;
            const qty = brs * 9.29;
            const rate = parseFloat(item.rate) || 0;
            const subtotal = qty * rate;
            return sum + subtotal;
        }, 0);
        const otherTotal = otherLineItems.reduce((sum, item) => {
            const brs = parseFloat(item.brs) || 0;
            const qty = brs * 9.29;
            const rate = parseFloat(item.rate) || 0;
            const subtotal = qty * rate;
            return sum + subtotal;
        }, 0);
        return projectTotal + otherTotal;
    }, [lineItems, otherLineItems]);

    const selectedPartyName = useMemo(() => {
        const party = filteredPartyOptions.find((p) => p.value === formik.values.party_id);
        return party?.label || '';
    }, [filteredPartyOptions, formik.values.party_id]);

    const quantitySummary = useMemo(() => {
        if (projectPriceTrackingIds.size === 0) {
            return { purchased: 0, assigned: 0, isOver: false };
        }
        const formQty = lineItems.reduce((sum, item) => {
            if (item.capital_sor_id && projectPriceTrackingIds.has(item.capital_sor_id)) {
                const brs = parseFloat(item.brs) || 0;
                return sum + brs * 9.29;
            }
            return sum;
        }, 0);
        const savedEntryQty = entry?.materials?.reduce((sum, m) => {
            if (m.material_id && projectPriceTrackingIds.has(m.material_id)) {
                return sum + Number(m.qty);
            }
            return sum;
        }, 0) || 0;
        const purchased = projectPurchasedQty - savedEntryQty + formQty;
        return {
            purchased,
            assigned: projectAssignedQty,
            isOver: purchased > projectAssignedQty && projectAssignedQty > 0,
        };
    }, [lineItems, projectPriceTrackingIds, projectPurchasedQty, projectAssignedQty, entry]);

    const availableOtherOptions = useMemo(() => {
        if (partySupplierItemIds.size === 0) {
            return [];
        }
        const selectedIds = new Set(
            otherLineItems.map((item) => item.capital_sor_id).filter(Boolean)
        );
        return otherCapitalSOROptions
            .filter((opt) => partySupplierItemIds.has(opt.id) && !selectedIds.has(opt.id))
            .map((opt) => ({
                ...opt,
                currentPrice: partySupplierItemMap[opt.id] !== undefined
                    ? partySupplierItemMap[opt.id].toString()
                    : opt.currentPrice,
            }));
    }, [otherCapitalSOROptions, partySupplierItemIds, otherLineItems, partySupplierItemMap]);

    const formatDateCode = (date: Date): string => {
        const day = date.getDate().toString().padStart(2, '0');
        const months = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const month = months[date.getMonth()];
        const year = date.getFullYear().toString().slice(-2);
        return `${day}${month}${year}`;
    };

    const getShortPartyName = (name: string): string => {
        const cleaned = name.replace(/[^a-zA-Z\s]/g, '').trim().toUpperCase();
        const words = cleaned.split(/\s+/);
        if (words.length === 1) {
            return words[0].substring(0, 4);
        }
        return words
            .slice(0, 2)
            .map((w) => w[0])
            .join('');
    };

    const generatedEntryNo = useMemo(() => {
        if (!selectedPartyName || !formik.values.entry_date) return '';
        const shortName = getShortPartyName(selectedPartyName);
        const dateCode = formatDateCode(new Date(formik.values.entry_date));
        return `${shortName}/${dateCode}/`;
    }, [selectedPartyName, formik.values.entry_date]);

    const total = calculateTotal();

    const formatDateForInput = (date: Date): string => {
        const d = new Date(date);
        return d.toISOString().split('T')[0];
    };

    const handleReceivedByChange = (value: string | string[]) => {
        const val = Array.isArray(value) ? value[0] : value;
        if (val === 'OTHER') {
            setReceivedByOther(true);
            formik.setFieldValue('custom_name', '');
        } else {
            setReceivedByOther(false);
            formik.setFieldValue('received_by', val || null);
            formik.setFieldValue('custom_name', null);
        }
    };

    const getLineItemErrors = useCallback(
        (item: LineItem): { capital_sor_id?: string; brs?: string } => {
            if (!submitAttempted || partyHideProjectItems) return {};
            const errors: { capital_sor_id?: string; brs?: string } = {};
            if (!item.capital_sor_id) {
                errors.capital_sor_id = 'Please select an item.';
            } else {
                if (!item.brs) {
                    errors.brs = 'BRS is required.';
                } else if (parseFloat(item.brs) <= 0) {
                    errors.brs = 'BRS must be greater than 0.';
                }
            }
            return errors;
        },
        [submitAttempted, partyHideProjectItems],
    );

    return (
        <form
            onSubmit={formik.handleSubmit}
            className="space-y-6 max-h-[75vh] overflow-y-auto pr-2"
        >
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2 relative">
                    <Label htmlFor="entry_date">
                        Entry Date <span className="text-destructive">*</span>
                    </Label>
                    <Input
                        id="entry_date"
                        type="date"
                        name="entry_date"
                        value={formatDateForInput(formik.values.entry_date)}
                        onChange={(e) => {
                            formik.setFieldValue('entry_date', new Date(e.target.value));
                        }}
                        onBlur={formik.handleBlur}
                        className={formik.touched.entry_date && formik.errors.entry_date ? 'border-destructive' : ''}
                    />
                    {formik.touched.entry_date && formik.errors.entry_date && (
                        <p className="text-sm text-destructive">{String(formik.errors.entry_date)}</p>
                    )}
                </div>

                <div className="space-y-2 relative">
                    <Label htmlFor="voucher_type">Voucher Type</Label>
                    <InlineSelect
                        value={formik.values.voucher_type}
                        onChange={(value) => formik.setFieldValue('voucher_type', value as string)}
                        placeholder="Select type"
                        options={VOUCHER_TYPES}
                    />
                    {formik.errors.voucher_type && (
                        <p className="text-sm text-destructive">{String(formik.errors.voucher_type)}</p>
                    )}
                </div>

                <div className="space-y-2 relative">
                    <Label htmlFor="account_type">Account Type <span className="text-destructive">*</span></Label>
                    <InlineSelect
                        value={formik.values.account_type}
                        onChange={(value) => formik.setFieldValue('account_type', value as string)}
                        placeholder="Select type"
                        options={ACCOUNT_TYPES}
                    />
                    {formik.errors.account_type && (
                        <p className="text-sm text-destructive">{String(formik.errors.account_type)}</p>
                    )}
                </div>

                <div className="space-y-2 relative">
                    <Label htmlFor="transaction_type">Transaction Type</Label>
                    <InlineSelect
                        value={formik.values.transaction_type}
                        onChange={(value) => formik.setFieldValue('transaction_type', value as string)}
                        placeholder="Select type"
                        options={[{ label: 'Local', value: 'LOCAL' }]}
                    />
                    {formik.errors.transaction_type && (
                        <p className="text-sm text-destructive">{String(formik.errors.transaction_type)}</p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-2 relative">
                    <Label className='flex flex-wrap leading-unset' htmlFor="project_id">
                        Select Project <span className="text-destructive">*</span>
                    </Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full justify-between font-normal h-9 text-xs"
                            >
                                <span className="max-w-[200px] truncate">
                                    {projectOptions.find(o => o.value === formik.values.project_id)?.label || 'Select project'}
                                </span>
                                <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[300px] p-0" align="start">
                            <Command>
                                <CommandInput placeholder="Search projects..." className="h-8" />
                                <CommandEmpty>No project found.</CommandEmpty>
                                <CommandGroup className="max-h-60 overflow-auto">
                                    {projectOptions.map((option) => (
                                        <CommandItem
                                            key={option.value}
                                            value={option.label}
                                            onSelect={() => {
                                                formik.setFieldValue('project_id', option.value);
                                            }}
                                            className="cursor-pointer text-xs"
                                        >
                                            <Check
                                                className={`mr-2 h-3 w-3 ${formik.values.project_id === option.value ? 'opacity-100' : 'opacity-0'}`}
                                            />
                                            <span className="truncate">{option.label}</span>
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            </Command>
                        </PopoverContent>
                    </Popover>
                    {formik.touched.project_id && formik.errors.project_id && (
                        <p className="text-sm text-destructive">{String(formik.errors.project_id)}</p>
                    )}
                </div>
                <div className="space-y-2 relative">

                    <Label className='flex flex-wrap leading-unset'>Location  {isLoadingLocations && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Loader2 className="h-3 w-3 animate-spin" /> Loading locations...
                        </span>
                    )}</Label>

                    {!formik.values.project_id ? (
                        <div className="flex flex-wrap gap-2">
                            <p className="text-sm text-muted-foreground py-2">Select a project to see available locations</p>
                        </div>
                    ) : projectLocations.length > 0 ? (
                        <div className="space-y-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full justify-between font-normal h-9 text-xs"
                                    >
                                        <span className="truncate">
                                            {selectedProjectLocations.length > 0
                                                ? selectedProjectLocations
                                                    .map(id => projectLocations.find(o => o.value === id)?.label || id)
                                                    .join(', ')
                                                : 'Select locations'}
                                        </span>
                                        <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Search locations..." className="h-8" />
                                        <CommandEmpty>No location found.</CommandEmpty>
                                        <CommandGroup className="max-h-60 overflow-auto">
                                            {projectLocations.map((option) => (
                                                <CommandItem
                                                    key={option.value}
                                                    value={option.label}
                                                    onSelect={() => {
                                                        setSelectedProjectLocations(prev =>
                                                            prev.includes(option.value)
                                                                ? prev.filter(v => v !== option.value)
                                                                : [...prev, option.value]
                                                        );
                                                    }}
                                                    className="cursor-pointer text-xs"
                                                >
                                                    <Check
                                                        className={`mr-2 h-3 w-3 ${selectedProjectLocations.includes(option.value) ? 'opacity-100' : 'opacity-0'}`}
                                                    />
                                                    <span className="truncate">{option.label}</span>
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                            {selectedProjectLocations.length > 0 && (
                                <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                                    {selectedProjectLocations.map((val) => {
                                        const option = projectLocations.find(o => o.value === val);
                                        return (
                                            <span key={val} className="inline-flex items-center bg-primary/20 text-primary rounded px-1.5 py-0.5 text-xs">
                                                {option?.label || val}
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedProjectLocations(prev => prev.filter(v => v !== val));
                                                    }}
                                                    className="ml-1 h-3 w-3 text-destructive hover:bg-destructive/20 rounded flex items-center justify-center"
                                                >
                                                    <X className="h-2 w-2" />
                                                </button>
                                            </span>
                                        );
                                    })}
                                </div>
                            )}
                        </div>

                    ) : (
                        !isLoadingLocations && (
                            <p className="text-sm text-muted-foreground">No locations available for this project</p>
                        )
                    )}
                </div>

                <div className="space-y-2 relative">
                    <Label className='flex flex-wrap leading-unset' htmlFor="party_id">
                        Party Name <span className="text-destructive">*</span>
                    </Label>
                    <InlineSelect
                        value={formik.values.party_id}
                        onChange={(value) => formik.setFieldValue('party_id', value as string)}
                        placeholder="Select party"
                        options={filteredPartyOptions}
                    />
                    {formik.touched.party_id && formik.errors.party_id && (
                        <p className="text-sm text-destructive">{String(formik.errors.party_id)}</p>
                    )}
                </div>

                <div className="space-y-2 relative">
                    <Label className='flex flex-wrap leading-unset' htmlFor="instrument_no">Instrument No</Label>
                    <Input
                        id="instrument_no"
                        name="instrument_no"
                        value={formik.values.instrument_no || ''}
                        onChange={formik.handleChange}
                        placeholder="Enter instrument no"
                    />
                    {formik.touched.instrument_no && formik.errors.instrument_no && (
                        <p className="text-sm text-destructive">{String(formik.errors.instrument_no)}</p>
                    )}
                </div>
            </div>

            {!partyHideProjectItems && (
            <div className="space-y-2 relative">
                <div className="flex justify-between items-start">
                    <Labels>
                        Project Item Details <span className="text-destructive">*</span>
                    </Labels>
                    {formik.values.project_id && projectPriceTrackingIds.size > 0 && (
                        <div className={`text-sm font-medium mt-1 ${quantitySummary.isOver ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                            {quantitySummary.purchased.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / {quantitySummary.assigned.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Qty
                        </div>
                    )}
                </div>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-[250px]">Item (Item Master)</TableHead>
                                <TableHead className="min-w-[100px] text-center">BRS</TableHead>
                                <TableHead className="min-w-[100px] text-right">Rate (₹)</TableHead>
                                <TableHead className="min-w-[100px] text-right">GST (%)</TableHead>
                                <TableHead className="min-w-[100px] text-right">Total (₹)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {lineItems.map((item, index) => (
                                <MemoizedLineItem
                                    key={item.id}
                                    item={item}
                                    index={index}
                                    capitalSOROptions={formik.values.project_id ? projectCapitalSOROptions : []}
                                    onChange={handleLineItemChange}
                                    onRemove={removeLineItem}
                                    canRemove={false}
                                    errors={getLineItemErrors(item)}
                                    disabled={!!formik.values.project_id}
                                    otherItemRateSnapshot={otherItemRateSnapshotRef.current}
                                />
                            ))}
                        </TableBody>
                    </Table>
                    {!entry && !formik.values.project_id && (
                        <div className="p-3">
                            <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                                <Plus className="h-4 w-4 mr-2" />
                                Add Line Item
                            </Button>
                        </div>
                    )}
                </div>
                {submitAttempted &&
                    (partyHideProjectItems || lineItems.every(i => !i.capital_sor_id && !i.brs && !i.rate)) &&
                    otherLineItems.every(i => !i.capital_sor_id && !i.brs && !i.rate) && (
                        <p className="text-sm text-destructive mt-2">Please add at least one item.</p>
                    )}
            </div>
            )}

            <div className="space-y-2 relative">
                <div className="flex justify-between items-start">
                    <Labels>
                        Other Item Details
                    </Labels>
                </div>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-[250px]">Item (Other Items)</TableHead>
                                <TableHead className="min-w-[100px] text-center">BRS</TableHead>
                                <TableHead className="min-w-[100px] text-right">Rate (₹)</TableHead>
                                <TableHead className="min-w-[100px] text-right">GST (%)</TableHead>
                                <TableHead className="min-w-[100px] text-right">Total (₹)</TableHead>
                                <TableHead className="min-w-[120px]">Subcontractor</TableHead>
                                <TableHead className="w-[50px]"></TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {otherLineItems.map((item, index) => {
                                const isBlockItem = item.capital_sor_name?.toLowerCase().includes('block');
                                const subNames = (item.subcontractor_ids || [])
                                    .map((sid) => subcontractorOptions.find((s) => s.value === sid)?.label)
                                    .filter(Boolean);
                                const subDisplay = subNames.length > 0 ? subNames.join(', ') : '-';
                                return (
                                    <TableRow key={item.id}>
                                        <TableCell className="min-w-[250px]">
                                            <Popover open={subcontractorPopupIndex === -1 && searchOpenOtherIndex === index ? true : undefined} onOpenChange={(open) => setSearchOpenOtherIndex(open ? index : null)}>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full justify-between font-normal h-9 text-xs"
                                                    >
                                                        <span className="max-w-[200px] truncate">
                                                            {item.capital_sor_name || 'Select item'}
                                                        </span>
                                                        <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-[300px] p-0" align="start">
                                                    <Command>
                                                        <CommandInput placeholder="Search items..." className="h-8" />
                                                        <CommandEmpty>No item found.</CommandEmpty>
                                                        <CommandGroup className="max-h-60 overflow-auto">
                                                            {availableOtherOptions.map((sor) => (
                                                                <CommandItem
                                                                    key={sor.id}
                                                                    value={`${sor.item_name?.toLowerCase()} ${sor.searching_preference?.toLowerCase() || ''}`}
                                                                    onSelect={() => {
                                                                        handleOtherLineItemChange(index, 'capital_sor_id', sor.id);
                                                                        handleOtherLineItemChange(index, 'capital_sor_name', sor.item_name);
                                                                        handleOtherLineItemChange(index, 'subcontractor_ids', sor.subcontractor_id ? [sor.subcontractor_id] : []);
                                                                        const snapshotRate = otherItemRateSnapshotRef.current?.[sor.id];
                                                                        if (snapshotRate !== undefined) {
                                                                            handleOtherLineItemChange(index, 'rate', snapshotRate.toString());
                                                                        } else {
                                                                            handleOtherLineItemChange(index, 'rate', sor.currentPrice || '0');
                                                                        }
                                                                        handleOtherLineItemChange(index, 'gst', sor.gst_master || '0');
                                                                        setSearchOpenOtherIndex(null);
                                                                        if (sor.item_name?.toLowerCase().includes('block')) {
                                                                            setTimeout(() => {
                                                                                setBlockConfirmIndex(index);
                                                                                setBlockConfirmValue(sor.subcontractor_id || '');
                                                                                setBlockConfirmOpen(true);
                                                                            }, 0);
                                                                        }
                                                                    }}
                                                                    className="cursor-pointer text-xs"
                                                                >
                                                                    <Check className={`mr-2 h-3 w-3 ${item.capital_sor_id === sor.id ? 'opacity-100' : 'opacity-0'}`} />
                                                                    <span className="truncate">{sor.item_name}</span>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </Command>
                                                </PopoverContent>
                                            </Popover>
                                        </TableCell>
                                        <TableCell className="min-w-[100px]">
                                            <Input
                                                type="number"
                                                value={item.brs}
                                                onChange={(e) => handleOtherLineItemChange(index, 'brs', e.target.value)}
                                                placeholder="0"
                                                min="0"
                                                step="any"
                                                className="h-9 text-xs text-center"
                                            />
                                        </TableCell>
                                        <TableCell className="min-w-[100px]">
                                            <Input
                                                type="number"
                                                value={item.rate}
                                                readOnly
                                                placeholder="0.00"
                                                className="h-9 text-xs text-right"
                                            />
                                        </TableCell>
                                        <TableCell className="min-w-[100px]">
                                            <Input
                                                type="number"
                                                value={item.gst}
                                                placeholder="0"
                                                readOnly
                                                className="h-9 text-xs text-right"
                                            />
                                        </TableCell>
                                        <TableCell className="min-w-[100px]">
                                            <Input
                                                type="number"
                                                value={parseFloat(item.total || '0').toFixed(2)}
                                                readOnly
                                                className="h-9 text-xs text-right bg-gray-50"
                                            />
                                        </TableCell>
                                        <TableCell className="min-w-[120px]">
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs truncate max-w-[90px]" title={subDisplay}>{subDisplay}</span>
                                                {isBlockItem && (
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 shrink-0"
                                                        title="Change subcontractor"
                                                        onClick={() => {
                                                            setBlockConfirmIndex(index);
                                                            setBlockConfirmValue(item.subcontractor_ids?.[0] || '');
                                                            setBlockConfirmOpen(true);
                                                        }}
                                                    >
                                                        <Pencil className="h-3 w-3" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="w-[50px]">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => removeOtherLineItem(index)}
                                            >
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    <div className="p-3">
                        <Button type="button" variant="outline" size="sm" onClick={addOtherLineItem} disabled={availableOtherOptions.length === 0}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Line Item
                        </Button>
                    </div>
                </div>
            </div>

            <Dialog open={blockConfirmOpen} onOpenChange={(open) => { if (!open) setBlockConfirmOpen(false); }}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle>Change Subcontractor</DialogTitle>
                        <DialogDescription>
                            Do you want to change the subcontractor?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setBlockConfirmOpen(false)}>No</Button>
                        <Button onClick={() => {
                            setBlockConfirmOpen(false);
                            setSubcontractorPopupIndex(blockConfirmIndex);
                            setSubcontractorPopupValue(blockConfirmValue);
                        }}>Yes</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={subcontractorPopupIndex >= 0} onOpenChange={(open) => { if (!open) setSubcontractorPopupIndex(-1); }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Change Subcontractor</DialogTitle>
                        <DialogDescription>
                            Do you want to change the subcontractor?
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <InlineSelect
                            value={subcontractorPopupValue}
                            onChange={(val) => setSubcontractorPopupValue(val as string)}
                            placeholder="Select subcontractor"
                            options={subcontractorOptions}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSubcontractorPopupIndex(-1)}>Cancel</Button>
                        <Button onClick={() => {
                            if (subcontractorPopupIndex >= 0) {
                                handleOtherLineItemChange(subcontractorPopupIndex, 'subcontractor_ids', subcontractorPopupValue ? [subcontractorPopupValue] : []);
                            }
                            setSubcontractorPopupIndex(-1);
                        }}>Update</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                    <Label htmlFor="remark">Remark</Label>
                    <Textarea
                        id="remark"
                        name="remark"
                        value={formik.values.remark || ''}
                        onChange={formik.handleChange}
                        placeholder="Enter remark"
                    />
                    {formik.touched.remark && formik.errors.remark && (
                        <p className="text-sm text-destructive">{String(formik.errors.remark)}</p>
                    )}
                </div>
                <div className="space-y-2 relative">
                    <Label className='flex flex-wrap leading-unset' htmlFor="received_by">Received By <span className="text-destructive">*</span></Label>
                    {!receivedByOther ? (
                        <InlineSelect
                            value={formik.values.received_by || ''}
                            onChange={handleReceivedByChange}
                            placeholder="Select receiver"
                            options={employees}
                        />
                    ) : (
                        <div className="space-y-2">
                            <Input
                                id="custom_name"
                                name="custom_name"
                                value={formik.values.custom_name || ''}
                                onChange={formik.handleChange}
                                placeholder="Enter receiver name"
                                className="h-10"
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setReceivedByOther(false);
                                    formik.setFieldValue('received_by', '');
                                    formik.setFieldValue('custom_name', '');
                                }}
                                className="text-xs h-7"
                            >
                                Back to dropdown
                            </Button>
                        </div>
                    )}
                    {formik.touched.received_by && formik.errors.received_by && (
                        <p className="text-sm text-destructive">{String(formik.errors.received_by)}</p>
                    )}
                </div>
            </div>

            <div className="border rounded-lg p-4 bg-gray-50">
                <div className="flex justify-between text-lg font-bold">
                    <span>Final Total:</span>
                    <span>₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
                    Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || isLoadingOptions}>
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {entry ? 'Update Purchase Entry' : 'Create Purchase Entry'}
                </Button>
            </div>
        </form>
    );
}
