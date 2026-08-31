import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { PayrollReportsClient } from "@/components/hr/payroll/reports/PayrollReportsClient";

export default async function HRPayrollReportsPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'HR_PAYROLL_REPORTS', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'HR_PAYROLL_REPORTS', 'CREATE');
    const canEdit = hasPermission(role, 'HR_PAYROLL_REPORTS', 'UPDATE');
    const canDelete = hasPermission(role, 'HR_PAYROLL_REPORTS', 'DELETE');

    return (
        <div className="flex-1 space-y-4">
            <PayrollReportsClient canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
        </div>
    );
}
