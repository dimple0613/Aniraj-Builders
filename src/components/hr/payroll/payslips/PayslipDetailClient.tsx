'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { formatDateDisplay } from '@/lib/date-utils';

interface Employee {
    id: string;
    name: string;
    employee_code: string;
}

interface PayslipComponent {
    name: string;
    type: 'EARNING' | 'DEDUCTION';
    amount: number;
}

interface PayrollRun {
    id: string;
    process_date: string;
    financialYear?: { name: string };
    period?: { month: number; year: number; start_date: string; end_date: string };
}

interface Payslip {
    id: string;
    payslip_number: string;
    employee_id: string;
    payroll_run_id: string;
    generated_date: string;
    employee?: Employee;
    payrollRun?: PayrollRun;
    payrollItem?: {
        id: string;
        gross_salary: number;
        total_earnings: number;
        total_deductions: number;
        net_pay: number;
        components?: {
            salaryComponent: { name: string; type: string };
            amount: number;
            type: string;
        }[];
    };
}

export function PayslipDetailClient({ id }: { id: string }) {
    const router = useRouter();
    const [payslip, setPayslip] = useState<Payslip | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchPayslip = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axios.get(`/api/hr/payslips/${id}`);
            setPayslip(res.data.data);
        } catch {
            toast.error('Failed to fetch payslip details');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchPayslip(); }, [fetchPayslip]);

    const [downloading, setDownloading] = useState(false);

    const handlePrint = async () => {
        try {
            setDownloading(true);
            const response = await axios.get(`/api/hr/payslips/${id}/pdf`, {
                responseType: 'arraybuffer',
            });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const printWindow = window.open(url, '_blank');
            if (printWindow) {
                printWindow.onload = () => {
                    printWindow.focus();
                    setTimeout(() => printWindow.print(), 500);
                };
            }
        } catch {
            toast.error('Failed to generate PDF');
        } finally {
            setDownloading(false);
        }
    };

    const formatCurrency = (val: number) => `₹${Number(val).toLocaleString()}`;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!payslip) {
        return <div className="p-6 text-muted-foreground">Payslip not found.</div>;
    }

    const item = payslip.payrollItem;
    const allComponents: PayslipComponent[] = (item?.components || []).map(c => ({
        name: c.salaryComponent?.name || '-',
        type: c.type as 'EARNING' | 'DEDUCTION',
        amount: c.amount,
    }));
    const earnings = allComponents.filter(c => c.type === 'EARNING');
    const deductions = allComponents.filter(c => c.type === 'DEDUCTION');

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
            <div className="shrink-0 flex items-center gap-4 no-print">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Payslip #{payslip.payslip_number}</h2>
                    <p className="text-muted-foreground text-sm">Generated on {formatDateDisplay(payslip.generated_date, 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
                <div className="ml-auto">
                    <Button variant="outline" size="sm" onClick={handlePrint} disabled={downloading}>
                        {downloading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Printer className="h-4 w-4 mr-1" />} Print
                    </Button>
                </div>
            </div>

            <div id="payslip-content" className="max-w-4xl mx-auto w-full space-y-6">
                <Card className="border-2">
                    <CardHeader className="text-center border-b">
                        <CardTitle className="text-2xl">PAYSLIP</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {payslip.payrollRun?.financialYear?.name} &middot; {payslip.payrollRun?.period ? new Date(payslip.payrollRun.period.year, payslip.payrollRun.period.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : ''}
                        </p>
                        <p className="text-sm text-muted-foreground">
                            Period: {payslip.payrollRun?.period?.start_date ? formatDateDisplay(payslip.payrollRun.period.start_date, 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'} - {payslip.payrollRun?.period?.end_date ? formatDateDisplay(payslip.payrollRun.period.end_date, 'en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
                        </p>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                            <div>
                                <p className="text-sm text-muted-foreground">Employee</p>
                                <p className="font-medium">{payslip.employee?.name}</p>
                                <p className="text-sm text-muted-foreground">Code: {payslip.employee?.employee_code}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-muted-foreground">Payslip #</p>
                                <p className="font-medium">{payslip.payslip_number}</p>
                                <p className="text-sm text-muted-foreground">{formatDateDisplay(payslip.generated_date, 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div>
                                <h3 className="font-semibold mb-2 text-green-700">Earnings</h3>
                                <div className="space-y-2">
                                    {earnings.length === 0 && <p className="text-sm text-muted-foreground">No earnings</p>}
                                    {earnings.map((c, i) => (
                                        <div key={i} className="flex justify-between text-sm">
                                            <span>{c.name}</span>
                                            <span>{formatCurrency(c.amount)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between font-semibold pt-2 border-t">
                                        <span>Total Earnings</span>
                                        <span>{formatCurrency(item?.total_earnings || 0)}</span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-semibold mb-2 text-red-700">Deductions</h3>
                                <div className="space-y-2">
                                    {deductions.length === 0 && <p className="text-sm text-muted-foreground">No deductions</p>}
                                    {deductions.map((c, i) => (
                                        <div key={i} className="flex justify-between text-sm">
                                            <span>{c.name}</span>
                                            <span>{formatCurrency(c.amount)}</span>
                                        </div>
                                    ))}
                                    <div className="flex justify-between font-semibold pt-2 border-t">
                                        <span>Total Deductions</span>
                                        <span>{formatCurrency(item?.total_deductions || 0)}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="border-t-2 pt-4">
                            <div className="flex justify-between text-lg font-bold">
                                <span>Net Pay</span>
                                <span>{formatCurrency(item?.net_pay || 0)}</span>
                            </div>
                        </div>

                        {(item?.gross_salary || 0) > 0 && (
                            <div className="flex justify-between text-sm text-muted-foreground pt-2">
                                <span>Gross Salary</span>
                                <span>{formatCurrency(item.gross_salary)}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <style jsx>{`
                @media print {
                    .no-print { display: none !important; }
                    #payslip-content { max-width: 100% !important; }
                }
            `}</style>
        </div>
    );
}
