'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, FileText, DollarSign, PiggyBank, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDateDisplay } from '@/lib/date-utils';

interface DashboardStats {
    totalEmployees: number;
    activePayrollRuns: number;
    pendingReimbursements: number;
    activeLoans: number;
    recentRuns: Array<{
        id: string;
        process_date: string;
        status: string;
        financial_year?: { name: string };
        period?: { month: number; year: number };
    }>;
}

export function PayrollDashboardClient() {
    const router = useRouter();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axios.get('/api/hr/payroll/dashboard');
            setStats(res.data);
        } catch {
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchStats(); }, [fetchStats]);

    const statusBadge = (status: string) => {
        const colors: Record<string, string> = {
            DRAFT: 'bg-yellow-100 text-yellow-800',
            PROCESSED: 'bg-blue-100 text-blue-800',
            FINALIZED: 'bg-green-100 text-green-800',
        };
        return <Badge className={colors[status] || ''} variant="outline">{status}</Badge>;
    };

    const quickLinks = [
        { label: 'Salary Components', href: '/hr/salary-components', icon: DollarSign },
        { label: 'Employee Salaries', href: '/hr/employee-salaries', icon: Users },
        { label: 'Payroll Runs', href: '/hr/payroll-runs', icon: FileText },
        { label: 'Payslips', href: '/hr/payslips', icon: FileText },
        { label: 'Reimbursement Requests', href: '/hr/reimbursement-requests', icon: DollarSign },
        { label: 'Loans & Advances', href: '/hr/loans', icon: PiggyBank },
        { label: 'Financial Years', href: '/hr/financial-years', icon: FileText },
        { label: 'Reimbursement Types', href: '/hr/reimbursement-types', icon: DollarSign },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 p-2 w-full overflow-hidden">
            <div className="shrink-0">
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Payroll Dashboard</h2>
                <p className="text-muted-foreground text-sm">Overview of payroll activities</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between py-3">
                        <CardTitle className="text-sm font-medium">Total Employees</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="py-2">
                        <div className="text-2xl font-bold">{stats?.totalEmployees || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between py-3">
                        <CardTitle className="text-sm font-medium">Active Payroll Runs</CardTitle>
                        <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="py-2">
                        <div className="text-2xl font-bold">{stats?.activePayrollRuns || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between py-3">
                        <CardTitle className="text-sm font-medium">Pending Reimbursements</CardTitle>
                        <DollarSign className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="py-2">
                        <div className="text-2xl font-bold text-yellow-600">{stats?.pendingReimbursements || 0}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between py-3">
                        <CardTitle className="text-sm font-medium">Active Loans</CardTitle>
                        <PiggyBank className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="py-2">
                        <div className="text-2xl font-bold">{stats?.activeLoans || 0}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card>
                    <CardHeader className="flex items-center justify-between">
                        <CardTitle className="text-sm">Recent Payroll Runs</CardTitle>
                        <Button variant="ghost" size="sm" onClick={() => router.push('/hr/payroll-runs')}>
                            View All <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                    </CardHeader>
                    <CardContent>
                        {(!stats?.recentRuns || stats.recentRuns.length === 0) ? (
                            <p className="text-sm text-muted-foreground py-4 text-center">No recent runs</p>
                        ) : (
                            <div className="space-y-3">
                                {stats.recentRuns.map((run) => (
                                    <div
                                        key={run.id}
                                        className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                                        onClick={() => router.push(`/hr/payroll-runs/${run.id}`)}
                                    >
                                        <div>
                                            <p className="text-sm font-medium">
                                                {run.financial_year?.name} / {run.period ? `${String(run.period.month).padStart(2, '0')}/${run.period.year}` : '-'}
                                            </p>
                                            <p className="text-xs text-muted-foreground">{formatDateDisplay(run.process_date)}</p>
                                        </div>
                                        {statusBadge(run.status)}
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-sm">Quick Links</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-2 gap-2">
                            {quickLinks.map((link) => (
                                <Button
                                    key={link.href}
                                    variant="outline"
                                    size="sm"
                                    className="justify-start h-auto py-2"
                                    onClick={() => router.push(link.href)}
                                >
                                    <link.icon className="h-3.5 w-3.5 mr-2 shrink-0" />
                                    <span className="text-xs">{link.label}</span>
                                </Button>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
