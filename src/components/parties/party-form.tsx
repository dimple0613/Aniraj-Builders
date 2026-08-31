'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import axios from 'axios';
import { Loader2, Plus, Trash2, ChevronDown, IndianRupee } from 'lucide-react';
import { toast } from 'sonner';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { InlineSelect } from '@/components/common/InlineSelect';
import { PARTY_TYPES } from '@/lib/constants';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Labels } from '@/components/ui/labels';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandInput, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Check } from 'lucide-react';

interface Account {
    id: string;
    type: string;
    account_name?: string;
    cash_name?: string;
    account_number?: string;
    bank_name?: string;
    ifsc_code?: string;
}

interface Party {
    id: string;
    name: string;
    address: string | null;
    mobile_no: string | null;
    email: string | null;
    gst_no: string | null;
    type: string;
    hide_project_items?: boolean;
    bankAccounts?: Array<{ id: string; account_no: string; bank_name: string | null }>;
    bank_account_name?: string | null;
    bank_account_number?: string | null;
    bank_name?: string | null;
    bank_ifsc_code?: string | null;
    bank_opening_balance?: number;
    account?: Account;
}

interface SupplierItem {
    id?: string;
    capital_sor_id: string;
    item_name: string;
    uom: string;
    globalRate: number;
    rate: number;
    gst: string;
}

interface CapitalSORItem {
    id: string;
    item_name: string;
    uom: string;
    current_price?: number;
    rate?: number;
    gst_master?: string;
}

interface PartyFormProps {
    party?: Party | null;
    onSuccess: () => void;
    onCancel: () => void;
    onProgress?: (progress: number) => void;
}

