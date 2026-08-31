'use client';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DropdownMenuSeparator } from "@radix-ui/react-dropdown-menu";

import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Column, DataTable, FormModal } from '../common';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, Loader2, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { PurchaseEntryForm } from '@/components/purchase-entries/purchase-entry-form';
import { VOUCHER_TYPES, ACCOUNT_TYPES, TRANSACTION_TYPES, VOUCHER_TYPE_LABELS, ACCOUNT_TYPE_LABELS, TRANSACTION_TYPE_LABELS } from '@/lib/constants';
import { formatIndianCurrency } from '@/lib/financial-year';
import Link from 'next/link';
import { FileText, CreditCard, Wallet, Building } from 'lucide-react';
import { Labels } from '../ui/labels';

interface PurchaseEntry {
    id: string;
    entry_no: any;
    sr_no: number;
    entry_date: string;
    voucher_type: string;
    account_type: string;
    transaction_type: string;
    party?: {
        name: string;
    };
    project?: {
        name: string;
        unique_name?: string | null;
    };
    project_id?: string | null;
    party_id?: string | null;
    instrument_no?: string | null;
    received_by?: string | null;
    receivedByName?: string | null;
    gst_percent: number;
    gst_total: number;
    remark?: string | null;
    createdAt?: string;
    materials?: Array<{
        id: string;
        material_id: string;
        capitalSOR?: { item_name: string; uom?: string };
        qty: number;
        rate: number;
        total: number;
        gst_percent?: number;
    }>;
    locations?: Array<{
        location_id: string;
        location?: { name: string };
    }>;
    isPaid?: boolean;
}

