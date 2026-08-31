export interface DashboardMetric {
  label: string;
  value: number | string;
  icon?: string;
  isAmount?: boolean;
  description?: any;
  message?: any;
}

export interface StageMetric {
  label: string;
  value: number;
  icon: string;
}

export interface DashboardData {
  type: string;
  metrics?: DashboardMetric[];
  stageMetrics?: StageMetric[];
  recentActivity?: Array<{
    id: string;
    title: string;
    description?: string;
    timestamp?: Date;
    status?: string;
  }>;
}

export interface DashboardCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export interface DashboardHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}
