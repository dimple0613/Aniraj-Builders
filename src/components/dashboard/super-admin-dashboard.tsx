'use client';

import { DashboardCards, DashboardHeader, ProjectProgressWidget, ReceivablesPayablesWidget, RecentTransactionsWidget } from '@/components/dashboard';
import { ZoneProgressChart } from '@/components/dashboard/zone-progress-chart';
import { PayrollSummaryCards } from '@/components/dashboard/payroll-summary-cards';

export function SuperAdminDashboard({ data, userName, role }: any) {
    const metrics = data?.metrics || [];
    const recentTransactions = data?.recentTransactions || [];
    const projects = data?.projects || [];

    const receivable = data?.receivable || 0;
    const payable = data?.payable || 0;
    const partyCount = data?.partyCount || 0;

    return (
        <>
            <DashboardHeader
                title="Command Center"
                description={`Welcome back, ${userName || 'User'}. Here's your ${role || 'dashboard'} overview.`}
            />
            <div className="space-y-6">
                <DashboardCards metrics={metrics} />

                <PayrollSummaryCards />

                <ZoneProgressChart />
            </div>
        </>
    );
}
