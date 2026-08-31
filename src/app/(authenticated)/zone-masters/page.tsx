'use server';

import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { ZoneMasterClient } from '@/components/zone-masters';

export default async function ZoneMasterPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'ZONE', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'ZONE', 'CREATE') ?? false;
    const canEdit = hasPermission(role, 'ZONE', 'UPDATE') ?? false;
    const canDelete = hasPermission(role, 'ZONE', 'DELETE') ?? false;

    return (
        <div className="flex-1 space-y-4">
            <ZoneMasterClient />
        </div>
    );
}
