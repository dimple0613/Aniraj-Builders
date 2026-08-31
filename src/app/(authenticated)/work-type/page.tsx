'use server';

import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { WorkTypeClient } from '@/components/work-type';

export default async function WorkTypePage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'WORK_TYPE', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'WORK_TYPE', 'CREATE') ?? false;
    const canEdit = hasPermission(role, 'WORK_TYPE', 'UPDATE') ?? false;
    const canDelete = hasPermission(role, 'WORK_TYPE', 'DELETE') ?? false;

    return (
        <div className="flex-1 space-y-4">
            <WorkTypeClient />
        </div>
    );
}
