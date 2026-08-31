'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Column, DataTable } from '../common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { BankTransactionForm } from '@/components/bank-accounts/bank-transaction-form';
import { LedgerManagement } from '@/components/bank-accounts/ledger-management';
import {
    BANK_TRANSACTION_TYPES,
    BANK_TRANSACTION_TYPE_LABELS,
    LEDGER_TYPES,
    LEDGER_TYPE_LABELS,
} from '@/lib/constants';
import { formatIndianCurrency } from '@/lib/financial-year';
import { Settings2 } from 'lucide-react';

interface BankTransaction {
    id: string;
    sr_no?: number;
    transaction_date: string;
    transaction_type: string;
    ledger: string;
    ledger_type?: string;
    account_id?: string;
    project_id?: string | null;
    party_id?: string | null;
    against_reference?: string | null;
    narration?: string;
    amount?: number;
    credit_amount: number;
    debit_amount: number;
    balance: number;
    account?: { id: string; account_name: string; account_number: string };
    project?: { id: string; name: string; unique_name?: string | null } | null;
    party?: { id: string; name: string } | null;
    createdAt?: string;
}

interface BankAccount {
    id: string;
    account_name: string;
    account_number: string;
    bank_name?: string;
    ifsc_code?: string;
}

export function BankBookClient() {
    const [data, setData] = useState<BankTransaction[]>([]);
    const [accounts, setAccounts] = useState<BankAccount[]>([]);
    const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
    const [parties, setParties] = useState<Array<{ id: string; name: string }>>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [limit, setLimit] = useState(20);
    const [page, setPage] = useState(1);
    const [selectedAccount, setSelectedAccount] = useState<string>('all');
    const [selectedLedgerType, setSelectedLedgerType] = useState<string>('all');
    const [selectedTransactionType, setSelectedTransactionType] = useState<string>('all');
    const [selectedProject, setSelectedProject] = useState<string>('all');
    const [selectedParty, setSelectedParty] = useState<string>('all');
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<BankTransaction | null>(null);
    const [deleteTransaction, setDeleteTransaction] = useState<BankTransaction | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [formProgress, setFormProgress] = useState(0);

    const [pagination, setPagination] = useState({
        page: 1,
        totalPages: 1,
        total: 0,
    });

    const [manageLedgerOpen, setManageLedgerOpen] = useState(false);

    const fetchAccounts = useCallback(async () => {
        try {
            const response = await axios.get('/api/accounts?type=BANK&limit=9999');
            setAccounts(response.data.data || []);
        } catch {
            console.error('Failed to fetch accounts');
        }
    }, []);

    const fetchProjects = useCallback(async () => {
        try {
            const response = await axios.get('/api/projects?limit=9999');
            setProjects(response.data.data || []);
        } catch {
            console.error('Failed to fetch projects');
        }
    }, []);

    const fetchParties = useCallback(async () => {
        try {
            const response = await axios.get('/api/parties?limit=9999');
            setParties(response.data.data || []);
        } catch {
            console.error('Failed to fetch parties');
        }
    }, []);

    const fetchData = useCallback(async (
        pageNum = 1,
        searchValue = search,
        sort = sortField,
        order = sortOrder,
        pageLimit = limit,
        accountId = selectedAccount,
        projectId = selectedProject,
        partyId = selectedParty,
        startDate = dateRange.start,
        endDate = dateRange.end
    ) => {
        try {
            setLoading(true);

            const params = new URLSearchParams();
            params.append('page', pageNum.toString());
            params.append('limit', pageLimit.toString());
            if (searchValue) params.append('search', searchValue);
            if (sort) params.append('sortField', sort);
            if (order) params.append('sortOrder', order);
            if (accountId && accountId !== 'all') params.append('account_id', accountId);
            if (selectedLedgerType && selectedLedgerType !== 'all') params.append('ledger_type', selectedLedgerType);
            if (selectedTransactionType && selectedTransactionType !== 'all') params.append('transaction_type', selectedTransactionType);
            if (projectId && projectId !== 'all') params.append('project_id', projectId);
            if (partyId && partyId !== 'all') params.append('party_id', partyId);
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);

            const response = await axios.get(`/api/bank-transactions?${params.toString()}`);
            setData(response.data.data);
            setPagination({
                page: response.data.pagination.page,
                totalPages: response.data.pagination.pages,
                total: response.data.pagination.total,
            });
        } catch {
            toast.error('Failed to fetch bank transactions');
        } finally {
            setLoading(false);
        }
    }, [search, sortField, sortOrder, limit, selectedAccount, selectedLedgerType, selectedTransactionType, selectedProject, selectedParty, dateRange]);

    useEffect(() => {
        fetchAccounts();
        fetchProjects();
        fetchParties();
    }, [fetchAccounts, fetchProjects, fetchParties]);

    useEffect(() => {
        fetchData(1);
    }, [search, sortField, sortOrder, limit, selectedAccount, selectedLedgerType, selectedTransactionType, selectedProject, selectedParty, dateRange]);

    const handleEdit = (transaction: BankTransaction) => {
        setEditingTransaction(transaction);
        setModalOpen(true);
    };

    const handleAdd = () => {
        setEditingTransaction(null);
        setModalOpen(true);
    };

    const handleDelete = (transaction: BankTransaction) => {
        setDeleteTransaction(transaction);
    };

    const confirmDelete = async () => {
        if (!deleteTransaction) return;

        try {
            setDeleteLoading(true);
            await axios.delete(`/api/bank-transactions/${deleteTransaction.id}`);
            toast.success('Transaction deleted successfully');
            fetchData(pagination.page);
            setDeleteTransaction(null);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete transaction');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleSuccess = () => {
        setModalOpen(false);
        setEditingTransaction(null);
        fetchData(pagination.page);
    };

    const columns = useMemo<Column<BankTransaction>[]>(() => {
        return [
            {
                header: 'SR No.',
                accessorKey: 'sr_no',
                sortable: true,
                cell: (transaction: BankTransaction) => (
                    <span className="font-medium">{transaction.sr_no}</span>
                ),
            },
            {
                header: 'Date',
                accessorKey: 'transaction_date',
                sortable: true,
                cell: (transaction: BankTransaction) => (
                    <span className="text-sm">
                        {new Date(transaction.transaction_date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                        })}
                    </span>
                ),
            },
            {
                header: 'Account',
                cell: (transaction: BankTransaction) => (
                    <div className="text-sm">
                        <div className="font-medium">{transaction.account?.account_name || '-'}</div>
                        <div className="text-xs text-muted-foreground">{transaction.account?.account_number || ''}</div>
                    </div>
                ),
            },
            {
                header: 'Type',
                accessorKey: 'transaction_type',
                sortable: true,
                cell: (transaction: BankTransaction) => (
                    <Badge variant={transaction.transaction_type === 'CREDIT' ? 'default' : 'destructive'}>
                        {BANK_TRANSACTION_TYPE_LABELS[transaction.transaction_type] || transaction.transaction_type}
                    </Badge>
                ),
            },
            {
                header: 'Ledger',
                accessorKey: 'ledger',
                sortable: true,
                cell: (transaction: BankTransaction) => (
                    <div>
                        <span className="font-medium">{transaction.ledger}</span>
                        {transaction.ledger_type && (
                            <div className="text-xs text-muted-foreground">
                                {LEDGER_TYPE_LABELS[transaction.ledger_type] || transaction.ledger_type}
                            </div>
                        )}
                    </div>
                ),
            },
            {
                header: 'Project',
                cell: (transaction: BankTransaction) => (
                    <div className="text-sm text-muted-foreground">
                        {transaction.project?.unique_name || transaction.project?.name || '-'}
                    </div>
                ),
            },
            {
                header: 'Party',
                accessorKey: 'party',
                cell: (transaction: BankTransaction) => (
                    <span className="text-sm">{transaction.party?.name || '-'}</span>
                ),
            },
            {
                header: 'Against',
                accessorKey: 'against_reference',
                cell: (transaction: BankTransaction) => (
                    <span className="text-sm text-muted-foreground">
                        {transaction.against_reference || '-'}
                    </span>
                ),
            },
            {
                header: 'Debit (₹)',
                accessorKey: 'debit_amount',
                sortable: true,
                cell: (transaction: BankTransaction) => (
                    <span className={transaction.debit_amount > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                        {transaction.debit_amount > 0
                            ? `₹${formatIndianCurrency(Number(transaction.debit_amount))}`
                            : '-'}
                    </span>
                ),
            },
            {
                header: 'Credit (₹)',
                accessorKey: 'credit_amount',
                sortable: true,
                cell: (transaction: BankTransaction) => (
                    <span className={transaction.credit_amount > 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                        {transaction.credit_amount > 0
                            ? `₹${formatIndianCurrency(Number(transaction.credit_amount))}`
                            : '-'}
                    </span>
                ),
            },
            {
                header: 'Running Balance (₹)',
                accessorKey: 'balance',
                sortable: true,
                cell: (transaction: BankTransaction) => (
                    <span className={`font-semibold ${transaction.balance >= 0 ? 'text-green-700' : 'text-red-700'
                        }`}>
                        ₹{formatIndianCurrency(Number(transaction.balance))}
                    </span>
                ),
            },
            {
                header: 'Narration',
                accessorKey: 'narration',
                cell: (transaction: BankTransaction) => (
                    <span className="text-sm text-muted-foreground max-w-[150px] truncate block" title={transaction.narration || ''}>
                        {transaction.narration || '-'}
                    </span>
                ),
            },
        ];
    }, []);

    const ACCOUNT_OPTIONS = useMemo(() => [
        { label: 'All Accounts', value: 'all' },
        ...accounts.map((a) => ({
            label: `${a.account_name} (${a.account_number})`,
            value: a.id,
        })),
    ], [accounts]);

    const hasFilters = selectedAccount !== 'all' || selectedLedgerType !== 'all' || selectedTransactionType !== 'all' || selectedProject !== 'all' || selectedParty !== 'all' || dateRange.start || dateRange.end;

    return (
        <div className="flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Bank Book
                    </h2>
                    {/* {data.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Current Balance:
              <span className={`ml-1 font-semibold ${data[0]?.balance >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                ₹{data[0]?.balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </p>
          )} */}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setManageLedgerOpen(true)}
                    className="gap-1.5"
                >
                    <Settings2 className="h-4 w-4" />
                    Manage Ledger
                </Button>
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
                searchPlaceholder="Search transactions..."
                addLabel="Add Transaction"
                emptyMessage="No transactions found."
                filters={
                    <div className="flex flex-wrap items-center gap-2 order-[4] w-full sm:w-auto">
                        <Select
                            value={selectedAccount}
                            onValueChange={(value) => {
                                setSelectedAccount(value);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="inline-flex items-left justify-start whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5 w-[120px]">
                                <SelectValue placeholder="Account" />
                            </SelectTrigger>
                            <SelectContent>
                                {ACCOUNT_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={selectedTransactionType}
                            onValueChange={(value) => {
                                setSelectedTransactionType(value);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="inline-flex items-left justify-start whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5 w-[100px]">
                                <SelectValue placeholder="Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Types</SelectItem>
                                {BANK_TRANSACTION_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={selectedLedgerType}
                            onValueChange={(value) => {
                                setSelectedLedgerType(value);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="inline-flex items-left justify-start whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5 w-[112px]">
                                <SelectValue placeholder="Ledger" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Ledgers</SelectItem>
                                {LEDGER_TYPES.map((type) => (
                                    <SelectItem key={type.value} value={type.value}>
                                        {type.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={selectedProject}
                            onValueChange={(value) => {
                                setSelectedProject(value);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="inline-flex items-left justify-start whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5 w-[112px]">
                                <SelectValue placeholder="Project" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Projects</SelectItem>
                                {projects.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.unique_name || p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={selectedParty}
                            onValueChange={(value) => {
                                setSelectedParty(value);
                                setPage(1);
                            }}
                        >
                            <SelectTrigger className="inline-flex items-left justify-start whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5 w-[105px]">
                                <SelectValue placeholder="Party" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Parties</SelectItem>
                                {parties.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                        {p.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <div className="flex items-center gap-1">
                            <Input
                                type="date"
                                value={dateRange.start}
                                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                                className="items-center py-2 ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed [&>span]:line-clamp-1 inline-flex items-left justify-start whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5 "
                                placeholder="Start"
                            />
                            <span className="text-muted-foreground">-</span>
                            <Input
                                type="date"
                                value={dateRange.end}
                                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                                className="items-center py-2 ring-offset-background data-[placeholder]:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed [&>span]:line-clamp-1 inline-flex items-left justify-start whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5 "
                                placeholder="End"
                            />
                        </div>

                        {hasFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setSelectedAccount('all');
                                    setSelectedLedgerType('all');
                                    setSelectedTransactionType('all');
                                    setSelectedProject('all');
                                    setSelectedParty('all');
                                    setDateRange({ start: '', end: '' });
                                    setPage(1);
                                }}
                                className="h-8 px-2 text-muted-foreground"
                            >
                                Clear Filters
                            </Button>
                        )}
                    </div>
                }
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
                            {editingTransaction ? 'Edit Transaction' : 'Add New Transaction'}
                        </DialogTitle>
                    </DialogHeader>
                    <BankTransactionForm
                        transaction={editingTransaction as any}
                        accountId={selectedAccount !== 'all' ? selectedAccount : undefined}
                        onSuccess={handleSuccess}
                        onCancel={() => setModalOpen(false)}
                        onProgress={setFormProgress}
                    />
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!deleteTransaction}
                onOpenChange={(open) => !open && setDeleteTransaction(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                    </DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to delete this transaction? This action will recalculate the running balance for subsequent transactions.
                    </DialogDescription>
                    <div className="flex justify-end gap-2">
                        <Button
                            variant="outline"
                            onClick={() => setDeleteTransaction(null)}
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
                    </div>
                </DialogContent>
            </Dialog>

            <LedgerManagement
                open={manageLedgerOpen}
                onClose={() => setManageLedgerOpen(false)}
            />
        </div>
    );
}
