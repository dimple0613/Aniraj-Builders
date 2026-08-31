import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { PayrollRunsClient } from "@/components/hr/payroll/payroll-runs/PayrollRunsClient";

export default async function HRPayrollRunsPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'HR_PAYROLL_RUNS', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'HR_PAYROLL_RUNS', 'CREATE');
    const canEdit = hasPermission(role, 'HR_PAYROLL_RUNS', 'UPDATE');
    const canDelete = hasPermission(role, 'HR_PAYROLL_RUNS', 'DELETE');

    return (
        <div className="flex-1 space-y-4">
            <PayrollRunsClient canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
        </div>
    );
}
