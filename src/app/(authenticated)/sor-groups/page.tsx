import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { GroupTable } from "@/components/sor-groups";

export default async function SORGroupsPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'ITEMS', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'ITEMS', 'CREATE') ?? false;
    const canEdit = hasPermission(role, 'ITEMS', 'UPDATE') ?? false;
    const canDelete = hasPermission(role, 'ITEMS', 'DELETE') ?? false;

    return <GroupTable />;
}
