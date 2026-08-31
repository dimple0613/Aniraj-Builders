'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, CreditCard } from 'lucide-react';
import { formatDateDisplay } from '@/lib/date-utils';

interface Employee {
    id: string;
    name: string;
    employee_code: string;
}

interface Repayment {
    id: string;
    loan_id: string;
    payroll_run_id: string | null;
    amount: number;
    month: number;
    year: number;
    paid_at: string | null;
}

interface Loan {
    id: string;
    employee_id: string;
    loan_type: 'LOAN' | 'ADVANCE';
    amount: number;
    emi_amount: number;
    total_installments: number;
    paid_installments: number;
    remaining_amount: number;
    start_date: string;
    notes: string | null;
    status: 'ACTIVE' | 'CLOSED';
    employee?: Employee;
    repayments?: Repayment[];
    createdAt: string;
    updatedAt: string;
}

export function LoanDetailClient({ id }: { id: string }) {
    const router = useRouter();
    const [loan, setLoan] = useState<Loan | null>(null);
    const [loading, setLoading] = useState(true);
    const [repayModalOpen, setRepayModalOpen] = useState(false);
    const [selectedRunId, setSelectedRunId] = useState('');
    const [repayLoading, setRepayLoading] = useState(false);
    const [payrollRuns, setPayrollRuns] = useState<any[]>([]);

    const fetchLoan = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axios.get(`/api/hr/loans/${id}`);
            setLoan(res.data.data || res.data);
        } catch {
            toast.error('Failed to fetch loan details');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchLoan(); }, [fetchLoan]);

    const fetchPayrollRuns = useCallback(async () => {
        try {
            const res = await axios.get('/api/hr/payroll-runs', { params: { limit: 50 } });
            setPayrollRuns(res.data.data || []);
        } catch {
            toast.error('Failed to load payroll runs');
        }
    }, []);

    const handleRepay = async () => {
        if (!loan || !selectedRunId) return;
        const selectedRun = payrollRuns.find(r => r.id === selectedRunId);
        if (!selectedRun) return;
        try {
            setRepayLoading(true);
            const emiAmount = Math.min(loan.emi_amount, loan.remaining_amount);
            await axios.post('/api/hr/loan-repayments', {
                loan_id: loan.id,
                payroll_run_id: selectedRunId,
                amount: emiAmount,
                month: selectedRun.period?.month || new Date().getMonth() + 1,
                year: selectedRun.period?.year || new Date().getFullYear(),
            });
            toast.success('Repayment recorded successfully');
            setRepayModalOpen(false);
            setSelectedRunId('');
            fetchLoan();
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to record repayment');
        } finally {
            setRepayLoading(false);
        }
    };

    const formatCurrency = (val: number) => `₹${Number(val).toLocaleString()}`;

    const statusBadge = (status: string) => {
        const colors: Record<string, string> = {
            ACTIVE: 'bg-green-100 text-green-800',
            CLOSED: 'bg-gray-100 text-gray-800',
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

    if (!loan) {
        return <div className="p-6 text-muted-foreground">Loan not found.</div>;
    }

    const progressPercent = loan.total_installments > 0
        ? Math.round((loan.paid_installments / loan.total_installments) * 100)
        : 0;

    const remainingAmount = loan.amount - (loan.emi_amount * loan.paid_installments);

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 p-2 w-full overflow-hidden">
            <div className="shrink-0 flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        {loan.loan_type} Details
                    </h2>
                    <p className="text-muted-foreground text-sm">{loan.employee?.name} ({loan.employee?.employee_code})</p>
                </div>
                <div className="ml-auto flex items-center gap-2">
                    {loan.status === 'ACTIVE' && (
                        <Button variant="outline" size="sm" onClick={() => { fetchPayrollRuns(); setRepayModalOpen(true); }}>
                            <CreditCard className="h-4 w-4 mr-1" /> Record Repayment
                        </Button>
                    )}
                    {statusBadge(loan.status)}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                    <CardHeader className="py-3"><CardTitle className="text-sm font-medium">Total Amount</CardTitle></CardHeader>
                    <CardContent className="py-2 text-2xl font-bold">{formatCurrency(loan.amount)}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="py-3"><CardTitle className="text-sm font-medium">EMI Amount</CardTitle></CardHeader>
                    <CardContent className="py-2 text-2xl font-bold">{formatCurrency(loan.emi_amount)}</CardContent>
                </Card>
                <Card>
                    <CardHeader className="py-3"><CardTitle className="text-sm font-medium">Remaining</CardTitle></CardHeader>
                    <CardContent className="py-2 text-2xl font-bold">{formatCurrency(Math.max(0, remainingAmount))}</CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Repayment Progress</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                        <span>{loan.paid_installments} of {loan.total_installments} installments paid</span>
                        <span className="font-medium">{progressPercent}%</span>
                    </div>
                    <Progress value={progressPercent} className="h-3" />

                    {loan.notes && (
                        <div className="text-sm text-muted-foreground">
                            <span className="font-medium">Notes:</span> {loan.notes}
                        </div>
                    )}

                    <div className="text-sm text-muted-foreground">
                        Started: {formatDateDisplay(loan.start_date)}
                    </div>
                </CardContent>
            </Card>

            {loan.repayments && loan.repayments.length > 0 && (
                <Card>
                    <CardHeader><CardTitle>Repayment Schedule</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left p-3 font-medium">#</th>
                                        <th className="text-left p-3 font-medium">Due Date</th>
                                        <th className="text-right p-3 font-medium">Amount</th>
                                        <th className="text-center p-3 font-medium">Status</th>
                                        <th className="text-right p-3 font-medium">Paid Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loan.repayments.map((r, index) => {
                                        const dueDate = new Date(r.year, r.month - 1);
                                        const isPaid = !!r.paid_at;
                                        return (
                                            <tr key={r.id} className="border-b hover:bg-muted/50">
                                                <td className="p-3">{index + 1}</td>
                                                <td className="p-3">{formatDateDisplay(dueDate.toISOString())}</td>
                                                <td className="p-3 text-right">{formatCurrency(r.amount)}</td>
                                                <td className="p-3 text-center">
                                                    {isPaid ? (
                                                        <Badge className="bg-green-100 text-green-800" variant="outline">Paid</Badge>
                                                    ) : (
                                                        <Badge variant="secondary">Pending</Badge>
                                                    )}
                                                </td>
                                                <td className="p-3 text-right">{r.paid_at ? formatDateDisplay(r.paid_at) : '-'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Dialog open={repayModalOpen} onOpenChange={(open) => !open && setRepayModalOpen(false)}>
                <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                        <DialogTitle>Record Loan Repayment</DialogTitle>
                        <DialogDescription>
                            Record an EMI payment for this {loan.loan_type.toLowerCase()}.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Amount</Label>
                            <p className="text-lg font-semibold">{formatCurrency(Math.min(loan.emi_amount, loan.remaining_amount))}</p>
                        </div>
                        <div className="space-y-2">
                            <Label>Select Payroll Run *</Label>
                            <Select value={selectedRunId} onValueChange={setSelectedRunId}>
                                <SelectTrigger><SelectValue placeholder="Select payroll run" /></SelectTrigger>
                                <SelectContent>
                                    {payrollRuns.map((run) => (
                                        <SelectItem key={run.id} value={run.id}>
                                            {run.period?.month}/{run.period?.year} — {run.status}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRepayModalOpen(false)}>Cancel</Button>
                        <Button onClick={handleRepay} disabled={!selectedRunId || repayLoading}>
                            {repayLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                            {repayLoading ? 'Recording...' : 'Record Payment'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
