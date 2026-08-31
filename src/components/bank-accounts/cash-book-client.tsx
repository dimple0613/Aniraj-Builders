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
import { CashTransactionForm } from '@/components/bank-accounts/cash-transaction-form';
import { LedgerManagement } from '@/components/bank-accounts/ledger-management';
import { Download, Filter, RefreshCw, Settings2 } from 'lucide-react';
import { formatIndianCurrency } from '@/lib/financial-year';

interface CashBook {
    id: string;
    cash_name: string;
    code: string;
    opening_balance: number;
}

interface CashTransaction {
    id: string;
    sr_no: number;
    cash_book_id: string;
    transaction_date: string;
    transaction_type: string;
    ledger: string;
    project_id?: string | null;
    party_id?: string | null;
    particular?: string | null;
    credit_amount: number;
    debit_amount: number;
    balance: number;
    cashBook?: { id: string; cash_name: string; code: string };
    project?: { id: string; name: string; unique_name?: string | null } | null;
    party?: { id: string; name: string } | null;
    createdAt: string;
}

interface DailySummary {
    date: string;
    totalReceipt: number;
    totalPayment: number;
    netFlow: number;
}

export function CashBookClient() {
    const [data, setData] = useState<CashTransaction[]>([]);
    const [cashBooks, setCashBooks] = useState<CashBook[]>([]);
    const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [limit, setLimit] = useState(50);
    const [selectedCashBook, setSelectedCashBook] = useState<string>('all');
    const [selectedProject, setSelectedProject] = useState<string>('all');
    const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
    const [showDailySummary, setShowDailySummary] = useState(true);
    const [dailySummary, setDailySummary] = useState<DailySummary[]>([]);
    const [currentBalance, setCurrentBalance] = useState<number>(0);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingTransaction, setEditingTransaction] = useState<CashTransaction | null>(null);
    const [deleteTransaction, setDeleteTransaction] = useState<CashTransaction | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [formProgress, setFormProgress] = useState(0);
    const [manageLedgerOpen, setManageLedgerOpen] = useState(false);

    const [pagination, setPagination] = useState({
        page: 1,
        totalPages: 1,
        total: 0,
    });

    const fetchCashBooks = useCallback(async () => {
        try {
            const response = await axios.get('/api/accounts?type=CASH&limit=9999');
            const cashAccounts = (response.data.data || []).map((acc: any) => ({
                id: acc.id,
                cash_name: acc.cash_name,
                code: acc.cash_name?.substring(0, 2).toUpperCase() || 'CA',
                opening_balance: acc.opening_balance,
            }));
            setCashBooks(cashAccounts);

            if (cashAccounts.length === 1 && selectedCashBook === 'all') {
                setSelectedCashBook(cashAccounts[0].id);
            }
        } catch {
            console.error('Failed to fetch cash accounts');
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

    const fetchData = useCallback(async (
        pageNum = 1,
        pageLimit = limit,
        cashBookId = selectedCashBook,
        projectFilter = selectedProject,
        startDate = dateRange.start,
        endDate = dateRange.end,
        daily = showDailySummary
    ) => {
        try {
            setLoading(true);

            const params = new URLSearchParams();
            params.append('page', pageNum.toString());
            params.append('limit', pageLimit.toString());
            params.append('daily_summary', daily.toString());

            if (cashBookId && cashBookId !== 'all') params.append('account_id', cashBookId);
            if (projectFilter && projectFilter !== 'all') params.append('project_id', projectFilter);
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            if (search) params.append('search', search);
            if (sortField) params.append('sortField', sortField);
            if (sortOrder) params.append('sortOrder', sortOrder);

            const response = await axios.get(`/api/cash-transactions?${params.toString()}`);

            setData(response.data.data || []);
            setDailySummary(response.data.dailySummary || []);

            if (response.data.cashBooksBalance) {
                const balanceKey = selectedCashBook !== 'all' ? selectedCashBook : Object.keys(response.data.cashBooksBalance)[0];
                setCurrentBalance(response.data.cashBooksBalance[balanceKey] || 0);
            }

            setPagination({
                page: response.data.pagination.page,
                totalPages: response.data.pagination.pages,
                total: response.data.pagination.total,
            });
        } catch {
            toast.error('Failed to fetch cash transactions');
        } finally {
            setLoading(false);
        }
    }, [search, sortField, sortOrder, limit, selectedCashBook, selectedProject, dateRange, showDailySummary]);

    useEffect(() => {
        fetchCashBooks();
        fetchProjects();
    }, [fetchCashBooks, fetchProjects]);

    useEffect(() => {

        fetchData(1);

    }, [search, sortField, sortOrder, limit, selectedCashBook, selectedProject, dateRange, showDailySummary]);

    const handleEdit = (transaction: CashTransaction) => {
        setEditingTransaction(transaction);
        setModalOpen(true);
    };

    const handleAdd = () => {
        setEditingTransaction(null);
        setModalOpen(true);
    };

    const handleDelete = (transaction: CashTransaction) => {
        setDeleteTransaction(transaction);
    };

    const confirmDelete = async () => {
        if (!deleteTransaction) return;

        try {
            setDeleteLoading(true);
            await axios.delete(`/api/cash-transactions/${deleteTransaction.id}`);
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

    const columns = useMemo<Column<CashTransaction>[]>(() => {
        return [
            {
                header: 'SR',
                accessorKey: 'sr_no',
                sortable: true,
                cell: (t: CashTransaction) => <span className="font-medium">{t.sr_no}</span>,
            },
            {
                header: 'Date',
                accessorKey: 'transaction_date',
                sortable: true,
                cell: (t: CashTransaction) => (
                    <span className="text-sm">
                        {new Date(t.transaction_date).toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                        })}
                    </span>
                ),
            },
            {
                header: 'Type',
                accessorKey: 'transaction_type',
                sortable: true,
                cell: (t: CashTransaction) => (
                    <Badge variant={t.transaction_type === 'CREDIT' ? 'default' : 'destructive'}>
                        {t.transaction_type === 'CREDIT' ? 'Receipt' : 'Payment'}
                    </Badge>
                ),
            },
            {
                header: 'Ledger',
                accessorKey: 'ledger',
                sortable: true,
                cell: (t: CashTransaction) => <span className="font-medium">{t.ledger}</span>,
            },
            {
                header: 'Project',
                cell: (t: CashTransaction) => (
                    <div className="text-sm text-muted-foreground">
                        {t.project?.unique_name || t.project?.name || '-'}
                    </div>
                ),
            },
            {
                header: 'Party',
                cell: (t: CashTransaction) => (
                    <span className="text-sm">{t.party?.name || '-'}</span>
                ),
            },
            {
                header: 'Particular',
                accessorKey: 'particular',
                cell: (t: CashTransaction) => (
                    <span className="text-sm text-muted-foreground max-w-[150px] truncate block" title={t.particular || ''}>
                        {t.particular || '-'}
                    </span>
                ),
            },
            {
                header: 'Debit (₹)',
                accessorKey: 'debit_amount',
                sortable: true,
                cell: (t: CashTransaction) => (
                    <span className={t.debit_amount > 0 ? 'text-red-600 font-medium' : 'text-muted-foreground'}>
                        {t.debit_amount > 0
                            ? `₹${formatIndianCurrency(Number(t.debit_amount))}`
                            : '-'}
                    </span>
                ),
            },
            {
                header: 'Credit (₹)',
                accessorKey: 'credit_amount',
                sortable: true,
                cell: (t: CashTransaction) => (
                    <span className={t.credit_amount > 0 ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                        {t.credit_amount > 0
                            ? `₹${formatIndianCurrency(Number(t.credit_amount))}`
                            : '-'}
                    </span>
                ),
            },
            {
                header: 'Running Balance (₹)',
                accessorKey: 'balance',
                sortable: true,
                cell: (t: CashTransaction) => (
                    <span className={`font-semibold ${t.balance >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                        ₹{formatIndianCurrency(Number(t.balance))}
                    </span>
                ),
            },
        ];
    }, []);

    const totalReceipts = useMemo(() =>
        data.reduce((sum, t) => sum + (t.credit_amount || 0), 0),
        [data]);

    const totalPayments = useMemo(() =>
        data.reduce((sum, t) => sum + (t.debit_amount || 0), 0),
        [data]);

    const hasFilters = selectedCashBook !== 'all' || selectedProject !== 'all' || dateRange.start || dateRange.end;

    return (
        <div className="flex flex-col gap-4 md:gap-6 w-full">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Cash Book
                    </h2>
                    {selectedCashBook !== 'all' && (
                        <p className="text-sm text-muted-foreground">
                            Current Balance:
                            <span className={`ml-1 font-semibold ${currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ₹{currentBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                            </span>
                        </p>
                    )}
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

            {/* Daily Summary Card */}
            {showDailySummary && dailySummary.length > 0 && (
                <div className="bg-white border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold flex items-center gap-2">
                            <Filter className="h-4 w-4" />
                            Daily Summary
                        </h3>
                        <Button variant="ghost" size="sm" onClick={() => setShowDailySummary(false)}>
                            Hide
                        </Button>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b bg-gray-50">
                                    <th className="text-left py-2 px-3 font-medium">Date</th>
                                    <th className="text-right py-2 px-3 font-medium text-green-600">Receipt (₹)</th>
                                    <th className="text-right py-2 px-3 font-medium text-red-600">Payment (₹)</th>
                                    <th className="text-right py-2 px-3 font-medium">Net Flow (₹)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {dailySummary.map((day, idx) => (
                                    <tr key={idx} className="border-b hover:bg-gray-50">
                                        <td className="py-2 px-3">
                                            {new Date(day.date).toLocaleDateString('en-GB', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric',
                                            })}
                                        </td>
                                        <td className="text-right py-2 px-3 text-green-600 font-medium">
                                            ₹{day.totalReceipt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="text-right py-2 px-3 text-red-600 font-medium">
                                            ₹{day.totalPayment.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className={`text-right py-2 px-3 font-semibold ${day.netFlow >= 0 ? 'text-green-700' : 'text-red-700'
                                            }`}>
                                            {day.netFlow >= 0 ? '+' : ''}₹{day.netFlow.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-100 font-semibold">
                                    <td className="py-2 px-3">TOTAL</td>
                                    <td className="text-right py-2 px-3 text-green-600">
                                        ₹{totalReceipts.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className="text-right py-2 px-3 text-red-600">
                                        ₹{totalPayments.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                    <td className={`text-right py-2 px-3 ${(totalReceipts - totalPayments) >= 0 ? 'text-green-700' : 'text-red-700'
                                        }`}>
                                        {((totalReceipts - totalPayments) >= 0 ? '+' : '')}₹{(totalReceipts - totalPayments).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {!showDailySummary && (
                <Button variant="outline" size="sm" onClick={() => setShowDailySummary(true)}>
                    Show Daily Summary
                </Button>
            )}

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
                    <div className="flex flex-wrap items-center gap-2 order-[3] w-full sm:w-auto">
                        <Select
                            value={selectedCashBook}
                            onValueChange={(value) => {
                                setSelectedCashBook(value);
                                setPagination(prev => ({ ...prev, page: 1 }));
                            }}
                        >
                            <SelectTrigger className="inline-flex items-left justify-start whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5 w-[133px]">
                                <SelectValue placeholder="Cash Book" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Cash Books</SelectItem>
                                {cashBooks.map((cb) => (
                                    <SelectItem key={cb.id} value={cb.id}>
                                        {cb.cash_name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select
                            value={selectedProject}
                            onValueChange={(value) => {
                                setSelectedProject(value);
                                setPagination(prev => ({ ...prev, page: 1 }));
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
                                    setSelectedCashBook('all');
                                    setSelectedProject('all');
                                    setDateRange({ start: '', end: '' });
                                    setPagination(prev => ({ ...prev, page: 1 }));
                                }}
                                className="h-8 px-2 text-muted-foreground"
                            >
                                <RefreshCw className="h-4 w-4 mr-1" />
                                Clear
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
                    <CashTransactionForm
                        transaction={editingTransaction as any}
                        cashBookId={selectedCashBook !== 'all' ? selectedCashBook : undefined}
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
                        Are you sure you want to delete this transaction? This will recalculate the running balance.
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
