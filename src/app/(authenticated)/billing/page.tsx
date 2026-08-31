import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { BillingClient } from "@/components/billing";

export default async function BillingListPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'BILLING', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'BILLING', 'CREATE') ?? false;
    const canEdit = hasPermission(role, 'BILLING', 'UPDATE') ?? false;
    const canDelete = hasPermission(role, 'BILLING', 'DELETE') ?? false;

    return (
        <div className="flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
            <BillingClient />
        </div>
    );
}
