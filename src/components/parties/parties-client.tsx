'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Column, DataTable, DataTableFilter, FormModal } from '../common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { PartyForm } from './party-form';
import { PARTY_TYPE_LABELS, PARTY_TYPES } from '@/lib/constants';
import { formatIndianCurrency } from '@/lib/financial-year';

interface Party {
    id: string;
    name: string;
    address: string | null;
    mobile_no: string | null;
    email: string | null;
    gst_no: string | null;
    party_type: string;
    type: string;
    bankAccounts?: Array<{ id: string; account_no: string; bank_name: string | null }>;
    bank_account_name?: string | null;
    bank_account_number?: string | null;
    bank_name?: string | null;
    bank_ifsc_code?: string | null;
    bank_opening_balance?: number;
    createdAt: string;
    current_balance?: number;
    total_debit?: number;
    total_credit?: number;
}

export function PartiesClient() {
    const [data, setData] = useState<Party[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingParty, setEditingParty] = useState<Party | null>(null);
    const [filterType, setFilterType] = useState<string[]>([]);
    const [deleteParty, setDeleteParty] = useState<Party | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [formProgress, setFormProgress] = useState(0);

    const [pagination, setPagination] = useState({
        page: 1,
        totalPages: 1,
        total: 0,
    });

    const fetchData = useCallback(async (
        page = 1,
        searchValue = search,
        sort = sortField,
        order = sortOrder,
        pageLimit = limit,
        typeFilter = filterType
    ) => {
        try {
            setLoading(true);

            const params = new URLSearchParams();
            params.append('page', page.toString());
            params.append('limit', pageLimit.toString());
            if (searchValue) params.append('search', searchValue);
            if (sort) params.append('sortField', sort);
            if (order) params.append('sortOrder', order);
            if (typeFilter.length > 0) params.append('type', typeFilter.join(','));

            const response = await axios.get(`/api/parties?${params.toString()}`);
            setData(response.data.data);
            setPagination({
                page: response.data.pagination.page,
                totalPages: response.data.pagination.pages,
                total: response.data.pagination.total,
            });
        } catch {
            toast.error('Failed to fetch parties');
        } finally {
            setLoading(false);
        }
    }, [search, sortField, sortOrder, limit, filterType]);

    useEffect(() => {
        fetchData(1);
    }, [search, sortField, sortOrder, limit, filterType]);

    const handleEdit = (party: Party) => {
        setEditingParty(party);
        setModalOpen(true);
    };

    const handleAdd = () => {
        setEditingParty(null);
        setModalOpen(true);
    };

    const handleDelete = (party: Party) => {
        setDeleteParty(party);
    };

    const confirmDelete = async () => {
        if (!deleteParty) return;

        try {
            setDeleteLoading(true);
            await axios.delete(`/api/parties/${deleteParty.id}`);
            toast.success('Party deleted successfully');
            fetchData(pagination.page);
            setDeleteParty(null);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete party');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleSuccess = () => {
        setModalOpen(false);
        setEditingParty(null);
        fetchData(pagination.page);
    };

    const columns = useMemo<Column<Party>[]>(() => {
        return [
            {
                header: 'Name',
                accessorKey: 'name',
                sortable: true,
                cell: (party: Party) => (
                    <div className="flex flex-col">
                        <span className="font-medium">{party.name}</span>
                        {party.address && (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                {party.address}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                header: 'Type',
                accessorKey: 'type',
                sortable: true,
                cell: (party: Party) => (
                    <Badge variant="outline" className="text-xs">
                        {PARTY_TYPE_LABELS[`${party.type}`] || 'GENERAL'}
                    </Badge>
                ),
            },
            {
                header: 'Bank A/C',
                accessorKey: 'bank_account_number',
                sortable: false,
                cell: (party: Party) => {
                    if (party.bank_account_number) {
                        return (
                            <div className="flex flex-col">
                                <span className="text-xs font-medium">{party.bank_account_name || '-'}</span>
                                <span className="text-xs text-muted-foreground">{party.bank_account_number}</span>
                                <span className="text-xs text-muted-foreground">{party.bank_name || '-'}</span>
                            </div>
                        );
                    }
                    return <span className="text-muted-foreground">-</span>;
                },
            },
            {
                header: 'Opening Balance',
                accessorKey: 'bank_opening_balance',
                sortable: false,
                cell: (party: Party) => {
                    const openingBalance = party.bank_opening_balance ?? 0;
                    if (openingBalance === 0) return <span className="text-muted-foreground">-</span>;
                    if (openingBalance < 0) {
                        return (
                            <span className="font-medium text-red-600">
                                ₹{formatIndianCurrency(Number(openingBalance))}
                            </span>
                        );
                    }
                    return (
                        <span className="font-medium text-green-600">
                            ₹{formatIndianCurrency(Number(openingBalance))}
                        </span>
                    );
                },
            },
            {
                header: 'Current Balance',
                accessorKey: 'current_balance',
                sortable: false,
                cell: (party: Party) => {
                    const balance = party.current_balance ?? 0;
                    if (balance < 0) {
                        return (
                            <span className="font-medium text-red-600">
                                ₹{formatIndianCurrency(Number(balance))}
                            </span>
                        );
                    }
                    return (
                        <span className="font-medium text-green-600">
                            ₹{formatIndianCurrency(Number(balance))}
                        </span>
                    );
                },
            },
            {
                header: 'Mobile',
                accessorKey: 'mobile_no',
                sortable: false,
                cell: (party: Party) => party.mobile_no || '-',
            },
            {
                header: 'GST No',
                accessorKey: 'gst_no',
                sortable: false,
                cell: (party: Party) => (
                    <span >{party.gst_no || '-'}</span>
                ),
            },
        ];
    }, []);

    return (
        <div className="flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Parties
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
                onEdit={handleEdit}
                onDelete={handleDelete}
                searchPlaceholder="Search parties..."
                addLabel="Add Party"
                emptyMessage="No parties found."
                filters={(
                    <div className="flex flex-wrap items-center gap-2 order-[3] w-full sm:w-auto">
                        <DataTableFilter
                            title="Type"
                            options={PARTY_TYPES}
                            selectedValues={filterType}
                            onChange={(values) => setFilterType(values)}
                        />

                        {filterType.length > 0 && (
                            <Button
                                variant="outline"
                                onClick={() => setFilterType([])}
                                className='inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border gap-1.5'
                            >
                                Clear All
                            </Button>
                        )}
                    </div>
                )}
            />

            <Dialog open={modalOpen} onOpenChange={(open) => !open && setModalOpen(false)}>
                <DialogContent className="max-w-2xl">
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
                            {editingParty ? 'Edit Party' : 'Add New Party'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingParty
                                ? 'Update the party details below.'
                                : 'Fill in the details to create a new party.'}
                        </DialogDescription>
                    </DialogHeader>
                    <PartyForm
                        party={editingParty}
                        onSuccess={handleSuccess}
                        onCancel={() => setModalOpen(false)}
                        onProgress={setFormProgress}
                    />
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!deleteParty}
                onOpenChange={(open) => !open && setDeleteParty(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                    </DialogHeader>

                    <DialogDescription className="py-4">
                        Are you sure you want to delete{' '}
                        <strong>{deleteParty?.name}</strong>?
                    </DialogDescription>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteParty(null)}
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
        </div>
    );
}
