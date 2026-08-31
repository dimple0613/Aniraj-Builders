'use server';

import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { ItemManagementClient } from '@/components/item-management';

export default async function ItemManagementPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'ITEMS', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'ITEMS', 'CREATE') ?? false;
    const canEdit = hasPermission(role, 'ITEMS', 'UPDATE') ?? false;
    const canDelete = hasPermission(role, 'ITEMS', 'DELETE') ?? false;

    return (
        <div className="flex-1 space-y-4">
            <ItemManagementClient />
        </div>
    );
}
