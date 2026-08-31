'use client';

import { DashboardCards, DashboardHeader } from '@/components/dashboard';

export function AccountantDashboard({ data, userName, role }: any) {
  const metrics = data?.metrics || [];

  return (
    <>
      <DashboardHeader
        title="Command Center"
        description={`Welcome back, ${userName || 'User'}. Here's your ${role || 'dashboard'} overview.`}
      />
      <DashboardCards metrics={metrics} />
    </>
  );
}
