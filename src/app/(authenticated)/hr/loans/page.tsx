import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { LoansClient } from "@/components/hr/payroll/loans/LoansClient";

export default async function HRLoansPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'HR_LOANS', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'HR_LOANS', 'CREATE');
    const canEdit = hasPermission(role, 'HR_LOANS', 'UPDATE');
    const canDelete = hasPermission(role, 'HR_LOANS', 'DELETE');

    return (
        <div className="flex-1 space-y-4">
            <LoansClient canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
        </div>
    );
}
