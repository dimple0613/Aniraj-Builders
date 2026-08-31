'use client';

import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';

interface PayslipComponent {
    name: string;
    type: 'EARNING' | 'DEDUCTION';
    amount: number;
}

interface Payslip {
    id: string;
    payslip_number: string;
    employee_id: string;
    generated_date: string;
    employee?: { id: string; name: string; employee_code: string };
    payroll_run?: {
        id: string;
        process_date: string;
        financial_year?: { name: string };
        period?: { name: string; start_date: string; end_date: string };
    };
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

export default function PayslipPrintPage({ params }: { params: Promise<{ id: string }> }) {
    const [payslip, setPayslip] = useState<Payslip | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchPayslip = useCallback(async () => {
        try {
            const { id } = await params;
            const res = await axios.get(`/api/hr/payslips/${id}`);
            setPayslip(res.data.data);
        } catch {
            setLoading(false);
        } finally {
            setLoading(false);
        }
    }, [params]);

    useEffect(() => {
        fetchPayslip();
    }, [fetchPayslip]);

    useEffect(() => {
        if (payslip && !loading) {
            const t = setTimeout(() => window.print(), 500);
            return () => clearTimeout(t);
        }
    }, [payslip, loading]);

    const formatCurrency = (val: number) => `\u20B9${Number(val).toLocaleString()}`;
    const formatDate = (d: string) =>
        new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

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
    const allComponents: PayslipComponent[] = (item?.components || []).map((c) => ({
        name: c.salaryComponent?.name || '-',
        type: c.type as 'EARNING' | 'DEDUCTION',
        amount: c.amount,
    }));
    const earnings = allComponents.filter((c) => c.type === 'EARNING');
    const deductions = allComponents.filter((c) => c.type === 'DEDUCTION');

    return (
        <div className="p-8 max-w-4xl mx-auto">
            <style>{`
                @media print {
                    body { margin: 0; }
                    .no-print { display: none !important; }
                }
            `}</style>

            <div className="no-print mb-4 text-center text-sm text-muted-foreground">
                Print preview — use Ctrl+P or the browser print dialog
            </div>

            <div className="border-2 rounded-lg">
                <div className="text-center border-b p-6">
                    <h1 className="text-2xl font-bold">PAYSLIP</h1>
                    <p className="text-sm text-muted-foreground">
                        {payslip.payroll_run?.financial_year?.name} &middot; {payslip.payroll_run?.period?.name}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        Period: {payslip.payroll_run?.period?.start_date && formatDate(payslip.payroll_run.period.start_date)} - {payslip.payroll_run?.period?.end_date && formatDate(payslip.payroll_run.period.end_date)}
                    </p>
                </div>

                <div className="p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
                        <div>
                            <p className="text-sm text-muted-foreground">Employee</p>
                            <p className="font-medium">{payslip.employee?.name}</p>
                            <p className="text-sm text-muted-foreground">Code: {payslip.employee?.employee_code}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-muted-foreground">Payslip #</p>
                            <p className="font-medium">{payslip.payslip_number}</p>
                            <p className="text-sm text-muted-foreground">{formatDate(payslip.generated_date)}</p>
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
                </div>
            </div>
        </div>
    );
}
