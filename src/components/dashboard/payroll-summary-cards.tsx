'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Users, FileText, DollarSign, PiggyBank } from 'lucide-react';

interface PayrollStats {
    totalEmployees: number;
    activePayrollRuns: number;
    pendingReimbursements: number;
    activeLoans: number;
}

export function PayrollSummaryCards() {
    const [stats, setStats] = useState<PayrollStats | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = useCallback(async () => {
        try {
            const res = await axios.get('/api/hr/payroll/dashboard');
            setStats(res.data);
        } catch {
            toast.error('Failed to load payroll summary');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchStats(); }, [fetchStats]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const cards = [
        { title: 'Total Employees', value: stats?.totalEmployees || 0, icon: Users },
        { title: 'Active Payroll Runs', value: stats?.activePayrollRuns || 0, icon: FileText },
        { title: 'Pending Reimbursements', value: stats?.pendingReimbursements || 0, icon: DollarSign, highlight: true },
        { title: 'Active Loans', value: stats?.activeLoans || 0, icon: PiggyBank },
    ];

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {cards.map((card) => (
                <Card key={card.title}>
                    <CardHeader className="flex flex-row items-center justify-between py-3">
                        <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                        <card.icon className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="py-2">
                        <div className={`text-2xl font-bold ${card.highlight ? 'text-yellow-600' : ''}`}>
                            {card.value}
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
