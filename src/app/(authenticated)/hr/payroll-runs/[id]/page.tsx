import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { PayrollRunDetailClient } from "@/components/hr/payroll/payroll-runs/PayrollRunDetailClient";

export default async function HRPayrollRunDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'HR_PAYROLL_RUNS', 'READ')) {
        return <AccessDenied />;
    }

    return (
        <div className="flex-1 space-y-4">
            <PayrollRunDetailClient id={id} />
        </div>
    );
}
