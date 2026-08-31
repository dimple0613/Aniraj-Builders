'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Column, DataTable, DataTableFilter } from '../common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, Wallet } from 'lucide-react';
import { ACCOUNT_TYPES } from '@/lib/constants';
import { StartBankingProcess } from './start-banking-process';

interface ReceivableEntry {
    id: string;
    partyId: string;
    partyName: string;
    total: number;
    accountNumber?: string;
    ifsc?: string;
    bankName?: string;
    email?: string;
}

export function ReceivableReport() {
    const [data, setData] = useState<ReceivableEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [limit, setLimit] = useState(10);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedParty, setSelectedParty] = useState<string[]>([]);
    const [partyOptions, setPartyOptions] = useState<Array<{ label: string; value: string }>>([]);
    const [selectedProject, setSelectedProject] = useState<string[]>([]);
    const [projectOptions, setProjectOptions] = useState<Array<{ label: string; value: string }>>([]);
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedAccountType, setSelectedAccountType] = useState('CREDIT');
    const [selectedReceivableIds, setSelectedReceivableIds] = useState<string[]>([]);
    const [bankingOpen, setBankingOpen] = useState(false);
    const [summaryTotal, setSummaryTotal] = useState(0);

    const fetchParties = useCallback(async () => {
        try {
            const response = await axios.get('/api/parties?limit=9999');
            const parties = response.data.data || response.data;
            setPartyOptions(
                (Array.isArray(parties) ? parties : []).map((p: any) => ({
                    label: p.name,
                    value: p.id,
                }))
            );
        } catch {
            toast.error('Failed to fetch parties');
        }
    }, []);

    const fetchProjects = useCallback(async () => {
        try {
            const response = await axios.get('/api/projects?limit=9999');
            const projects = response.data.data || response.data;
            setProjectOptions(
                (Array.isArray(projects) ? projects : []).map((p: any) => ({
                    label: p.unique_name || p.name,
                    value: p.id,
                }))
            );
        } catch {
            toast.error('Failed to fetch projects');
        }
    }, []);

    useEffect(() => {
        fetchParties();
        fetchProjects();
    }, [fetchParties, fetchProjects]);

    const fetchReport = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.append('type', 'receivable');
            params.append('page', page.toString());
            params.append('limit', limit.toString());
            if (search) params.append('search', search);
            if (sortField) params.append('sortField', sortField);
            if (sortOrder) params.append('sortOrder', sortOrder);
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            if (selectedParty.length > 0) params.append('party_ids', selectedParty.join(','));
            if (selectedProject.length > 0) params.append('project_ids', selectedProject.join(','));
            if (selectedMonth) params.append('month', selectedMonth);
            params.append('account_type', selectedAccountType);

            const response = await axios.get(`/api/reports?${params.toString()}`);
            const rows = response.data.data || [];
            setData(rows.map((r: any) => ({ ...r, id: r.partyId })));
            if (response.data.summary && typeof response.data.summary.totalAmount === 'number') {
                setSummaryTotal(response.data.summary.totalAmount);
            }
            if (response.data.pagination) {
                setPagination({
                    page: response.data.pagination.page,
                    totalPages: response.data.pagination.pages,
                    total: response.data.pagination.total,
                });
            }
        } catch {
            toast.error('Failed to fetch report');
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, selectedParty, selectedProject, selectedMonth, selectedAccountType, search, sortField, sortOrder, limit]);

    useEffect(() => {
        setSelectedReceivableIds([]);
        fetchReport(1);
    }, [startDate, endDate, selectedParty, selectedProject, selectedMonth, selectedAccountType]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchReport(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        fetchReport(1);
    }, [sortField, sortOrder]);

    const handleSearch = (value: string) => {
        setSearch(value);
    };

    const handleSortChange = (field: string, order: 'asc' | 'desc') => {
        setSortField(field);
        setSortOrder(order);
    };

    const handlePageChange = (page: number) => {
        fetchReport(page);
    };

    const handleLimitChange = (newLimit: number) => {
        setLimit(newLimit);
    };

    const handleExport = () => {
        const csvContent = generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `receivable-report-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const handlePayment = () => {
        if (selectedReceivableIds.length === 0) return;
        setBankingOpen(true);
    };

    const generateCSV = () => {
        if (data.length === 0) return '';
        const headers = ['Party', 'Total Amount'];
        const rows = data.map((row) => [
            row.partyName,
            row.total.toString(),
        ].join(','));
        return [headers.join(','), ...rows].join('\n');
    };

    const columns = useMemo<Column<ReceivableEntry>[]>(() => [
        {
            header: 'Party',
            accessorKey: 'partyName',
            sortable: true,
            cell: (item: ReceivableEntry) => (
                <div className="flex flex-col">
                    <span className="font-medium">{item.partyName}</span>
                    <span className="text-xs text-muted-foreground">
                        {ACCOUNT_TYPES.find((t) => t.value === selectedAccountType)?.label || selectedAccountType}
                    </span>
                </div>
            ),
        },
        {
            header: selectedAccountType === 'DEBIT' ? 'Debit Amount (Payable)' : 'Total Amount',
            accessorKey: 'total',
            sortable: true,
            cell: (item: ReceivableEntry) => (
                <span className={`font-bold ${selectedAccountType === 'DEBIT' ? 'text-red-600' : 'text-green-600'}`}>
                    ₹{item.total.toLocaleString()}
                </span>
            ),
        },
    ], [selectedAccountType]);

    const totals = useMemo(() => ({
        totalAmount: summaryTotal,
    }), [summaryTotal]);

    const isDebit = selectedAccountType === 'DEBIT';

    const selectedProjectNames = useMemo(
        () => projectOptions.filter((p) => selectedProject.includes(p.value)).map((p) => p.label),
        [projectOptions, selectedProject]
    );

    const selectedMonthName = useMemo(() => {
        if (!selectedMonth) return '';
        const [y, m] = selectedMonth.split('-').map(Number);
        if (!y || !m) return '';
        const d = new Date(y, m - 1, 1);
        const month = d.toLocaleString('en-US', { month: 'long' }).toLowerCase();
        return `${month} month`;
    }, [selectedMonth]);

    return (
        <div className="flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Receivable Report
                    </h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Button className='!h-8 rounded-md px-3 text-xs' onClick={handlePayment} disabled={selectedReceivableIds.length === 0}>
                        <Wallet className="h-4 w-4" />
                        Payment
                    </Button>
                    <div className="flex items-end gap-2">

                        <Button variant="outline" className='inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3 text-xs' onClick={handleExport} disabled={loading || data.length === 0}>
                            <Download className="h-4 w-4 " />
                            Export
                        </Button>

                    </div>
                </div>
            </div>
            {data.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Summary</CardTitle>
                    </CardHeader>

                    <CardContent className="pt-0">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">
                                    {isDebit ? 'Total Payable (Debit)' : 'Total Receivable (Credit)'}
                                </p>
                                <p className={`text-2xl font-bold ${isDebit ? 'text-red-600' : 'text-green-600'}`}>
                                    ₹{totals.totalAmount.toLocaleString()}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Parties</p>
                                <p className="text-2xl font-bold">{pagination.total}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}
            <DataTable
                data={data as any}
                columns={columns as any}
                loading={loading}
                pagination={pagination}
                onPageChange={handlePageChange}
                onSearch={handleSearch}
                onSortChange={handleSortChange}
                onLimitChange={handleLimitChange}
                searchPlaceholder="Search receivable..."
                emptyMessage="No receivable entries found."
                selectable
                onSelect={(items) => setSelectedReceivableIds(items.map((i: any) => i.id))}
                selectedItems={data.filter((r) => selectedReceivableIds.includes(r.id))}
                filters={(
                    <div className="flex flex-wrap items-center gap-2 order-[3] w-full sm:w-auto">
                        <DataTableFilter
                            title="Party"
                            options={partyOptions}
                            selectedValues={selectedParty}
                            onChange={(values) => setSelectedParty(values)}
                        />
                        <DataTableFilter
                            title="Project"
                            options={projectOptions}
                            selectedValues={selectedProject}
                            onChange={(values) => setSelectedProject(values)}
                        />






                        <div className="space-y-2">
                            <Input
                                type="month"
                                className='inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5'
                                value={selectedMonth}
                                onChange={(e) => setSelectedMonth(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">

                            <Input
                                type="date"
                                className='inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5'
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">

                            <Input
                                type="date"
                                className='inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5'
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>
                        {(selectedParty.length > 0 || selectedProject.length > 0 || selectedMonth || startDate || endDate) && (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedParty([]);
                                        setSelectedProject([]);
                                        setSelectedMonth('');
                                        setStartDate('');
                                        setEndDate('');
                                        setSelectedAccountType('CREDIT');
                                        fetchReport(1);
                                    }}
                                >
                                    Clear Filters
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            />
            <StartBankingProcess
                open={bankingOpen}
                onClose={() => setBankingOpen(false)}
                records={data.filter((r) => selectedReceivableIds.includes(r.id))}
                title="Start Banking Process"
                projectNames={selectedProjectNames}
                monthName={selectedMonthName}
            />
        </div>
    );
}
