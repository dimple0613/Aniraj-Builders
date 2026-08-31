import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { LeaveClient } from "@/components/hr/leave/LeaveClient";

export default async function HRLeavePage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'HR_LEAVE', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'HR_LEAVE', 'CREATE');
    const canEdit = hasPermission(role, 'HR_LEAVE', 'UPDATE');
    const canDelete = hasPermission(role, 'HR_LEAVE', 'DELETE');
    const canApprove = hasPermission(role, 'HR_LEAVE', 'APPROVE');

    return (
        <div className="flex-1 space-y-4">
            <LeaveClient canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} canApprove={canApprove} />
        </div>
    );
}
