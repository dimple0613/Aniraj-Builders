import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { FinancialYearsClient } from "@/components/hr/payroll/financial-years/FinancialYearsClient";

export default async function HRFinancialYearsPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'HR_FINANCIAL_YEARS', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'HR_FINANCIAL_YEARS', 'CREATE');
    const canEdit = hasPermission(role, 'HR_FINANCIAL_YEARS', 'UPDATE');
    const canDelete = hasPermission(role, 'HR_FINANCIAL_YEARS', 'DELETE');

    return (
        <div className="flex-1 space-y-4">
            <FinancialYearsClient canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
        </div>
    );
}
