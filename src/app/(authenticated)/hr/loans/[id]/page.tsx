import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { LoanDetailClient } from "@/components/hr/payroll/loans/LoanDetailClient";

export default async function HRLoanDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'HR_LOANS', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'HR_LOANS', 'CREATE');
    const canEdit = hasPermission(role, 'HR_LOANS', 'UPDATE');
    const canDelete = hasPermission(role, 'HR_LOANS', 'DELETE');

    return (
        <div className="flex-1 space-y-4">
            <LoanDetailClient id={id} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
        </div>
    );
}