export function PartyForm({ party, onSuccess, onCancel, onProgress }: PartyFormProps) {
    const [supplierItems, setSupplierItems] = useState<SupplierItem[]>([]);
    const [itemOptions, setItemOptions] = useState<CapitalSORItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [itemSearchOpenIndex, setItemSearchOpenIndex] = useState<number | null>(null);
    const [rateDialogOpen, setRateDialogOpen] = useState(false);
    const [rateDialogItem, setRateDialogItem] = useState<SupplierItem | null>(null);
    const [rateDialogIndex, setRateDialogIndex] = useState<number>(-1);
    const [newRate, setNewRate] = useState('');
    const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
    const [rateHistory, setRateHistory] = useState<any[]>([]);
    const [rateHistoryLoading, setRateHistoryLoading] = useState(false);
    const [savingRate, setSavingRate] = useState(false);
    const [submitAttempted, setSubmitAttempted] = useState(false);

    const fetchSupplierItems = useCallback(async () => {
        if (!party?.id) return;
        try {
            const res = await axios.get(`/api/parties/supplier-items?partyId=${party.id}`);
            const data = res.data.data || [];
            setSupplierItems(data.map((item: any) => ({
                id: item.id,
                capital_sor_id: item.capital_sor_id,
                item_name: item.capitalSor?.item_name || '',
                uom: item.capitalSor?.uom || '',
                globalRate: parseFloat(item.capitalSor?.rate?.toString() || '0') || 0,
                rate: parseFloat(item.rate?.toString() || '0') || 0,
                gst: item.capitalSor?.gst_master || '0',
            })));
        } catch {
            toast.error('Failed to load supplier items');
        }
    }, [party?.id]);

    const fetchItemOptions = useCallback(async () => {
        setLoadingItems(true);
        try {
            const res = await axios.get('/api/item-master?limit=9999');
            const data = Array.isArray(res.data.data) ? res.data.data : [];
            const items: CapitalSORItem[] = [];
            data.filter((group: any) => group.sorName === "OTHER ITEM" && group.departmentName === "PURCHASE")
                .forEach((group: any) => {
                (group.items || []).forEach((item: any) => {
                    const rateStr = item.current_price?.toString() || item.rate?.toString() || '0';
                    items.push({
                        id: item.id,
                        item_name: item.item_name,
                        uom: item.uom || '',
                        current_price: parseFloat(rateStr) || 0,
                        rate: parseFloat(item.rate?.toString() || '0') || 0,
                        gst_master: item.gst_master || '',
                    });
                });
            });
            setItemOptions(items);
        } catch {
            toast.error('Failed to load items');
        } finally {
            setLoadingItems(false);
        }
    }, []);

    useEffect(() => {
        fetchItemOptions();
        if (party?.id) {
            fetchSupplierItems();
        }
    }, [party?.id, fetchItemOptions, fetchSupplierItems]);

    const handleAddSupplierItem = async (itemId: string, rowIndex?: number) => {
        const item = itemOptions.find(i => i.id === itemId);
        if (!item) return;
        const rateVal = item.current_price || item.rate || 0;

        if (rowIndex !== undefined) {
            const duplicate = supplierItems.some((si, i) => i !== rowIndex && si.capital_sor_id === itemId);
            if (duplicate) {
                toast.error('This item already exists in Supplier Item Details');
                setItemSearchOpenIndex(null);
                return;
            }

            if (party?.id && supplierItems[rowIndex]?.id) {
                try {
                    await axios.put('/api/parties/supplier-items', {
                        id: supplierItems[rowIndex].id,
                        rate: rateVal,
                    });
                } catch {
                    toast.error('Failed to update item');
                    setItemSearchOpenIndex(null);
                    return;
                }
                setSupplierItems(prev => prev.map((si, i) =>
                    i === rowIndex
                        ? { ...si, capital_sor_id: itemId, item_name: item.item_name, uom: item.uom, globalRate: rateVal, rate: rateVal, gst: item.gst_master || '0' }
                        : si
                ));
            } else if (party?.id) {
                try {
                    const res = await axios.post('/api/parties/supplier-items', {
                        party_id: party.id,
                        capital_sor_id: itemId,
                        rate: rateVal,
                    });
                    const created = res.data.data;
                    setSupplierItems(prev => prev.map((si, i) =>
                        i === rowIndex
                            ? { ...si, id: created.id, capital_sor_id: itemId, item_name: item.item_name, uom: item.uom, globalRate: rateVal, rate: Number(created.rate) || rateVal, gst: item.gst_master || '0' }
                            : si
                    ));
                    toast.success('Item added');
                } catch (err: any) {
                    toast.error(err.response?.data?.message || 'Failed to add item');
                }
            } else {
                setSupplierItems(prev => prev.map((si, i) =>
                    i === rowIndex
                        ? { ...si, capital_sor_id: itemId, item_name: item.item_name, uom: item.uom, globalRate: rateVal, rate: rateVal, gst: item.gst_master || '0' }
                        : si
                ));
            }
            setItemSearchOpenIndex(null);
            return;
        }

        const duplicate = supplierItems.some((si) => si.capital_sor_id === itemId);
        if (duplicate) {
            toast.error('This item already exists in Supplier Item Details');
            setItemSearchOpenIndex(null);
            return;
        }

        if (!party?.id) {
            setSupplierItems(prev => [...prev, {
                capital_sor_id: itemId,
                item_name: item.item_name,
                uom: item.uom,
                globalRate: rateVal,
                rate: rateVal,
                gst: item.gst_master || '0',
            }]);
            setItemSearchOpenIndex(null);
            return;
        }
        try {
            const res = await axios.post('/api/parties/supplier-items', {
                party_id: party.id,
                capital_sor_id: itemId,
                rate: rateVal,
            });
            const created = res.data.data;
            setSupplierItems(prev => [...prev, {
                id: created.id,
                capital_sor_id: itemId,
                item_name: item.item_name,
                uom: item.uom,
                globalRate: rateVal,
                rate: Number(created.rate) || rateVal,
                gst: item.gst_master || '0',
            }]);
            toast.success('Item added');
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to add item');
        }
        setItemSearchOpenIndex(null);
    };

    const handleRemoveSupplierItem = async (index: number) => {
        const item = supplierItems[index];
        if (item.id && party?.id) {
            try {
                await axios.delete(`/api/parties/supplier-items?id=${item.id}`);
                toast.success('Item removed');
            } catch (error: any) {
                const msg = error?.response?.data?.message || 'Failed to remove item';
                toast.error(msg);
                return;
            }
        }
        setSupplierItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleOpenRateDialog = async (item: SupplierItem, index: number) => {
        setRateDialogItem(item);
        setRateDialogIndex(index);
        setNewRate(item.rate.toString());
        setEffectiveDate(new Date().toISOString().split('T')[0]);
        setRateDialogOpen(true);
        setRateHistoryLoading(true);
        try {
            if (item.id) {
                const response = await axios.get(
                    `/api/parties/supplier-items?partySupplierItemId=${item.id}`,
                );
                setRateHistory(response.data.data || []);
            } else {
                setRateHistory([]);
            }
        } catch {
            setRateHistory([]);
        } finally {
            setRateHistoryLoading(false);
        }
    };

    const handleUpdateRate = async () => {
        if (!rateDialogItem || !newRate || !effectiveDate) return;
        const parsedRate = parseFloat(newRate);
        if (isNaN(parsedRate) || parsedRate <= 0) {
            toast.error('Rate must be a positive number');
            return;
        }
        setSavingRate(true);
        try {
            if (rateDialogItem.id) {
                await axios.put('/api/parties/supplier-items', {
                    id: rateDialogItem.id,
                    rate: parsedRate,
                    effective_date: effectiveDate,
                });
                const response = await axios.get(
                    `/api/parties/supplier-items?partySupplierItemId=${rateDialogItem.id}`,
                );
                setRateHistory(response.data.data || []);
            }
            setSupplierItems(prev => prev.map((item, i) =>
                i === rateDialogIndex
                    ? { ...item, rate: parsedRate }
                    : item
            ));
            toast.success('Rate updated');
            setRateDialogOpen(false);
        } catch (err: any) {
            toast.error(err.response?.data?.message || 'Failed to update rate');
        } finally {
            setSavingRate(false);
        }
    };

    const handleAddEmptyRow = () => {
        setSupplierItems(prev => [...prev, {
            capital_sor_id: '',
            item_name: '',
            uom: '',
            globalRate: 0,
            rate: 0,
            gst: '0',
        }]);
        setItemSearchOpenIndex(supplierItems.length);
    };

    const getSupplierItemErrors = useCallback(
        (item: SupplierItem): { capital_sor_id?: string; rate?: string } => {
            if (!submitAttempted) return {};
            const errors: { capital_sor_id?: string; rate?: string } = {};
            if (!item.capital_sor_id) {
                errors.capital_sor_id = 'Please select an item.';
            }
            if (!item.rate && item.rate !== 0) {
                errors.rate = 'Rate is required.';
            } else if (item.rate <= 0) {
                errors.rate = 'Rate must be greater than 0.';
            }
            return errors;
        },
        [submitAttempted],
    );

    const hideProjectItems = useMemo(() => {
        return supplierItems.some((item) =>
            item.item_name && item.item_name.toLowerCase().includes('block')
        );
    }, [supplierItems]);

    const validationSchema = Yup.object({
        name: Yup.string()
            .trim()
            .required('Party name is required'),

        address: Yup.string()
            .trim()
            .nullable(),

        mobile_no: Yup.string()
            .nullable()
            .test(
                'mobile',
                'Invalid mobile number',
                value => !value || /^[6-9]\d{9}$/.test(value)
            ),

        email: Yup.string()
            .trim()
            .email('Invalid email format')
            .nullable(),

        gst_no: Yup.string()
            .nullable()
            .test(
                'gst',
                'Invalid GSTIN format',
                value =>
                    !value ||
                    /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(value)
            ),

        type: Yup.string()
            .oneOf(['BUYER', 'SELLER'], 'Invalid type')
            .required('Type is required'),

        bank_account_name: Yup.string().required('Account holder name is required'),

        bank_account_number: Yup.string()
            .matches(/^\d{9,18}$/, 'Invalid account number')
            .required('Account number is required'),

        bank_name: Yup.string().required('Bank name is required'),

        bank_ifsc_code: Yup.string()
            .nullable()
            .test(
                'ifsc',
                'Invalid IFSC code',
                value => !value || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(value)
            ),

        bank_opening_balance: Yup.number()
            .typeError('Must be a number')
            .required('Opening balance is required')
            .min(0, 'Cannot be negative'),
    });

    const formik = useFormik({
        initialValues: {
            name: party?.name || '',
            address: party?.address || '',
            mobile_no: party?.mobile_no || '',
            email: party?.email || '',
            gst_no: party?.gst_no || '',
            type: party?.type || 'BUYER',
            bank_account_name: party?.bank_account_name || '',
            bank_account_number: party?.bank_account_number || '',
            bank_name: party?.bank_name || '',
            bank_ifsc_code: party?.bank_ifsc_code || '',
            bank_opening_balance: party?.bank_opening_balance?.toString() || '',
        },
        validationSchema,
        validateOnChange: true,
        validateOnBlur: true,
        onSubmit: async (values) => {
            setSubmitAttempted(true);

            const validSupplierItems = supplierItems.filter(
                (item) => item.capital_sor_id && item.rate > 0
            );
            if (validSupplierItems.length === 0) {
                toast.error('Please add at least one Supplier Item Detail.');
                return;
            }
            if (validSupplierItems.length !== supplierItems.length) {
                toast.error('Please select an item and set a valid rate for all Supplier Item Details.');
                return;
            }

            try {
                const submitData: any = {
                    name: values.name,
                    address: values.address || undefined,
                    mobile_no: values.mobile_no || undefined,
                    email: values.email || undefined,
                    gst_no: values.gst_no || undefined,
                    type: values.type,
                    hide_project_items: hideProjectItems,
                    bank_account_name: values.bank_account_name || undefined,
                    bank_account_number: values.bank_account_number || undefined,
                    bank_name: values.bank_name || undefined,
                    bank_ifsc_code: values.bank_ifsc_code || undefined,
                    bank_opening_balance: values.bank_opening_balance ? parseFloat(values.bank_opening_balance) : undefined,
                };

                if (party) {
                    await axios.put(`/api/parties/${party.id}`, submitData);
                    toast.success('Party updated successfully');
                } else {
                    const res = await axios.post('/api/parties', submitData);
                    const newPartyId = res.data?.data?.id;
                    toast.success('Party created successfully');

                    if (newPartyId) {
                        for (const item of validSupplierItems) {
                            try {
                                await axios.post('/api/parties/supplier-items', {
                                    party_id: newPartyId,
                                    capital_sor_id: item.capital_sor_id,
                                    rate: item.rate,
                                    effective_date: new Date().toISOString().split('T')[0],
                                });
                            } catch {}
                        }
                    }
                }
                onSuccess();
            } catch (error: any) {
                toast.error(error.response?.data?.message || 'Failed to save party');
            }
        },
    });

    useEffect(() => {
        const values = formik.values;
        let filled = 0;
        let total = 0;

        const stringFields = [
            'name', 'address', 'mobile_no', 'email', 'gst_no',
            'type', 'bank_account_name', 'bank_account_number',
            'bank_name', 'bank_ifsc_code', 'bank_opening_balance',
        ];

        stringFields.forEach(field => {
            total++;
            const val = (values as any)[field];
            if (val && val.toString().trim() !== '') {
                filled++;
            }
        });

        const result = total > 0 ? Math.round((filled / total) * 100) : 0;
        onProgress?.(result);
    }, [formik.values, onProgress]);

    return (
        <form onSubmit={formik.handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
        
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2 relative">
                    <Label htmlFor="name">Name *</Label>
                    <Input
                        id="name"
                        {...formik.getFieldProps('name')}
                        placeholder="Enter party name"
                        className={formik.touched.name && formik.errors.name ? 'border-red-500' : ''}
                    />
                    {formik.touched.name && formik.errors.name && (
                        <p className="text-xs text-red-500">{formik.errors.name}</p>
                    )}
                </div>

                <div className="space-y-2 relative">
                    <Label>Type *</Label>
                    <InlineSelect
                        value={formik.values.type}
                        onChange={(value) => formik.setFieldValue('type', Array.isArray(value) ? value[0] || '' : value || '')}
                        onBlur={formik.handleBlur}
                        placeholder="Select role"
                        options={PARTY_TYPES}
                        className={formik.touched.type && formik.errors.type ? 'border-red-500' : ''}
                    />
                    {formik.errors.type && (
                        <p className="text-xs text-red-500">{formik.errors.type}</p>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2 relative">
                    <Label htmlFor="mobile_no">Mobile No</Label>
                    <Input
                        id="mobile_no"
                        {...formik.getFieldProps('mobile_no')}
                        placeholder="Enter 10-digit mobile number"
                        className={formik.touched.mobile_no && formik.errors.mobile_no ? 'border-red-500' : ''}
                    />
                    {formik.touched.mobile_no && formik.errors.mobile_no && (
                        <p className="text-xs text-red-500">{formik.errors.mobile_no}</p>
                    )}
                </div>

                <div className="space-y-2 relative">
                    <Label htmlFor="email">Email</Label>
                    <Input
                        id="email"
                        type="email"
                        {...formik.getFieldProps('email')}
                        placeholder="Enter email"
                        className={formik.touched.email && formik.errors.email ? 'border-red-500' : ''}
                    />
                    {formik.touched.email && formik.errors.email && (
                        <p className="text-xs text-red-500">{formik.errors.email}</p>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2 relative">
                    <Label htmlFor="bank_account_name">A/C Holder Name *</Label>
                    <Input
                        id="bank_account_name"
                        {...formik.getFieldProps('bank_account_name')}
                        placeholder="Account holder name"
                    />
                    {formik.touched.bank_account_name && formik.errors.bank_account_name && (
                        <p className="text-xs text-red-500">{formik.errors.bank_account_name}</p>
                    )}
                </div>
                <div className="space-y-2 relative">
                    <Label htmlFor="bank_account_number">A/C Number *</Label>
                    <Input
                        id="bank_account_number"
                        {...formik.getFieldProps('bank_account_number')}
                        placeholder="Account number"
                    />
                    {formik.touched.bank_account_number && formik.errors.bank_account_number && (
                        <p className="text-xs text-red-500">{formik.errors.bank_account_number}</p>
                    )}
                </div>
                <div className="space-y-2 relative">
                    <Label htmlFor="bank_name">Bank Name *</Label>
                    <Input
                        id="bank_name"
                        {...formik.getFieldProps('bank_name')}
                        placeholder="Bank name"
                    />
                    {formik.touched.bank_name && formik.errors.bank_name && (
                        <p className="text-xs text-red-500">{formik.errors.bank_name}</p>
                    )}
                </div>
                <div className="space-y-2 relative">
                    <Label htmlFor="bank_ifsc_code">IFSC Code</Label>
                    <Input
                        id="bank_ifsc_code"
                        {...formik.getFieldProps('bank_ifsc_code')}
                        placeholder="e.g., SBIN0001234"
                        className="uppercase"
                    />
                    {formik.touched.bank_ifsc_code && formik.errors.bank_ifsc_code && (
                        <p className="text-xs text-red-500">{formik.errors.bank_ifsc_code}</p>
                    )}
                </div>
                <div className="space-y-2 relative">
                    <Label htmlFor="bank_opening_balance">Opening Balance*</Label>
                    <Input
                        id="bank_opening_balance"
                        type="number"
                        {...formik.getFieldProps('bank_opening_balance')}
                        placeholder="0.00"
                    />
                    {formik.touched.bank_opening_balance && formik.errors.bank_opening_balance && (
                        <p className="text-xs text-red-500">{formik.errors.bank_opening_balance}</p>
                    )}
                </div>
                <div className="space-y-2 relative">
                    <Label htmlFor="gst_no">GST No</Label>
                    <Input
                        id="gst_no"
                        {...formik.getFieldProps('gst_no')}
                        placeholder="Enter GST number (e.g., 12ABCDE1234A1Z1)"
                        className={formik.touched.gst_no && formik.errors.gst_no ? 'border-red-500' : ''}
                    />
                    {formik.touched.gst_no && formik.errors.gst_no && (
                        <p className="text-xs text-red-500">{formik.errors.gst_no}</p>
                    )}
                </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
                <div className="space-y-2 relative">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                        id="address"
                        {...formik.getFieldProps('address')}
                        placeholder="Enter address"
                        className={formik.touched.address && formik.errors.address ? 'border-red-500' : ''}
                    />
                    {formik.touched.address && formik.errors.address && (
                        <p className="text-xs text-red-500">{formik.errors.address}</p>
                    )}
                </div>
            </div>

            <div className="space-y-2 relative">
                <div className="flex justify-between items-start">
                    <Labels>
                        Supplier Item Details
                    </Labels>
                </div>
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="min-w-[250px]">Item (Other Items)</TableHead>
                                <TableHead className="min-w-[120px] text-right">Rate (₹)</TableHead>
                                <TableHead className="min-w-[80px] text-right">GST (%)</TableHead>
                                <TableHead className="min-w-[80px] text-center">Action</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {supplierItems.map((item, index) => {
                                const itemErrors = getSupplierItemErrors(item);
                                return (
                                <TableRow key={index}>
                                    <TableCell className="min-w-[250px]">
                                        <Popover open={itemSearchOpenIndex === index} onOpenChange={(open) => setItemSearchOpenIndex(open ? index : null)}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className={`w-full justify-between font-normal h-9 text-xs ${itemErrors.capital_sor_id ? "border-destructive" : ""}`}
                                                >
                                                    <span className="max-w-[200px] truncate">
                                                        {item.item_name || 'Select item'}
                                                    </span>
                                                    <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[300px] p-0" align="start">
                                                <Command>
                                                    <CommandInput placeholder="Search items..." className="h-8" />
                                                    <CommandEmpty>No item found.</CommandEmpty>
                                                    <CommandGroup className="max-h-60 overflow-auto">
                                                        {itemOptions.map((opt) => (
                                                            <CommandItem
                                                                key={opt.id}
                                                                value={opt.item_name?.toLowerCase()}
                                                                onSelect={() => handleAddSupplierItem(opt.id, index)}
                                                                className="cursor-pointer text-xs"
                                                            >
                                                                <Check
                                                                    className={`mr-2 h-3 w-3 ${item.capital_sor_id === opt.id ? 'opacity-100' : 'opacity-0'}`}
                                                                />
                                                                <span className="truncate">{opt.item_name}</span>
                                                                {opt.uom && (
                                                                    <span className="ml-2 text-muted-foreground">({opt.uom})</span>
                                                                )}
                                                            </CommandItem>
                                                        ))}
                                                    </CommandGroup>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        {itemErrors.capital_sor_id && (
                                            <p className="text-xs text-destructive mt-1">{itemErrors.capital_sor_id}</p>
                                        )}
                                    </TableCell>
                                    <TableCell className="min-w-[120px] text-right text-xs">
                                        {item.rate.toFixed(2)}
                                        {itemErrors.rate && (
                                            <p className="text-xs text-destructive mt-1 text-right">{itemErrors.rate}</p>
                                        )}
                                    </TableCell>
                                    <TableCell className="min-w-[80px] text-right text-xs">
                                        {item.gst || '0'}
                                    </TableCell>
                                    <TableCell className="min-w-[80px] text-center">
                                        <div className="flex items-center justify-center gap-1">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon"
                                                className="h-7 w-7"
                                                onClick={() => handleOpenRateDialog(item, index)}
                                            >
                                                <IndianRupee className="h-3.5 w-3.5" />
                                            </Button>
                                            <button
                                                type="button"
                                                onClick={() => handleRemoveSupplierItem(index)}
                                                className="text-destructive hover:text-destructive/80 transition-colors"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    <div className="p-3">
                        <Button type="button" variant="outline" size="sm" onClick={handleAddEmptyRow} disabled={loadingItems}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Line Item
                        </Button>
                    </div>
                </div>
                {submitAttempted && supplierItems.every(i => !i.capital_sor_id) && (
                    <p className="text-sm text-destructive mt-2">Please add at least one item.</p>
                )}
            </div>

            <input type="hidden" name="hide_project_items" value={hideProjectItems ? 'true' : 'false'} />

            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" disabled={formik.isSubmitting}>
                    {formik.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {party ? 'Update' : 'Create'}
                </Button>
            </div>

            <Dialog
                open={rateDialogOpen}
                onOpenChange={(open) => {
                    if (!open) {
                        setRateDialogOpen(false);
                        setRateHistory([]);
                    }
                }}
            >
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Update Rate - {rateDialogItem?.item_name}</DialogTitle>
                        <DialogDescription>
                            Update the party-specific rate for this item and view rate history
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
                                        value={newRate}
                                        onChange={(e) => setNewRate(e.target.value)}
                                        placeholder="Enter new rate"
                                    />
                                </div>
                                <div className="flex-1 space-y-2 relative">
                                    <Label>Effective Date *</Label>
                                    <Input
                                        type="date"
                                        value={effectiveDate}
                                        min={new Date().toISOString().split('T')[0]}
                                        onChange={(e) => setEffectiveDate(e.target.value)}
                                    />
                                </div>
                            </div>
                            <Button className="mt-4" onClick={handleUpdateRate} disabled={savingRate || !newRate}>
                                {savingRate ? "Updating..." : "Update Rate"}
                            </Button>
                        </div>
                        {rateHistory.length > 0 && (
                            <>
                                <h3 className="font-semibold mb-2">Rate History</h3>
                                {rateHistoryLoading ? (
                                    <p className="text-muted-foreground">Loading...</p>
                                ) : (
                                    <div className="space-y-2">
                                        {rateHistory.map((p: any, index: number) => {
                                            const now = new Date();
                                            const startDate = new Date(p.start_date);
                                            const expiryDate = p.expiry_date ? new Date(p.expiry_date) : null;
                                            const isActive = startDate <= now && (!expiryDate || expiryDate > now);
                                            const prevRate = rateHistory[index + 1];
                                            return (
                                                <div key={p.id} className={`p-3 border rounded ${isActive ? "bg-green-50 border-green-200" : "bg-muted"}`}>
                                                    <div className="flex justify-between items-center">
                                                        <div>
                                                            <p className="font-medium">
                                                                ₹{Number(p.price).toFixed(2)}
                                                                {isActive && (
                                                                    <span className="ml-2 text-[10px] font-semibold text-green-600">(Current)</span>
                                                                )}
                                                            </p>
                                                            <p className="text-xs text-muted-foreground">
                                                                Effective: {startDate.toLocaleDateString()}
                                                                {expiryDate && (
                                                                    <> - Until: {expiryDate.toLocaleDateString()}</>
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
        </form>
    );
}
