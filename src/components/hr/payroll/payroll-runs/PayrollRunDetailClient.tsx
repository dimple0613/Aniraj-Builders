'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { formatDateDisplay } from '@/lib/date-utils';

interface Employee {
    id: string;
    name: string;
    employee_code: string;
}

interface PayrollItem {
    id: string;
    employee_id: string;
    employee?: Employee;
    gross_salary: number;
    total_earnings: number;
    total_deductions: number;
    net_pay: number;
    status: 'COMPUTED' | 'PENDING' | 'CONFIRMED' | 'FINALIZED';
}

interface PayrollRun {
    id: string;
    financial_year_id: string;
    period_id: string;
    process_date: string;
    status: 'DRAFT' | 'PROCESSED' | 'FINALIZED';
    financial_year?: { id: string; name: string };
    period?: { id: string; month: number; year: number; start_date: string; end_date: string };
    payrollItems?: PayrollItem[];
    createdAt: string;
    updatedAt: string;
}

export function PayrollRunDetailClient({ id }: { id: string }) {
    const router = useRouter();
    const [run, setRun] = useState<PayrollRun | null>(null);
    const [loading, setLoading] = useState(true);
    const [confirmingId, setConfirmingId] = useState<string | null>(null);
    const [finalizing, setFinalizing] = useState(false);
    const [generatingPayslips, setGeneratingPayslips] = useState(false);

    const fetchRun = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axios.get(`/api/hr/payroll-runs/${id}`);
            setRun(res.data.data || res.data);
        } catch {
            toast.error('Failed to fetch payroll run details');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchRun(); }, [fetchRun]);

    const handleConfirmItem = async (itemId: string) => {
        try {
            setConfirmingId(itemId);
            await axios.put(`/api/hr/payroll-items/${itemId}`, { status: 'CONFIRMED' });
            toast.success('Item confirmed');
            fetchRun();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to confirm item');
        } finally {
            setConfirmingId(null);
        }
    };

    const handleFinalize = async () => {
        try {
            setFinalizing(true);
            await axios.put(`/api/hr/payroll-runs/${id}`, { status: 'FINALIZED' });
            toast.success('Payroll run finalized');
            fetchRun();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to finalize');
        } finally {
            setFinalizing(false);
        }
    };

    const handleGeneratePayslips = async () => {
        try {
            setGeneratingPayslips(true);
            const res = await axios.post('/api/hr/payslips', { payroll_run_id: id });
            toast.success(res.data.message || 'Payslips generated successfully');
            fetchRun();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to generate payslips');
        } finally {
            setGeneratingPayslips(false);
        }
    };

    const formatCurrency = (val: number) => `₹${Number(val).toLocaleString()}`;
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const formatPeriodName = (p: PayrollRun['period']) => {
        if (!p) return '-';
        if (p.month && p.year) return `${MONTHS[p.month - 1]} ${p.year}`;
        return '-';
    };

    const statusBadge = (status: string) => {
        const colors: Record<string, string> = {
            DRAFT: 'bg-yellow-100 text-yellow-800',
            PROCESSED: 'bg-blue-100 text-blue-800',
            FINALIZED: 'bg-green-100 text-green-800',
            PENDING: 'bg-yellow-100 text-yellow-800',
            CONFIRMED: 'bg-blue-100 text-blue-800',
        };
        return <Badge className={colors[status] || ''} variant="outline">{status}</Badge>;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!run) {
        return <div className="p-6 text-muted-foreground">Payroll run not found.</div>;
    }

    const totals = run.payrollItems?.reduce((acc, item) => ({
        gross: acc.gross + Number(item.gross_salary),
        earnings: acc.earnings + Number(item.total_earnings),
        deductions: acc.deductions + Number(item.total_deductions),
        net: acc.net + Number(item.net_pay),
    }), { gross: 0, earnings: 0, deductions: 0, net: 0 }) || { gross: 0, earnings: 0, deductions: 0, net: 0 };

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 p-2 w-full overflow-hidden">
            <div className="shrink-0 flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Payroll Run Details</h2>
                    <p className="text-muted-foreground text-sm">
                        {run.financial_year?.name} / {formatPeriodName(run.period)} &middot; {formatDateDisplay(run.process_date)}
                    </p>
                </div>
                <div className="ml-auto">{statusBadge(run.status)}</div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card><CardHeader className="py-3"><CardTitle className="text-sm font-medium">Gross Salary</CardTitle></CardHeader><CardContent className="py-2 text-2xl font-bold">{formatCurrency(totals.gross)}</CardContent></Card>
                <Card><CardHeader className="py-3"><CardTitle className="text-sm font-medium">Total Earnings</CardTitle></CardHeader><CardContent className="py-2 text-2xl font-bold text-green-600">{formatCurrency(totals.earnings)}</CardContent></Card>
                <Card><CardHeader className="py-3"><CardTitle className="text-sm font-medium">Total Deductions</CardTitle></CardHeader><CardContent className="py-2 text-2xl font-bold text-red-600">{formatCurrency(totals.deductions)}</CardContent></Card>
                <Card><CardHeader className="py-3"><CardTitle className="text-sm font-medium">Net Pay</CardTitle></CardHeader><CardContent className="py-2 text-2xl font-bold">{formatCurrency(totals.net)}</CardContent></Card>
            </div>

            <Card>
                <CardHeader className="py-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium">Payroll Items ({run.payrollItems?.length || 0})</CardTitle>
                    <div className="flex items-center gap-2">
                        {run.status !== 'DRAFT' && (
                            <Button size="sm" variant="outline" onClick={handleGeneratePayslips} disabled={generatingPayslips}>
                                {generatingPayslips ? 'Generating...' : 'Generate Payslips'}
                            </Button>
                        )}
                        {run.status !== 'FINALIZED' && (
                            <Button size="sm" onClick={handleFinalize} disabled={finalizing}>
                                {finalizing ? 'Finalizing...' : 'Finalize Run'}
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left p-3 font-medium">Employee</th>
                                    <th className="text-right p-3 font-medium">Gross</th>
                                    <th className="text-right p-3 font-medium">Earnings</th>
                                    <th className="text-right p-3 font-medium">Deductions</th>
                                    <th className="text-right p-3 font-medium">Net</th>
                                    <th className="text-center p-3 font-medium">Status</th>
                                    {run.status !== 'FINALIZED' && <th className="text-center p-3 font-medium">Action</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {run.payrollItems?.map((item) => (
                                    <tr key={item.id} className="border-b hover:bg-muted/50">
                                        <td className="p-3">{item.employee?.name || '-'}</td>
                                        <td className="p-3 text-right">{formatCurrency(item.gross_salary)}</td>
                                        <td className="p-3 text-right text-green-600">{formatCurrency(item.total_earnings)}</td>
                                        <td className="p-3 text-right text-red-600">{formatCurrency(item.total_deductions)}</td>
                                        <td className="p-3 text-right font-medium">{formatCurrency(item.net_pay)}</td>
                                        <td className="p-3 text-center">{statusBadge(item.status)}</td>
                                        {run.status !== 'FINALIZED' && (
                                            <td className="p-3 text-center">
                                                {(item.status === 'PENDING' || item.status === 'COMPUTED') && (
                                                    <Button variant="outline" size="sm" onClick={() => handleConfirmItem(item.id)} disabled={confirmingId === item.id}>
                                                        {confirmingId === item.id ? 'Confirming...' : 'Confirm'}
                                                    </Button>
                                                )}
                                                {item.status === 'CONFIRMED' && <span className="text-sm text-muted-foreground">Confirmed</span>}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                                {(!run.payrollItems || run.payrollItems.length === 0) && (
                                    <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No items in this run.</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
