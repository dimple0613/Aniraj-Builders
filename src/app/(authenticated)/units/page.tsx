import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { UnitTable } from "@/components/units";

export default async function UnitsPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'UNIT', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'UNIT', 'CREATE') ?? false;
    const canEdit = hasPermission(role, 'UNIT', 'UPDATE') ?? false;
    const canDelete = hasPermission(role, 'UNIT', 'DELETE') ?? false;

    return <UnitTable />;
}
