import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { PayslipsClient } from "@/components/hr/payroll/payslips/PayslipsClient";

export default async function HRPayslipsPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'HR_PAYSLIPS', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'HR_PAYSLIPS', 'CREATE');
    const canEdit = hasPermission(role, 'HR_PAYSLIPS', 'UPDATE');
    const canDelete = hasPermission(role, 'HR_PAYSLIPS', 'DELETE');

    return (
        <div className="flex-1 space-y-4">
            <PayslipsClient canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
        </div>
    );
}
