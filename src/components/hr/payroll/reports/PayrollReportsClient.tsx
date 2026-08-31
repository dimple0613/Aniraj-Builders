'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Download } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface ReportSummary {
    totalSalaryDisbursed: number;
    totalEarnings: number;
    totalDeductions: number;
    totalNetPay: number;
    employeeCount: number;
    runCount: number;
}

interface FinancialYear {
    id: string;
    name: string;
}

export function PayrollReportsClient() {
    const [summary, setSummary] = useState<ReportSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
    const [selectedFY, setSelectedFY] = useState<string>('');
    const [selectedPeriod, setSelectedPeriod] = useState<string>('');
    const [periods, setPeriods] = useState<Array<{ id: string; name: string }>>([]);

    const fetchInitial = useCallback(async () => {
        try {
            const [sumRes, fyRes] = await Promise.all([
                axios.get('/api/hr/payroll/reports/summary'),
                axios.get('/api/hr/financial-years', { params: { limit: 50 } }),
            ]);
            setSummary(sumRes.data);
            setFinancialYears(fyRes.data.data || []);
        } catch {
            toast.error('Failed to load report data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchInitial(); }, [fetchInitial]);

    const fetchPeriods = useCallback(async (fyId: string) => {
        if (!fyId) { setPeriods([]); return; }
        try {
            const res = await axios.get(`/api/hr/financial-years/${fyId}/periods`);
            setPeriods(res.data.data || []);
        } catch {
            setPeriods([]);
        }
    }, []);

    const loadSummary = useCallback(async () => {
        try {
            setLoading(true);
            const params: Record<string, any> = {};
            if (selectedFY) params.financial_year_id = selectedFY;
            if (selectedPeriod) params.period_id = selectedPeriod;
            const res = await axios.get('/api/hr/payroll/reports/summary', { params });
            setSummary(res.data);
        } catch {
            toast.error('Failed to load report data');
        } finally {
            setLoading(false);
        }
    }, [selectedFY, selectedPeriod]);

    const handleExport = async (format: 'csv' | 'pdf') => {
        try {
            setExporting(true);
            const params: Record<string, any> = { format };
            if (selectedFY) params.financial_year_id = selectedFY;
            if (selectedPeriod) params.period_id = selectedPeriod;
            const res = await axios.get('/api/hr/payroll/reports/export', {
                params,
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `payroll-report-${new Date().toISOString().split('T')[0]}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success(`Report exported as ${format.toUpperCase()}`);
        } catch {
            toast.error('Failed to export report');
        } finally {
            setExporting(false);
        }
    };

    const formatCurrency = (val: number) => `₹${Number(val).toLocaleString()}`;

    if (loading && !summary) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 p-2 md:p-6 w-full overflow-hidden">
            <div className="shrink-0">
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Payroll Reports</h2>
                <p className="text-muted-foreground text-sm">Overview and export of payroll data</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Filters</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="space-y-2">
                            <Label>Financial Year</Label>
                            <Select value={selectedFY} onValueChange={(v) => { setSelectedFY(v); setSelectedPeriod(''); fetchPeriods(v); }}>
                                <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Years" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">All Years</SelectItem>
                                    {financialYears.map(fy => (
                                        <SelectItem key={fy.id} value={fy.id}>{fy.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Period</Label>
                            <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
                                <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Periods" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="">All Periods</SelectItem>
                                    {periods.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button variant="outline" size="sm" onClick={loadSummary}>Apply</Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="py-3"><CardTitle className="text-sm font-medium">Total Salary Disbursed</CardTitle></CardHeader>
                    <CardContent className="py-2 text-2xl font-bold text-green-600">
                        {formatCurrency(summary?.totalSalaryDisbursed || 0)}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="py-3"><CardTitle className="text-sm font-medium">Total Earnings</CardTitle></CardHeader>
                    <CardContent className="py-2 text-2xl font-bold text-blue-600">
                        {formatCurrency(summary?.totalEarnings || 0)}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="py-3"><CardTitle className="text-sm font-medium">Total Deductions</CardTitle></CardHeader>
                    <CardContent className="py-2 text-2xl font-bold text-red-600">
                        {formatCurrency(summary?.totalDeductions || 0)}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="py-3"><CardTitle className="text-sm font-medium">Net Pay</CardTitle></CardHeader>
                    <CardContent className="py-2 text-2xl font-bold">
                        {formatCurrency(summary?.totalNetPay || 0)}
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="py-3"><CardTitle className="text-sm font-medium">Employees Processed</CardTitle></CardHeader>
                    <CardContent className="py-2 text-2xl font-bold">{summary?.employeeCount || 0}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="py-3"><CardTitle className="text-sm font-medium">Payroll Runs</CardTitle></CardHeader>
                    <CardContent className="py-2 text-2xl font-bold">{summary?.runCount || 0}</CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="text-sm">Export Reports</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-3">
                    <Button variant="outline" size="sm" onClick={() => handleExport('csv')} disabled={exporting}>
                        <Download className="h-4 w-4 mr-1" />
                        {exporting ? 'Exporting...' : 'Export CSV'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleExport('pdf')} disabled={exporting}>
                        <Download className="h-4 w-4 mr-1" />
                        {exporting ? 'Exporting...' : 'Export PDF'}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
