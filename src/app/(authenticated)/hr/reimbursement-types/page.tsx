import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { ReimbursementTypesClient } from "@/components/hr/payroll/reimbursement-types/ReimbursementTypesClient";

export default async function HRReimbursementTypesPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'HR_REIMBURSEMENT_TYPES', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'HR_REIMBURSEMENT_TYPES', 'CREATE');
    const canEdit = hasPermission(role, 'HR_REIMBURSEMENT_TYPES', 'UPDATE');
    const canDelete = hasPermission(role, 'HR_REIMBURSEMENT_TYPES', 'DELETE');

    return (
        <div className="flex-1 space-y-4">
            <ReimbursementTypesClient canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
        </div>
    );
}
