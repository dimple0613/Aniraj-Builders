import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { DesignationsClient } from "@/components/hr/designations/DesignationsClient";

export default async function HRDesignationsPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'HR_DESIGNATIONS', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'HR_DESIGNATIONS', 'CREATE');
    const canEdit = hasPermission(role, 'HR_DESIGNATIONS', 'UPDATE');
    const canDelete = hasPermission(role, 'HR_DESIGNATIONS', 'DELETE');

    return (
        <div className="flex-1 space-y-4">
            <DesignationsClient canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
        </div>
    );
}
