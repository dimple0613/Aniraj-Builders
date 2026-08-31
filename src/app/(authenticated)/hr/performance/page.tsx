import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { PerformanceClient } from "@/components/hr/performance/PerformanceClient";

export default async function HRPerformancePage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'HR_PERFORMANCE', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'HR_PERFORMANCE', 'CREATE');
    const canEdit = hasPermission(role, 'HR_PERFORMANCE', 'UPDATE');
    const canDelete = hasPermission(role, 'HR_PERFORMANCE', 'DELETE');

    return (
        <div className="flex-1 space-y-4">
            <PerformanceClient canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
        </div>
    );
}
