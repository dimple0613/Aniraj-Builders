import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { HRMSEmployeesPage } from "@/components/hr/employees/HRMSEmployeesPage";

export default async function HREmployeesPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'HR_EMPLOYEES', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'HR_EMPLOYEES', 'CREATE');
    const canEdit = hasPermission(role, 'HR_EMPLOYEES', 'UPDATE');
    const canDelete = hasPermission(role, 'HR_EMPLOYEES', 'DELETE');

    return (
        <div className="flex-1 space-y-4">
            <HRMSEmployeesPage canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
        </div>
    );
}
