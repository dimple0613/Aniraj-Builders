import { ReactNode } from 'react';

interface DashboardLayoutProps {
  children: ReactNode;
  header: ReactNode;
}

export function DashboardLayout({ children, header }: DashboardLayoutProps) {
  return (
    <div className="flex-1 space-y-4">
      {header}
      {children}
    </div>
  );
}
