import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { ReimbursementDetailClient } from "@/components/hr/payroll/reimbursement-requests/ReimbursementDetailClient";

export default async function HRReimbursementDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'HR_REIMBURSEMENT_REQUESTS', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'HR_REIMBURSEMENT_REQUESTS', 'CREATE');
    const canEdit = hasPermission(role, 'HR_REIMBURSEMENT_REQUESTS', 'UPDATE');
    const canDelete = hasPermission(role, 'HR_REIMBURSEMENT_REQUESTS', 'DELETE');

    return (
        <div className="flex-1 space-y-4">
            <ReimbursementDetailClient id={id} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
        </div>
    );
}
