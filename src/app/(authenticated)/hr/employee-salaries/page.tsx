import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { EmployeeSalariesClient } from "@/components/hr/payroll/employee-salaries/EmployeeSalariesClient";

export default async function HREmployeeSalariesPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'HR_EMPLOYEE_SALARIES', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'HR_EMPLOYEE_SALARIES', 'CREATE');
    const canEdit = hasPermission(role, 'HR_EMPLOYEE_SALARIES', 'UPDATE');
    const canDelete = hasPermission(role, 'HR_EMPLOYEE_SALARIES', 'DELETE');

    return (
        <div className="flex-1 space-y-4">
            <EmployeeSalariesClient canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
        </div>
    );
}
