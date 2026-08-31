'use server';

import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { ItemMasterClient } from '@/components/item-master';

export default async function ItemMasterPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'ITEM_MASTER', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'ITEM_MASTER', 'CREATE') ?? false;
    const canEdit = hasPermission(role, 'ITEM_MASTER', 'UPDATE') ?? false;
    const canDelete = hasPermission(role, 'ITEM_MASTER', 'DELETE') ?? false;

    return (
        <div className="flex-1 space-y-4">
            <ItemMasterClient
                canCreate={canCreate}
                canEdit={canEdit}
                canDelete={canDelete}
            />
        </div>
    );
}
