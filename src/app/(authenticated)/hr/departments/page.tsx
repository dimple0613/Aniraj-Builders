import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { DepartmentsClient } from "@/components/hr/departments/DepartmentsClient";

export default async function HRDepartmentsPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'HR_DEPARTMENTS', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'HR_DEPARTMENTS', 'CREATE');
    const canEdit = hasPermission(role, 'HR_DEPARTMENTS', 'UPDATE');
    const canDelete = hasPermission(role, 'HR_DEPARTMENTS', 'DELETE');

    return (
        <div className="flex-1 space-y-4">
            <DepartmentsClient canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
        </div>
    );
}
