'use server';

import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { VardhiDailyReportClient } from "@/components/bill-generated";

export default async function VardhiDailyReportPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'BILL_GENERATED', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'BILL_GENERATED', 'CREATE') ?? false;
    const canEdit = hasPermission(role, 'BILL_GENERATED', 'UPDATE') ?? false;
    const canDelete = hasPermission(role, 'BILL_GENERATED', 'DELETE') ?? false;

    return <VardhiDailyReportClient />;
}
