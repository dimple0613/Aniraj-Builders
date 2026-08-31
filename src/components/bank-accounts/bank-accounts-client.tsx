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
import { BankAccountForm } from './bank-account-form';
import { formatIndianCurrency } from '@/lib/financial-year';

interface BankAccount {
    id: string;
    type: string;
    account_name: string | null;
    cash_name: string | null;
    account_number: string | null;
    bank_name: string | null;
    ifsc_code: string | null;
    opening_balance: number;
    current_balance?: number;
    is_active: boolean;
    createdAt: string;
}

export function BankAccountsClient() {
    const [data, setData] = useState<BankAccount[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
    const [filterStatus, setFilterStatus] = useState<string[]>([]);
    const [filterType, setFilterType] = useState<string[]>([]);
    const [deleteAccount, setDeleteAccount] = useState<BankAccount | null>(null);
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
        statusFilter = filterStatus,
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
            if (statusFilter.length > 0) params.append('is_active', statusFilter[0] === 'Active' ? 'true' : 'false');
            if (typeFilter.length > 0) params.append('type', typeFilter.join(','));

            const response = await axios.get(`/api/accounts?${params.toString()}`);
            setData(response.data.data);
            setPagination({
                page: response.data.pagination.page,
                totalPages: response.data.pagination.pages,
                total: response.data.pagination.total,
            });
        } catch {
            toast.error('Failed to fetch accounts');
        } finally {
            setLoading(false);
        }
    }, [search, sortField, sortOrder, limit, filterStatus, filterType]);

    useEffect(() => {
        fetchData(1);
    }, [search, sortField, sortOrder, limit, filterStatus, filterType]);

    const handleEdit = (account: BankAccount) => {
        setEditingAccount(account);
        setModalOpen(true);
    };

    const handleAdd = () => {
        setEditingAccount(null);
        setModalOpen(true);
    };

    const handleDelete = (account: BankAccount) => {
        setDeleteAccount(account);
    };

    const confirmDelete = async () => {
        if (!deleteAccount) return;

        try {
            setDeleteLoading(true);
            await axios.delete(`/api/accounts/${deleteAccount.id}`);
            toast.success('Account deleted successfully');
            fetchData(pagination.page);
            setDeleteAccount(null);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete account');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleSuccess = () => {
        setModalOpen(false);
        setEditingAccount(null);
        fetchData(pagination.page);
    };

    const columns = useMemo<Column<BankAccount>[]>(() => {
        return [
            {
                header: 'Type',
                accessorKey: 'type',
                sortable: true,
                cell: (account: BankAccount) => (
                    <Badge variant={account.type === 'BANK' ? 'default' : 'secondary'}>
                        {account.type}
                    </Badge>
                ),
            },
            {
                header: 'Account Name',
                accessorKey: 'account_name',
                sortable: true,
                cell: (account: BankAccount) => (
                    <div className="flex flex-col">
                        <span className="font-medium">
                            {account.type === 'BANK' ? account.account_name : account.cash_name}
                        </span>
                        {account.type === 'BANK' && (
                            <span className="text-xs text-muted-foreground font-mono">
                                {account.account_number}
                            </span>
                        )}
                    </div>
                ),
            },
            {
                header: 'Bank Name',
                accessorKey: 'bank_name',
                sortable: true,
                cell: (account: BankAccount) => account.type === 'BANK' ? account.bank_name : '-',
            },
            {
                header: 'IFSC Code',
                accessorKey: 'ifsc_code',
                sortable: false,
                cell: (account: BankAccount) => (
                    <span >{account.type === 'BANK' ? (account.ifsc_code || '-') : '-'}</span>
                ),
            },
            {
                header: 'Opening Balance',
                accessorKey: 'opening_balance',
                sortable: true,
                cell: (account: BankAccount) => (
                    <span className="font-medium">₹{formatIndianCurrency(Number(account.opening_balance))}</span>
                ),
            },
            {
                header: 'Current Balance',
                accessorKey: 'current_balance',
                sortable: true,
                cell: (account: BankAccount) => {
                    const balance = account.current_balance ?? account.opening_balance;
                    return (
                        <span className={`font-bold ${Number(balance) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ₹{formatIndianCurrency(Number(balance))}
                        </span>
                    );
                },
            },
            {
                header: 'Status',
                accessorKey: 'is_active',
                sortable: true,
                cell: (account: BankAccount) => (
                    <Badge variant={account.is_active ? 'default' : 'secondary'}>
                        {account.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                ),
            },
        ];
    }, []);

    const STATUS_OPTIONS = [
        { label: 'Active', value: 'Active' },
        { label: 'Inactive', value: 'Inactive' },
    ];

    const TYPE_OPTIONS = [
        { label: 'Bank', value: 'BANK' },
        { label: 'Cash', value: 'CASH' },
    ];

    return (
        <div className="flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Accounts
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
                searchPlaceholder="Search accounts..."
                addLabel="Add Account"
                emptyMessage="No accounts found."
                filters={(
                    <div className="flex flex-wrap items-center gap-2 order-[3] w-full sm:w-auto">
                        <DataTableFilter
                            title="Type"
                            options={TYPE_OPTIONS}
                            selectedValues={filterType}
                            onChange={(values) => setFilterType(values)}
                        />

                        <DataTableFilter
                            title="Status"
                            options={STATUS_OPTIONS}
                            selectedValues={filterStatus}
                            onChange={(values) => setFilterStatus(values)}
                        />

                        {(filterStatus.length > 0 || filterType.length > 0) && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setFilterStatus([]);
                                    setFilterType([]);
                                }}
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
                            {editingAccount ? 'Edit Account' : 'Add New Account'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingAccount
                                ? 'Update the account details below.'
                                : 'Fill in the details to create a new account.'}
                        </DialogDescription>
                    </DialogHeader>
                    <BankAccountForm
                        account={editingAccount}
                        onSuccess={handleSuccess}
                        onCancel={() => setModalOpen(false)}
                        onProgress={setFormProgress}
                    />
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!deleteAccount}
                onOpenChange={(open) => !open && setDeleteAccount(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                    </DialogHeader>

                    <DialogDescription className="py-4">
                        Are you sure you want to delete{' '}
                        <strong>{deleteAccount?.type === 'BANK' ? deleteAccount?.account_name : deleteAccount?.cash_name}</strong>?
                    </DialogDescription>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteAccount(null)}
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
