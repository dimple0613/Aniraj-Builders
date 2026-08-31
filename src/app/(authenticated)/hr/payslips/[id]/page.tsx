import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { PayslipDetailClient } from "@/components/hr/payroll/payslips/PayslipDetailClient";

export default async function HRPayslipDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'HR_PAYSLIPS', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'HR_PAYSLIPS', 'CREATE');
    const canEdit = hasPermission(role, 'HR_PAYSLIPS', 'UPDATE');
    const canDelete = hasPermission(role, 'HR_PAYSLIPS', 'DELETE');

    return (
        <div className="flex-1 space-y-4">
            <PayslipDetailClient id={id} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
        </div>
    );
}
