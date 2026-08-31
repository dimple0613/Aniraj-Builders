'use server';

import { getServerSession } from "next-auth"
import { authOptions } from '@/lib/auth';
import { getDashboardStats } from '@/app/actions/dashboard-actions';
import { SuperAdminDashboard } from '@/components/dashboard/super-admin-dashboard';
import { AdminDashboard } from '@/components/dashboard/admin-dashboard';
import { AccountantDashboard } from '@/components/dashboard/accountant-dashboard';
import { SupervisorDashboard } from '@/components/dashboard/supervisor-dashboard';
import { DataEntryDashboard } from '@/components/dashboard/data-entry-dashboard';
import { redirect } from 'next/navigation';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { AlertCircle } from 'lucide-react';
import { AccessDenied } from "@/components/auth/AccessDenied";

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);

    if (!session) {
        return (
            <AccessDenied />
        );
    }

    const role = (session.user as any)?.role as any;
    const userName = session.user?.name;

    let stats;
    try {
        stats = await getDashboardStats();
    } catch (error) {
        return (
            <Alert variant="destructive" className="m-8">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Unable to load dashboard data</AlertTitle>
                <AlertDescription>
                    There was an error communicating with the database.
                </AlertDescription>
            </Alert>
        );
    }

    const dashboardProps = {
        data: stats,
        userName,
        role,
    };

    switch (role) {
        case 'SuperAdmin':
            return <SuperAdminDashboard {...dashboardProps} />;
        case 'Admin':
            return <AdminDashboard {...dashboardProps} />;
        case 'Accountant':
            return <AccountantDashboard {...dashboardProps} />;
        case 'Supervisor':
            return <SupervisorDashboard data={stats as any} />;
        case 'DataEntry':
            return <DataEntryDashboard {...dashboardProps} />;
        case 'Zone':
            redirect('/vardhi-summary');
        default:
            return (
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Unauthorized Role</AlertTitle>
                    <AlertDescription>
                        Your role does not have access to this dashboard.
                    </AlertDescription>
                </Alert>
            );
    }
}