export function PurchaseEntriesClient() {
    const [data, setData] = useState<PurchaseEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingEntry, setEditingEntry] = useState<PurchaseEntry | null>(null);
    const [deleteEntry, setDeleteEntry] = useState<PurchaseEntry | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [formProgress, setFormProgress] = useState(0);

    const [pagination, setPagination] = useState({
        page: 1,
        totalPages: 1,
        total: 0,
    });

    const [filters, setFilters] = useState({
        voucher_type: '',
        account_type: '',
        transaction_type: '',
        payment_status: '',
    });

    const fetchData = useCallback(async (
        page = 1,
        searchValue = search,
        sort = sortField,
        order = sortOrder,
        pageLimit = limit
    ) => {
        try {
            setLoading(true);

            const params = new URLSearchParams();
            params.append('page', page.toString());
            params.append('limit', pageLimit.toString());
            if (searchValue) params.append('search', searchValue);
            if (sort) params.append('sortField', sort);
            if (order) params.append('sortOrder', order);
            if (filters.voucher_type) params.append('voucher_type', filters.voucher_type);
            if (filters.account_type) params.append('account_type', filters.account_type);
            if (filters.transaction_type) params.append('transaction_type', filters.transaction_type);
            if (filters.payment_status) params.append('payment_status', filters.payment_status);

            const response = await axios.get(`/api/purchase-entries?${params.toString()}`);
            setData(response.data.data);
            setPagination({
                page: response.data.pagination.page,
                totalPages: response.data.pagination.pages,
                total: response.data.pagination.total,
            });
        } catch {
            toast.error('Failed to fetch purchase entries');
        } finally {
            setLoading(false);
        }
    }, [search, sortField, sortOrder, limit, filters]);

    useEffect(() => {
        fetchData(1);
    }, [search, sortField, sortOrder, limit, filters]);

    const handleFilterChange = (key: string, value: string) => {
        setFilters(prev => ({ ...prev, [key]: value }));
    };

    const clearFilters = () => {
        setFilters({ voucher_type: '', account_type: '', transaction_type: '', payment_status: '' });
    };

    const handleEdit = async (entry: PurchaseEntry) => {
        try {
            const res = await axios.get(`/api/purchase-entries/${entry.id}`);
            if (res.data?.data) {
                setEditingEntry(res.data.data);
            } else {
                setEditingEntry(entry);
            }
        } catch {
            setEditingEntry(entry);
        }
        setModalOpen(true);
    };

    const handleAdd = () => {
        setEditingEntry(null);
        setModalOpen(true);
    };

    const handleDelete = (entry: PurchaseEntry) => {
        setDeleteEntry(entry);
    };

    const confirmDelete = async () => {
        if (!deleteEntry) return;

        try {
            setDeleteLoading(true);
            await axios.delete(`/api/purchase-entries/${deleteEntry.id}`);
            toast.success('Purchase entry deleted successfully');
            fetchData(pagination.page);
            setDeleteEntry(null);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete purchase entry');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleSuccess = () => {
        setModalOpen(false);
        setEditingEntry(null);
        fetchData(pagination.page);
    };

    const getVoucherTypeBadge = (type: string) => {
        const variants: Record<string, 'default' | 'destructive' | 'secondary' | 'outline'> = {
            'PURCHASE_VOUCHER': 'default',
            RETURN: 'destructive',
            JOURNAL: 'secondary',
        };
        return <Badge variant={variants[type] || 'outline'}>{type}</Badge>;
    };

    const [viewEntry, setViewEntry] = useState<PurchaseEntry | null>(null);
    const [viewLocations, setViewLocations] = useState<PurchaseEntry | null>(null);
    const [paymentModalOpen, setPaymentModalOpen] = useState(false);
    const [selectedPaymentEntry, setSelectedPaymentEntry] = useState<PurchaseEntry | null>(null);
    const [paymentAccountType, setPaymentAccountType] = useState<'BANK' | 'CASH'>('BANK');
    const [paymentProcessing, setPaymentProcessing] = useState(false);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState('');
    const [paymentFormProgress, setPaymentFormProgress] = useState(0);
    const [accountOptions, setAccountOptions] = useState<Array<{ label: string; value: string; type: string }>>([]);

    const fetchAccounts = useCallback(async (type: string) => {
        try {
            const response = await axios.get(`/api/accounts?limit=9999&type=${type}`);
            const accounts = response.data.data || [];
            setAccountOptions(accounts.map((a: any) => ({
                label: type === 'BANK' ? `${a.account_name} (${a.account_number})` : a.cash_name,
                value: a.id,
                type: a.type,
            })));
        } catch (error) {
            console.error('Failed to fetch accounts:', error);
        }
    }, []);

    const handlePaymentClick = (entry: PurchaseEntry) => {
        setSelectedPaymentEntry(entry);
        const totalsArray = entry.materials?.map(m => Number(m.total) || 0) || [];
        const sum = totalsArray.reduce((acc, val) => acc + val, 0);
        const grandTotal = sum + Number(entry.gst_total || 0);
        setPaymentAmount(grandTotal.toString());
        setPaymentAccountType('BANK');
        fetchAccounts('BANK');
        setPaymentModalOpen(true);
    };

    const handlePaymentAccountTypeChange = (type: 'BANK' | 'CASH') => {
        setPaymentAccountType(type);
        setSelectedAccountId('');
        fetchAccounts(type);
    };

    const handlePaymentSubmit = async () => {
        if (!selectedPaymentEntry || !selectedAccountId || !paymentAmount) {
            toast.error('Please select an account and enter payment amount');
            return;
        }

        const amount = parseFloat(paymentAmount);
        if (amount <= 0) {
            toast.error('Payment amount must be greater than 0');
            return;
        }

        const totalsArray = selectedPaymentEntry.materials?.map(m => Number(m.total) || 0) || [];
        const purchaseTotal = totalsArray.reduce((acc, val) => acc + val, 0) + Number(selectedPaymentEntry.gst_total || 0);

        if (amount > purchaseTotal) {
            toast.error(`Payment amount (₹${amount.toLocaleString()}) exceeds purchase total (₹${purchaseTotal.toLocaleString()})`);
            return;
        }

        setPaymentProcessing(true);
        try {
            const narration = `Payment for Purchase Entry #${selectedPaymentEntry.id}`;

            const transactionData = {
                account_id: selectedAccountId,
                transaction_date: new Date().toISOString(),
                transaction_type: 'DEBIT',
                ledger: selectedPaymentEntry.party?.name || '',
                ledger_type: 'PURCHASE',
                party_id: selectedPaymentEntry.party_id || '',
                project_id: selectedPaymentEntry.project_id || '',
                narration: narration,
                particular: narration,
                amount: amount,
                credit_amount: amount,
                debit_amount: 0,
            };

            if (paymentAccountType === 'BANK') {
                await axios.post('/api/bank-transactions', transactionData);
            } else {
                await axios.post('/api/cash-transactions', transactionData);
            }

            const entry: any = selectedPaymentEntry;
            const totalsArray = entry.materials?.map((m: any) => Number(m.total) || 0) || [];
            const materialTotal = totalsArray.reduce((acc: number, val: number) => acc + val, 0);
            const purchaseTotal = materialTotal + Number(entry.gst_total || 0);
            const newTotalPaid = (Number(entry.amount_paid || 0)) + amount;

            let newPaymentStatus = 'PARTIAL';
            if (newTotalPaid >= purchaseTotal) {
                newPaymentStatus = 'PAID';
            } else if (newTotalPaid <= 0) {
                newPaymentStatus = 'UNPAID';
            }

            await axios.put(`/api/purchase-entries/${selectedPaymentEntry.id}`, {
                payment_status: newPaymentStatus,
            });

            toast.success('Payment processed successfully');
            setPaymentModalOpen(false);
            setSelectedPaymentEntry(null);
            setTimeout(() => {
                fetchData(1);
            }, 500);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to process payment');
        } finally {
            setPaymentProcessing(false);
        }
    };

    useEffect(() => {
        let filled = 0;
        let total = 0;

        total++;
        if (paymentAccountType) filled++;

        total++;
        if (selectedAccountId) filled++;

        total++;
        if (paymentAmount && parseFloat(paymentAmount) > 0) filled++;

        const result = total > 0 ? Math.round((filled / total) * 100) : 0;
        setPaymentFormProgress(result);
    }, [paymentAccountType, selectedAccountId, paymentAmount]);

    const filteredAccountOptions = accountOptions.filter(a => a.type === paymentAccountType);

    const columns = useMemo<Column<PurchaseEntry>[]>(() => {
        return [
            {
                header: 'Purchase Entrie',
                accessorKey: 'sr_no',
                sortable: true,
                cell: (entry: PurchaseEntry) => {
                    const date = new Date(entry.entry_date);
                    const longFormat = date.toLocaleDateString('en-GB', {
                        day: '2-digit',
                        month: 'long',
                        year: 'numeric',
                        weekday: 'long',
                    });
                    return (<div className="text-sm">
                        <div>{entry.entry_no}</div>
                        <div className="text-muted-foreground text-xs">{longFormat}</div>
                    </div>)
                },
            },
            {
                header: 'Voucher Type',
                accessorKey: 'voucher_type',
                sortable: true,
                cell: (entry: PurchaseEntry) => VOUCHER_TYPE_LABELS[entry.voucher_type] ?? "-",
            },
            {
                header: 'Account Type',
                accessorKey: 'account_type',
                sortable: true,
                cell: (entry: PurchaseEntry) => (
                    <span className={entry.account_type === 'DEBIT' ? 'text-red-600' : 'text-green-600'}>
                        {ACCOUNT_TYPE_LABELS[entry.account_type] ?? "-"}
                    </span>
                ),
            },
            {
                header: 'Status',
                accessorKey: 'paymentStatus',
                sortable: false,
                cell: (entry: any) => {
                    const status = entry.paymentStatus || (entry.isPaid ? 'PAID' : 'UNPAID');
                    if (status === 'PAID') {
                        return (
                            <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
                                Paid
                            </Badge>
                        );
                    } else if (status === 'PARTIAL') {
                        return (
                            <Badge variant="default" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">
                                Partial
                            </Badge>
                        );
                    } else {
                        return (
                            <Badge variant="destructive" className="bg-red-100 text-red-800 hover:bg-red-100">
                                Unpaid
                            </Badge>
                        );
                    }
                },
            },
            {
                header: 'Transaction Type',
                accessorKey: 'transaction_type',
                sortable: true,
                cell: (entry: PurchaseEntry) => TRANSACTION_TYPE_LABELS[entry.transaction_type] ?? "-",
            },
            {
                header: 'Project / Location',
                accessorKey: 'project',
                sortable: true,
                cell: (entry: PurchaseEntry) => {
                    const projectName = entry.project?.unique_name || entry.project?.name || '-';
                    const locNames = entry.locations?.map(l => l.location?.name).filter(Boolean) || [];
                    return (
                        <div className="text-sm flex items-center gap-2">
                            <div className="flex-1 min-w-0">
                                <div>{projectName}</div>
                                {locNames.length > 0 && (
                                    <div className="text-muted-foreground text-xs flex items-center gap-1">
                                        <span>{locNames.join(', ')}</span>
                                    </div>
                                )}
                            </div>
                            {locNames.length > 0 && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setViewLocations(entry); }}
                                    className="text-primary hover:underline text-xs shrink-0"
                                >
                                    View
                                </button>
                            )}
                        </div>
                    );
                },
            },
            {
                header: 'Party Name',
                accessorKey: 'party',
                sortable: true,
                cell: (entry: PurchaseEntry) => <span>{entry.party?.name || '-'}</span>,
            },
            {
                header: 'Instrument No',
                accessorKey: 'instrument_no',
                sortable: true,
                cell: (entry: PurchaseEntry) => <span>{entry.instrument_no || '-'}</span>,
            },
            {
                header: 'Material',
                accessorKey: 'materials',
                cell: (entry: PurchaseEntry) => {
                    const materialTotal = entry.materials?.length;
                    return <div className="flex items-center gap-2"><span className="text-sm"> {materialTotal} materials(s)    <button
                        onClick={() => setViewEntry(entry)}
                        className="text-xs text-blue-500 hover:text-blue-700 underline"
                    >
                        View
                    </button></span></div>;
                },
            },
            {
                header: 'Total',
                accessorKey: 'materials',
                cell: (entry: PurchaseEntry) => {
                    const totalsArray = entry.materials?.map(m => Number(m.total) || 0) || [];
                    const sum = totalsArray.reduce((acc, val) => acc + val, 0);
                    return (
                        <span className="font-medium">
                            {sum
                                ? `₹${formatIndianCurrency(sum)}`
                                : '-'}
                        </span>
                    );
                },
            },
            {
                header: 'Grand Total',
                accessorKey: 'gst_total',
                sortable: true,
                cell: (entry: PurchaseEntry) => {
                    const totalsArray = entry.materials?.map(m => Number(m.total) || 0) || [];
                    const sum = totalsArray.reduce((acc, val) => acc + val, 0);
                    const total = Number(entry.gst_total) + Number(sum);
                    return (
                        <span className="font-medium">₹{formatIndianCurrency(Number(total))}</span>
                    )
                },
            },
            {
                header: 'Received By',
                accessorKey: 'received_by',
                sortable: true,
                cell: (entry: PurchaseEntry) => <span>{entry.receivedByName || '-'}</span>,
            },
            {
                header: "Actions",
                accessorKey: "actions",
                cell: (entry: any) => {
                    const status = entry.paymentStatus || (entry.isPaid ? 'PAID' : 'UNPAID');
                    return (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <MoreHorizontal className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>

                            <DropdownMenuContent
                                align="end"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {status != 'PAID' && false && (
                                    <>
                                        <DropdownMenuItem onClick={() => handlePaymentClick(entry)}>
                                            <CreditCard className="mr-2 h-4 w-4" />
                                            Payment
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                    </>
                                )}

                                <DropdownMenuItem onClick={() => handleEdit(entry)}>
                                    <Pencil className="mr-2 h-4 w-4" />
                                    Edit
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />

                                <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => handleDelete(entry)}
                                >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    );
                },
            },
            // {
            //     header: 'Actions',
            //     accessorKey: 'actions',
            //     cell: (entry: PurchaseEntry) => {
            //         const totalsArray = entry.materials?.map(m => Number(m.total) || 0) || [];
            //         const sum = totalsArray.reduce((acc, val) => acc + val, 0);
            //         const grandTotal = sum + Number(entry.gst_total || 0);

            //         return (
            //             <div className="flex flex-col gap-1">

            //                 <Link
            //                     href={`/purchase-entries/${entry.id}/tax-invoice`}
            //                     className="inline-flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors w-fit"
            //                 >
            //                     <FileText className="h-3 w-3" />
            //                     Tax Invoice
            //                 </Link>
            //             </div>
            //         );
            //     },
            // },
        ];
    }, []);

    return (
        <div className="flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Purchase Entries
                    </h2>
                </div>
            </div>

            <DataTable
                data={data}
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
                // onEdit={handleEdit}
                // onDelete={handleDelete}
                searchPlaceholder="Search purchase entries..."
                addLabel="Add Purchase Entry"
                emptyMessage="No purchase entries found."
                filters={
                    <div className="flex flex-wrap items-center gap-2 order-[3] w-full sm:w-auto">
                        <Select
                            value={filters.voucher_type}
                            onValueChange={(value) => handleFilterChange('voucher_type', value)}
                        >
                            <SelectTrigger className="inline-flex items-left justify-start whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5 w-[96px]">
                                <SelectValue placeholder="Voucher" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                {VOUCHER_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={filters.account_type}
                            onValueChange={(value) => handleFilterChange('account_type', value)}
                        >
                            <SelectTrigger className="inline-flex items-left justify-start whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5 w-[96px]">
                                <SelectValue placeholder="Account" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                {ACCOUNT_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={filters.transaction_type}
                            onValueChange={(value) => handleFilterChange('transaction_type', value)}
                        >
                            <SelectTrigger className="inline-flex items-left justify-start whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5 w-[115px]">
                                <SelectValue placeholder="Transaction" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                {TRANSACTION_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={filters.payment_status}
                            onValueChange={(value) => handleFilterChange('payment_status', value)}
                        >
                            <SelectTrigger className="inline-flex items-left justify-start whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5 w-[84px]">
                                <SelectValue placeholder="Status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All</SelectItem>
                                <SelectItem value="paid">Paid</SelectItem>
                                <SelectItem value="unpaid">Unpaid</SelectItem>
                            </SelectContent>
                        </Select>
                        {(filters.voucher_type || filters.account_type || filters.transaction_type || filters.payment_status) && (
                            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-muted-foreground">
                                Clear
                            </Button>
                        )}
                    </div>
                }
            />

            <Dialog open={modalOpen} onOpenChange={(open) => !open && setModalOpen(false)}>
                <DialogContent className="max-w-4xl">
                    {formProgress ? (
                        <div className="-mx-6">
                            <div className="w-full h-1.5 bg-muted rounded-full bg-red-500 overflow-hidden -mt-[24px]">
                                <div
                                    className="h-full bg-blue-600 transition-all duration-300"
                                    style={{ width: `${formProgress}%` }}
                                />
                            </div>
                        </div>
                    ) : null}
                    <DialogHeader>
                        <DialogTitle>
                            {editingEntry ? 'Edit Purchase Entry' : 'Add New Purchase Entry'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingEntry
                                ? 'Update the purchase entry details below.'
                                : 'Fill in the details to create a new purchase entry.'}
                        </DialogDescription>
                    </DialogHeader>
                    <PurchaseEntryForm
                        entry={editingEntry as any}
                        onSuccess={handleSuccess}
                        onCancel={() => setModalOpen(false)}
                        onProgress={setFormProgress}
                    />
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!deleteEntry}
                onOpenChange={(open) => !open && setDeleteEntry(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                    </DialogHeader>

                    <DialogDescription className="py-4">
                        Are you sure you want to delete purchase entry{' '}
                        <strong>#{deleteEntry?.sr_no}</strong>?
                    </DialogDescription>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteEntry(null)}
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

            <Dialog open={!!viewEntry} onOpenChange={(open) => !open && setViewEntry(null)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Purchase Entry Materials Details - #{viewEntry?.sr_no}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="border rounded-lg">

                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Material</TableHead>
                                        <TableHead className="text-right">Qty</TableHead>
                                        <TableHead className="text-right">Rate</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {viewEntry?.materials?.map((m, i) => (
                                        <TableRow key={i}>
                                            <TableCell>{m.capitalSOR?.name || m.capitalSOR?.item_name || '-'}</TableCell>
                                            <TableCell className="text-right">{m.qty}</TableCell>
                                            <TableCell className="text-right">₹{formatIndianCurrency(Number(m.rate))}</TableCell>
                                            <TableCell className="text-right">₹{formatIndianCurrency(Number(m.total))}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        {/* {viewEntry?.locations && viewEntry.locations.length > 0 && (
                            <div className="text-sm">
                                <span className="font-medium">Locations:</span> {viewEntry.locations.map(l => l.location?.name).filter(Boolean).join(', ')}
                            </div>
                        )} */}
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={paymentModalOpen} onOpenChange={(open) => !open && setPaymentModalOpen(false)}>
                <DialogContent className="max-w-md">
                    {paymentFormProgress ? (
                        <div className="-mx-6">
                            <div className="w-full h-1.5 bg-muted rounded-full bg-red-500 overflow-hidden -mt-[24px]">
                                <div
                                    className="h-full bg-blue-600 transition-all duration-300"
                                    style={{ width: `${paymentFormProgress}%` }}
                                />
                            </div>
                        </div>
                    ) : null}
                    <DialogHeader>
                        <DialogTitle>Payment - {selectedPaymentEntry?.entry_no || `#${selectedPaymentEntry?.sr_no}`}</DialogTitle>
                        <DialogDescription>
                            Process payment for this purchase entry
                        </DialogDescription>
                    </DialogHeader>
                    {selectedPaymentEntry && (() => {
                        const totalsArray = selectedPaymentEntry.materials?.map((m: any) => Number(m.total) || 0) || [];
                        const sum = totalsArray.reduce((acc: number, val: number) => acc + val, 0);
                        const grandTotal = sum + Number(selectedPaymentEntry.gst_total || 0);

                        return (
                            <div className="space-y-4 pt-0  py-4">
                                <div className="bg-muted/30 rounded-lg p-4 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">Party:</span>
                                        <span className="font-medium">{selectedPaymentEntry.party?.name || '-'}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">Purchase Total:</span>
                                        <span className="font-medium text-lg">₹{formatIndianCurrency(grandTotal)}</span>
                                    </div>
                                </div>

                                <div className="space-y-2 rela">
                                    <Labels>Payment Account Type</Labels>

                                    <div className="flex gap-2">
                                        <Button
                                            type="button"
                                            variant={paymentAccountType === 'BANK' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => handlePaymentAccountTypeChange('BANK')}
                                            className="flex-1"
                                        >
                                            <Building className="h-4 w-4 mr-2" />
                                            Bank
                                        </Button>
                                        <Button
                                            type="button"
                                            variant={paymentAccountType === 'CASH' ? 'default' : 'outline'}
                                            size="sm"
                                            onClick={() => handlePaymentAccountTypeChange('CASH')}
                                            className="flex-1"
                                        >
                                            <Wallet className="h-4 w-4 mr-2" />
                                            Cash
                                        </Button>
                                    </div>
                                </div>


                            <div className='grid grid-cols-1 gap-3'>
                                <div className="space-y-2 relative">
                                    <Label>Select Account <span className="text-destructive">*</span></Label>
                                    <Select value={selectedAccountId} onValueChange={setSelectedAccountId}>
                                        <SelectTrigger>
                                            <SelectValue placeholder={`Select ${paymentAccountType === 'BANK' ? 'Bank' : 'Cash'} Account`} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {filteredAccountOptions.map((account) => (
                                                <SelectItem key={account.value} value={account.value}>
                                                    {account.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className='grid grid-cols-1 gap-3'>
                                <div className="space-y-2 relative">
                                    <Label>Payment Amount (₹) <span className="text-destructive">*</span></Label>
                                    <Input
                                        type="number"
                                        value={paymentAmount}
                                        onChange={(e) => setPaymentAmount(e.target.value)}
                                        placeholder="0.00"
                                        min="0"
                                        max={grandTotal}
                                        step="0.01"
                                        className="border-red-300 bg-red-50"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Max: ₹{formatIndianCurrency(grandTotal)} (Purchase Total)
                                    </p>
                                </div>
                            </div>
                                {/* <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                                    <p className="text-amber-800">
                                        <strong>Note:</strong> This will create a {paymentAccountType === 'BANK' ? 'bank' : 'cash'} transaction with DEBIT type and update the payment status.
                                    </p>
                                </div> */}
                            </div>
                        );
                    })()}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPaymentModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handlePaymentSubmit} disabled={paymentProcessing || !selectedAccountId || !paymentAmount}>
                            {paymentProcessing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                            {paymentProcessing ? 'Processing...' : 'Submit Payment'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!viewLocations} onOpenChange={(open) => !open && setViewLocations(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Locations</DialogTitle>
                        <DialogDescription>
                            {viewLocations?.project?.unique_name || viewLocations?.project?.name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                        {viewLocations?.locations?.map((l, i) => (
                            <div key={i} className="flex items-center gap-2 p-2 rounded-md bg-muted/50">
                                <span className="text-sm">{l.location?.name || '-'}</span>
                            </div>
                        ))}
                        {(!viewLocations?.locations || viewLocations.locations.length === 0) && (
                            <p className="text-sm text-muted-foreground">No locations found.</p>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
