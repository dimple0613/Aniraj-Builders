'use client';

import { DashboardCards, DashboardHeader } from '@/components/dashboard';
import { ZoneProgressChart } from '@/components/dashboard/zone-progress-chart';
import { PayrollSummaryCards } from '@/components/dashboard/payroll-summary-cards';
import { RecentTransactionsWidget } from '@/components/dashboard/recent-transactions-widget';
import { ProjectProgressWidget } from '@/components/dashboard/project-progress-widget';
import { ReceivablesPayablesWidget } from '@/components/dashboard/receivables-payables-widget';

interface DashboardData {
  metrics?: any[];
  recentTransactions?: any[];
  projects?: any[];
  receivable?: number;
  payable?: number;
  partyCount?: number;
}

export function AdminDashboard({ data, userName, role }: any) {
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
