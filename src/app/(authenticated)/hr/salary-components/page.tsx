import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { SalaryComponentsClient } from "@/components/hr/payroll/salary-components/SalaryComponentsClient";

export default async function HRSalaryComponentsPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'HR_SALARY_COMPONENTS', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'HR_SALARY_COMPONENTS', 'CREATE');
    const canEdit = hasPermission(role, 'HR_SALARY_COMPONENTS', 'UPDATE');
    const canDelete = hasPermission(role, 'HR_SALARY_COMPONENTS', 'DELETE');

    return (
        <div className="flex-1 space-y-4">
            <SalaryComponentsClient canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
        </div>
    );
}
