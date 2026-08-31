import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { PayrollDashboardClient } from "@/components/hr/payroll/dashboard/PayrollDashboardClient";

export default async function HRPayrollDashboardPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'HR_PAYROLL_DASHBOARD', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'HR_PAYROLL_DASHBOARD', 'CREATE');
    const canEdit = hasPermission(role, 'HR_PAYROLL_DASHBOARD', 'UPDATE');
    const canDelete = hasPermission(role, 'HR_PAYROLL_DASHBOARD', 'DELETE');

    return (
        <div className="flex-1 space-y-4">
            <PayrollDashboardClient canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
        </div>
    );
}
