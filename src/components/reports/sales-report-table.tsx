'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Column, DataTable } from '../common';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download } from 'lucide-react';
import { formatIndianCurrency } from '@/lib/financial-year';

interface SalesRow {
    id: string;
    srNo: number;
    partyName: string;
    date: string;
    invoiceNo: string;
    workName: string;
    basicAmount: number;
    cgst: number;
    sgst: number;
    total: number;
    deductionIt: number;
    deductionLabourCess: number;
    deductionCgstTds: number;
    deductionSgstTds: number;
    totalDeductions: number;
    netAmount: number;
}

export function SalesReportTable() {
    const [data, setData] = useState<SalesRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalRecords, setTotalRecords] = useState(0);

    const fetchReport = useCallback(async (p?: number) => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.append('page', String(p ?? page));
            params.append('limit', '50');
            if (search) params.append('search', search);
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);

            const response = await axios.get(`/api/reports/sales?${params.toString()}`);
            const result = response.data;
            setData(result.data || []);
            if (result.pagination) {
                setTotalPages(result.pagination.pages || 1);
                setTotalRecords(result.pagination.total || 0);
            }
        } catch {
            toast.error('Failed to fetch sales report');
        } finally {
            setLoading(false);
        }
    }, [page, search, startDate, endDate]);

    useEffect(() => {
        fetchReport();
    }, [fetchReport]);

    const handleSearch = useCallback((value: string) => {
        setSearch(value);
        setPage(1);
    }, []);

    const handlePageChange = useCallback((newPage: number) => {
        setPage(newPage);
    }, []);

    const handleExport = () => {
        if (data.length === 0) return;
        const headers = [
            'SR No', 'Party Name', 'Date', 'Invoice No', 'Work Name',
            'Basic Amount', 'CGST', 'SGST', 'Total',
            'Income Tax', 'Labour Cess', 'CGST (TDS)', 'SGST (TDS)',
            'Net Amount'
        ];
        const rows = data.map((row) => [
            row.srNo, row.partyName, new Date(row.date).toLocaleDateString(), row.invoiceNo, row.workName,
            row.basicAmount, row.cgst, row.sgst, row.total,
            row.deductionIt, row.deductionLabourCess, row.deductionCgstTds, row.deductionSgstTds,
            row.netAmount
        ].join(','));
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `sales-report-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const columns = useMemo<Column<SalesRow>[]>(() => [
        { header: 'SR No', accessorKey: 'srNo', width: '60px' },
        { header: 'Party Name', accessorKey: 'partyName', minWidth: '150px' },
        {
            header: 'Date',
            accessorKey: 'date',
            cell: (item: SalesRow) => (
                <span className="text-sm whitespace-nowrap">
                    {new Date(item.date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
            ),
        },
        { header: 'Invoice No', accessorKey: 'invoiceNo', minWidth: '120px' },
        { header: 'Work Name', accessorKey: 'workName', minWidth: '200px' },
        {
            header: 'Basic Amount',
            accessorKey: 'basicAmount',
            cell: (item: SalesRow) => (
                <span className="font-medium tabular-nums">₹{formatIndianCurrency(item.basicAmount)}</span>
            ),
        },
        {
            header: 'CGST',
            accessorKey: 'cgst',
            cell: (item: SalesRow) => (
                <span className="tabular-nums">₹{formatIndianCurrency(item.cgst)}</span>
            ),
        },
        {
            header: 'SGST',
            accessorKey: 'sgst',
            cell: (item: SalesRow) => (
                <span className="tabular-nums">₹{formatIndianCurrency(item.sgst)}</span>
            ),
        },
        {
            header: 'Total',
            accessorKey: 'total',
            cell: (item: SalesRow) => (
                <span className="font-semibold tabular-nums">₹{formatIndianCurrency(item.total)}</span>
            ),
        },
        {
            header: 'Income Tax',
            accessorKey: 'deductionIt',
            cell: (item: SalesRow) => (
                <span className="tabular-nums text-red-600">₹{formatIndianCurrency(item.deductionIt)}</span>
            ),
        },
        {
            header: 'Labour Cess',
            accessorKey: 'deductionLabourCess',
            cell: (item: SalesRow) => (
                <span className="tabular-nums text-red-600">₹{formatIndianCurrency(item.deductionLabourCess)}</span>
            ),
        },
        {
            header: 'CGST (TDS)',
            accessorKey: 'deductionCgstTds',
            cell: (item: SalesRow) => (
                <span className="tabular-nums text-red-600">₹{formatIndianCurrency(item.deductionCgstTds)}</span>
            ),
        },
        {
            header: 'SGST (TDS)',
            accessorKey: 'deductionSgstTds',
            cell: (item: SalesRow) => (
                <span className="tabular-nums text-red-600">₹{formatIndianCurrency(item.deductionSgstTds)}</span>
            ),
        },
        {
            header: 'Net Amount',
            accessorKey: 'netAmount',
            cell: (item: SalesRow) => (
                <span className="font-bold tabular-nums text-emerald-600">₹{formatIndianCurrency(item.netAmount)}</span>
            ),
        },
    ], []);

    const totals = useMemo(() => {
        return data.reduce((acc, row) => ({
            basicAmount: acc.basicAmount + row.basicAmount,
            cgst: acc.cgst + row.cgst,
            sgst: acc.sgst + row.sgst,
            total: acc.total + row.total,
            deductionIt: acc.deductionIt + row.deductionIt,
            deductionLabourCess: acc.deductionLabourCess + row.deductionLabourCess,
            deductionCgstTds: acc.deductionCgstTds + row.deductionCgstTds,
            deductionSgstTds: acc.deductionSgstTds + row.deductionSgstTds,
            totalDeductions: acc.totalDeductions + row.totalDeductions,
            netAmount: acc.netAmount + row.netAmount,
        }), {
            basicAmount: 0, cgst: 0, sgst: 0, total: 0,
            deductionIt: 0, deductionLabourCess: 0, deductionCgstTds: 0, deductionSgstTds: 0,
            totalDeductions: 0, netAmount: 0,
        });
    }, [data]);

    return (
        <div className="flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Sales Report
                    </h2>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={handleExport} disabled={loading || data.length === 0}>
                        <Download className="h-4 w-4 mr-2" />
                        Export CSV
                    </Button>
                </div>
            </div>

            {data.length > 0 && (
                <div className="space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        <Card className="flex flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
                            <span className="text-[10px] text-muted-foreground truncate">Basic Amount</span>
                            <div className="text-lg font-bold tabular-nums">₹{formatIndianCurrency(totals.basicAmount)}</div>
                        </Card>
                        <Card className="flex flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
                            <span className="text-[10px] text-muted-foreground truncate">CGST</span>
                            <div className="text-lg font-bold tabular-nums text-blue-600">₹{formatIndianCurrency(totals.cgst)}</div>
                        </Card>
                        <Card className="flex flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
                            <span className="text-[10px] text-muted-foreground truncate">SGST</span>
                            <div className="text-lg font-bold tabular-nums text-purple-600">₹{formatIndianCurrency(totals.sgst)}</div>
                        </Card>
                        <Card className="flex flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
                            <span className="text-[10px] text-muted-foreground truncate">Gross Total</span>
                            <div className="text-lg font-bold tabular-nums">₹{formatIndianCurrency(totals.total)}</div>
                        </Card>
                        <Card className="flex flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
                            <span className="text-[10px] text-muted-foreground truncate">Deductions</span>
                            <div className="text-lg font-bold tabular-nums text-red-600">₹{formatIndianCurrency(totals.totalDeductions)}</div>
                        </Card>
                        <Card className="flex flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground shadow-sm">
                            <span className="text-[10px] text-muted-foreground truncate">Net Amount</span>
                            <div className="text-lg font-bold tabular-nums text-emerald-600">₹{formatIndianCurrency(totals.netAmount)}</div>
                        </Card>
                    </div>
                </div>
            )}

            <DataTable
                data={data}
                columns={columns}
                loading={loading}
                searchPlaceholder="Search by invoice no, party name..."
                emptyMessage="No sales invoices found."
                onSearch={handleSearch}
                pagination={{ page, totalPages, total: totalRecords }}
                onPageChange={handlePageChange}
                filters={(
                    <div className="flex flex-wrap items-center gap-2 order-[3] w-full sm:w-auto">
                        <div className="space-y-2">
                            <Input
                                type="date"
                                value={startDate}
                                className='inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5'
                                onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
                            />
                        </div>
                        <div className="space-y-2">
                            <Input
                                type="date"
                                value={endDate}
                                className='inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5'
                                onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
                            />
                        </div>
                    </div>
                )}

            />
        </div>
    );
}
