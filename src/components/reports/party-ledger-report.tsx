'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Column, DataTable, DataTableFilter } from '../common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Printer, Download } from 'lucide-react';
import { formatIndianCurrency } from '@/lib/financial-year';

interface PartyLedgerEntry {
    id: string;
    transaction_date: string;
    ledger: string;
    transaction_type: string;
    credit_amount: string;
    debit_amount: string;
    party?: { name: string };
    project?: { name: string };
    against_reference?: string;
}

export function PartyLedgerReport() {
    const [data, setData] = useState<PartyLedgerEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [limit, setLimit] = useState(10);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedParty, setSelectedParty] = useState<string[]>([]);
    const [selectedProject, setSelectedProject] = useState<string[]>([]);
    const [partyOptions, setPartyOptions] = useState<Array<{ label: string; value: string }>>([]);
    const [projectOptions, setProjectOptions] = useState<Array<{ label: string; value: string }>>([]);

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
                    label: p.name,
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
            params.append('type', 'party-ledger');
            params.append('page', page.toString());
            params.append('limit', limit.toString());
            if (search) params.append('search', search);
            if (sortField) params.append('sortField', sortField);
            if (sortOrder) params.append('sortOrder', sortOrder);
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            if (selectedParty.length > 0) params.append('party_ids', selectedParty.join(','));
            if (selectedProject.length > 0) params.append('project_ids', selectedProject.join(','));

            const response = await axios.get(`/api/reports?${params.toString()}`);
            setData(response.data.data || []);
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
    }, [startDate, endDate, selectedParty, selectedProject, search, sortField, sortOrder, limit]);

    useEffect(() => {
        fetchReport(1);
    }, [startDate, endDate, selectedParty, selectedProject]);

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

    const handlePrint = () => {
        window.print();
    };

    const handleExport = () => {
        const csvContent = generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `party-ledger-report-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const generateCSV = () => {
        if (data.length === 0) return '';
        const headers = ['Date', 'Ledger', 'Party', 'Project', 'Type', 'Debit', 'Credit'];
        const rows = data.map((row) => [
            new Date(row.transaction_date).toLocaleDateString(),
            row.ledger,
            row.party?.name || '-',
            row.project?.name || '-',
            row.transaction_type,
            row.debit_amount || '0',
            row.credit_amount || '0',
        ].join(','));
        return [headers.join(','), ...rows].join('\n');
    };

    const columns = useMemo<Column<PartyLedgerEntry>[]>(() => [
        {
            header: 'Date',
            accessorKey: 'transaction_date',
            sortable: true,
            cell: (item: PartyLedgerEntry) => (
                <span className="text-sm">
                    {new Date(item.transaction_date).toLocaleDateString()}
                </span>
            ),
        },
        {
            header: 'Ledger',
            accessorKey: 'ledger',
            sortable: true,
        },
        {
            header: 'Party',
            accessorKey: 'party',
            sortable: true,
            cell: (item: PartyLedgerEntry) => item.party?.name || '-',
        },
        {
            header: 'Project',
            accessorKey: 'project',
            sortable: true,
            cell: (item: PartyLedgerEntry) => (
                <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                    {item.project?.name || '-'}
                </div>
            ),
        },
        {
            header: 'Type',
            accessorKey: 'transaction_type',
            sortable: true,
            cell: (item: PartyLedgerEntry) => (
                <Badge variant={item.transaction_type === 'CREDIT' ? 'default' : 'destructive'}>
                    {item.transaction_type}
                </Badge>
            ),
        },
        {
            header: 'Debit',
            accessorKey: 'debit_amount',
            sortable: true,
            cell: (item: PartyLedgerEntry) => {
                const amount = Number(item.debit_amount);
                return (
                    <span className="text-red-600 font-medium">
                        {amount > 0 ? `₹${formatIndianCurrency(Number(amount))}` : '-'}
                    </span>
                );
            },
        },
        {
            header: 'Credit',
            accessorKey: 'credit_amount',
            sortable: true,
            cell: (item: PartyLedgerEntry) => {
                const amount = Number(item.credit_amount);
                return (
                    <span className="text-green-600 font-medium">
                        {amount > 0 ? `₹${formatIndianCurrency(Number(amount))}` : '-'}
                    </span>
                );
            },
        },
    ], []);

    const totals = useMemo(() => ({
        totalDebit: data.reduce((sum, item) => sum + Number(item.debit_amount || 0), 0),
        totalCredit: data.reduce((sum, item) => sum + Number(item.credit_amount || 0), 0),
    }), [data]);

    return (
        <div className="flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Party Ledger Report
                    </h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-end gap-2">
                        <Button variant="outline" className='inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3 text-xs' onClick={handleExport} disabled={loading || data.length === 0}>
                            <Download className="h-4 w-4" />
                            Export
                        </Button>
                        <Button variant="outline" className='inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3 text-xs' onClick={handlePrint} disabled={loading || data.length === 0}>
                            <Printer className="h-4 w-4" />
                            Print
                        </Button>
                        <Button className='!h-8 rounded-md px-3 text-xs' onClick={() => fetchReport(1)} disabled={loading}>
                            {loading ? 'Loading...' : 'Generate Report'}
                        </Button>
                    </div>
                </div>
            </div>

            {data.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Total Debit</p>
                                <p className="text-2xl font-bold text-red-600">
                                    ₹{formatIndianCurrency(Number(totals.totalDebit))}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Total Credit</p>
                                <p className="text-2xl font-bold text-green-600">
                                    ₹{formatIndianCurrency(Number(totals.totalCredit))}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Balance</p>
                                {(totals.totalDebit - totals.totalCredit) > 0 ? (
                                    <p className="text-2xl font-bold text-red-600">
                                        ₹{formatIndianCurrency(Number(Math.abs(totals.totalDebit - totals.totalCredit)))}
                                    </p>
                                ) : (
                                    <p className="text-2xl font-bold text-green-600">
                                        ₹{formatIndianCurrency(Number(Math.abs(totals.totalDebit - totals.totalCredit)))}
                                    </p>
                                )}
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Records</p>
                                <p className="text-2xl font-bold">{pagination.total}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <DataTable
                data={data}
                columns={columns}
                loading={loading}
                pagination={pagination}
                onPageChange={handlePageChange}
                onSearch={handleSearch}
                onSortChange={handleSortChange}
                onLimitChange={handleLimitChange}
                searchPlaceholder="Search party ledger..."
                emptyMessage="No party ledger entries found."
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

                        {(selectedParty.length > 0 || selectedProject.length > 0 || startDate || endDate) && (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedParty([]);
                                        setSelectedProject([]);
                                        setStartDate('');
                                        setEndDate('');
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
        </div>
    );
}
