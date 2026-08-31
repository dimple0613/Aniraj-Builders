'use server';

import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { AYMasterClient } from '@/components/ay-masters';

export default async function AYMasterPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'AY_MASTER', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'AY_MASTER', 'CREATE') ?? false;
    const canEdit = hasPermission(role, 'AY_MASTER', 'UPDATE') ?? false;
    const canDelete = hasPermission(role, 'AY_MASTER', 'DELETE') ?? false;

    return (
        <div className="flex-1 space-y-4">
            <AYMasterClient />
        </div>
    );
}
