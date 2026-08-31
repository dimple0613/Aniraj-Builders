'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Column, DataTable } from '../common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Printer, Download } from 'lucide-react';

type GstReportType = 'gstr1' | 'gstr2' | 'gstr3b';

interface GstEntry {
    id: string;
    invoiceNo: string;
    date: string;
    partyName: string;
    partyGstin: string;
    transactionType: string;
    taxableAmount: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    totalGst: number;
    grandTotal: number;
}

export function GstReport() {
    const [gstType, setGstType] = useState<GstReportType>('gstr1');
    const [data, setData] = useState<any>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [limit, setLimit] = useState(10);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [summary, setSummary] = useState<any>(null);

    const fetchReport = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.append('type', 'gst');
            params.append('gstType', gstType);
            params.append('page', page.toString());
            params.append('limit', limit.toString());
            if (search) params.append('search', search);
            if (sortField) params.append('sortField', sortField);
            if (sortOrder) params.append('sortOrder', sortOrder);
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);

            const response = await axios.get(`/api/reports?${params.toString()}`);
            setData(response.data.data || []);
            if (response.data.pagination) {
                setPagination({
                    page: response.data.pagination.page,
                    totalPages: response.data.pagination.pages,
                    total: response.data.pagination.total,
                });
            }
            if (response.data.summary) {
                setSummary(response.data.summary);
            } else {
                setSummary(null);
            }
        } catch {
            toast.error('Failed to fetch report');
        } finally {
            setLoading(false);
        }
    }, [gstType, startDate, endDate, search, sortField, sortOrder, limit]);

    useEffect(() => {
        fetchReport(1);
    }, [gstType]);

    useEffect(() => {
        fetchReport(1);
    }, [startDate, endDate]);

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
        link.download = `${gstType}-report-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const generateCSV = () => {
        if (!Array.isArray(data) || data.length === 0) return '';
        const headers = ['Invoice No', 'Date', 'Party', 'GSTIN', 'Type', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total GST', 'Grand Total'];
        const rows = data.map((row: any) => [
            row.invoiceNo || '',
            new Date(row.date).toLocaleDateString(),
            row.partyName || '',
            row.partyGstin || '',
            row.transactionType || '',
            row.taxableAmount?.toString() || '0',
            row.cgstAmount?.toString() || '0',
            row.sgstAmount?.toString() || '0',
            row.igstAmount?.toString() || '0',
            row.totalGst?.toString() || '0',
            row.grandTotal?.toString() || '0',
        ].join(','));
        return [headers.join(','), ...rows].join('\n');
    };

    const columns = useMemo<Column<any>[]>(() => [
        {
            header: 'Invoice No',
            accessorKey: 'invoiceNo',
            sortable: true,
        },
        {
            header: 'Date',
            accessorKey: 'date',
            sortable: true,
            cell: (item: any) => (
                <span className="text-sm">
                    {new Date(item.date).toLocaleDateString()}
                </span>
            ),
        },
        {
            header: 'Party',
            accessorKey: 'partyName',
            sortable: true,
        },
        {
            header: 'GSTIN',
            accessorKey: 'partyGstin',
            sortable: true,
        },
        {
            header: 'Type',
            accessorKey: 'transactionType',
            sortable: true,
            cell: (item: any) => (
                <Badge variant={item.transactionType === 'INTER_STATE' ? 'destructive' : 'default'}>
                    {item.transactionType === 'INTER_STATE' ? 'IGST' : 'CGST/SGST'}
                </Badge>
            ),
        },
        {
            header: 'Taxable',
            accessorKey: 'taxableAmount',
            sortable: true,
            cell: (item: any) => (
                <span className="font-medium">₹{item.taxableAmount?.toLocaleString()}</span>
            ),
        },
        {
            header: 'CGST',
            accessorKey: 'cgstAmount',
            sortable: true,
            cell: (item: any) => (
                <span>₹{item.cgstAmount?.toLocaleString()}</span>
            ),
        },
        {
            header: 'SGST',
            accessorKey: 'sgstAmount',
            sortable: true,
            cell: (item: any) => (
                <span>₹{item.sgstAmount?.toLocaleString()}</span>
            ),
        },
        {
            header: 'IGST',
            accessorKey: 'igstAmount',
            sortable: true,
            cell: (item: any) => (
                <span>₹{item.igstAmount?.toLocaleString()}</span>
            ),
        },
        {
            header: 'Total GST',
            accessorKey: 'totalGst',
            sortable: true,
            cell: (item: any) => (
                <span className="font-medium">₹{item.totalGst?.toLocaleString()}</span>
            ),
        },
        {
            header: 'Grand Total',
            accessorKey: 'grandTotal',
            sortable: true,
            cell: (item: any) => (
                <span className="font-bold">₹{item.grandTotal?.toLocaleString()}</span>
            ),
        },
    ], [gstType]);

    const totals = useMemo(() => {
        if (!Array.isArray(data)) return { totalTaxable: 0, totalCgst: 0, totalSgst: 0, totalIgst: 0, totalGst: 0, totalGrand: 0 };
        return {
            totalTaxable: data.reduce((sum: number, item: any) => sum + (item.taxableAmount || 0), 0),
            totalCgst: data.reduce((sum: number, item: any) => sum + (item.cgstAmount || 0), 0),
            totalSgst: data.reduce((sum: number, item: any) => sum + (item.sgstAmount || 0), 0),
            totalIgst: data.reduce((sum: number, item: any) => sum + (item.igstAmount || 0), 0),
            totalGst: data.reduce((sum: number, item: any) => sum + (item.totalGst || 0), 0),
            totalGrand: data.reduce((sum: number, item: any) => sum + (item.grandTotal || 0), 0),
        };
    }, [data]);

    return (
        <div className="flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        GST Report
                    </h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-end gap-2">
                        <Button variant="outline" onClick={handleExport} disabled={loading || data.length === 0}>
                            <Download className="h-4 w-4 mr-2" />
                            Export
                        </Button>
                        <Button variant="outline" onClick={handlePrint} disabled={loading || data.length === 0}>
                            <Printer className="h-4 w-4 mr-2" />
                            Print
                        </Button>
                        <Button onClick={() => fetchReport(1)} disabled={loading}>
                            {loading ? 'Loading...' : 'Generate Report'}
                        </Button>
                    </div>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex flex-col gap-4">
                        <div className="flex gap-2">
                            <Button
                                variant={gstType === 'gstr1' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setGstType('gstr1')}
                            >
                                GSTR-1 (Sales)
                            </Button>
                            <Button
                                variant={gstType === 'gstr2' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setGstType('gstr2')}
                            >
                                GSTR-2 (Purchase)
                            </Button>
                            <Button
                                variant={gstType === 'gstr3b' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => setGstType('gstr3b')}
                            >
                                GSTR-3B (Summary)
                            </Button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="space-y-2">
                                <Label>Start Date</Label>
                                <Input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>End Date</Label>
                                <Input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                />
                            </div>
                            {(startDate || endDate) && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setStartDate('');
                                        setEndDate('');
                                        fetchReport(1);
                                    }}
                                >
                                    Clear Filters
                                </Button>
                            )}
                        </div>
                    </div>
                </CardHeader>

                <CardContent>
                    {gstType === 'gstr3b' && data && data.summary ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Card>
                                    <CardHeader><h3 className="font-semibold">Intra-State (CGST/SGST)</h3></CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            <div className="flex justify-between"><span>Taxable Amount</span><span className="font-bold">₹{data.summary.purchases?.intraState?.taxableAmount?.toLocaleString() || 0}</span></div>
                                            <div className="flex justify-between"><span>CGST</span><span className="font-bold text-blue-600">₹{data.summary.purchases?.intraState?.cgst?.toLocaleString() || 0}</span></div>
                                            <div className="flex justify-between"><span>SGST</span><span className="font-bold text-purple-600">₹{data.summary.purchases?.intraState?.sgst?.toLocaleString() || 0}</span></div>
                                            <div className="flex justify-between border-t pt-2"><span>Total</span><span className="font-bold">₹{data.summary.purchases?.intraState?.total?.toLocaleString() || 0}</span></div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader><h3 className="font-semibold">Inter-State (IGST)</h3></CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            <div className="flex justify-between"><span>Taxable Amount</span><span className="font-bold">₹{data.summary.purchases?.interState?.taxableAmount?.toLocaleString() || 0}</span></div>
                                            <div className="flex justify-between"><span>IGST</span><span className="font-bold text-orange-600">₹{data.summary.purchases?.interState?.igst?.toLocaleString() || 0}</span></div>
                                            <div className="flex justify-between border-t pt-2"><span>Total</span><span className="font-bold">₹{data.summary.purchases?.interState?.total?.toLocaleString() || 0}</span></div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card>
                                    <CardHeader><h3 className="font-semibold">Total Purchases</h3></CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            <div className="flex justify-between"><span>Taxable Amount</span><span className="font-bold">₹{data.summary.purchases?.totalTaxable?.toLocaleString() || 0}</span></div>
                                            <div className="flex justify-between"><span>Total GST</span><span className="font-bold text-amber-600">₹{data.summary.purchases?.totalGst?.toLocaleString() || 0}</span></div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader><h3 className="font-semibold">Input Tax Credit (ITC)</h3></CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            <div className="flex justify-between"><span>CGST ITC</span><span className="font-bold text-blue-600">₹{data.summary.itc?.cgst?.toLocaleString() || 0}</span></div>
                                            <div className="flex justify-between"><span>SGST ITC</span><span className="font-bold text-purple-600">₹{data.summary.itc?.sgst?.toLocaleString() || 0}</span></div>
                                            <div className="flex justify-between"><span>IGST ITC</span><span className="font-bold text-orange-600">₹{data.summary.itc?.igst?.toLocaleString() || 0}</span></div>
                                            <div className="flex justify-between border-t pt-2"><span>Total ITC</span><span className="font-bold text-green-600">₹{data.summary.itc?.total?.toLocaleString() || 0}</span></div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader><h3 className="font-semibold">Net GST Payable</h3></CardHeader>
                                    <CardContent>
                                        <div className="space-y-2">
                                            <div className="flex justify-between"><span>CGST</span><span className="font-bold">₹{data.summary.netLiability?.cgst?.toLocaleString() || 0}</span></div>
                                            <div className="flex justify-between"><span>SGST</span><span className="font-bold">₹{data.summary.netLiability?.sgst?.toLocaleString() || 0}</span></div>
                                            <div className="flex justify-between"><span>IGST</span><span className="font-bold">₹{data.summary.netLiability?.igst?.toLocaleString() || 0}</span></div>
                                            <div className="flex justify-between border-t pt-2 text-lg"><span>Total</span><span className="font-bold text-amber-600">₹{data.summary.netLiability?.total?.toLocaleString() || 0}</span></div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    ) : (
                        <>
                            {data.length > 0 && summary && (
                                <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-4">
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">Taxable</p>
                                        <p className="text-lg font-bold">₹{summary.totalTaxable?.toLocaleString() || 0}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">CGST</p>
                                        <p className="text-lg font-bold text-blue-600">₹{summary.totalCgst?.toLocaleString() || 0}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">SGST</p>
                                        <p className="text-lg font-bold text-purple-600">₹{summary.totalSgst?.toLocaleString() || 0}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">IGST</p>
                                        <p className="text-lg font-bold text-orange-600">₹{summary.totalIgst?.toLocaleString() || 0}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">Total GST</p>
                                        <p className="text-lg font-bold text-amber-600">₹{summary.totalGst?.toLocaleString() || 0}</p>
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-sm text-muted-foreground">Grand Total</p>
                                        <p className="text-lg font-bold">₹{summary.totalGrand?.toLocaleString() || 0}</p>
                                    </div>
                                </div>
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
                                searchPlaceholder="Search GST entries..."
                                emptyMessage="No GST entries found."
                            />
                        </>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
