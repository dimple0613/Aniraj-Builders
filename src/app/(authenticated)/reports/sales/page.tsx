'use server';

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { SalesReportTable } from "@/components/reports/sales-report-table";

export default async function SalesReportPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'REPORTS', 'READ')) {
        return <AccessDenied />;
    }

    return <SalesReportTable />;
}
