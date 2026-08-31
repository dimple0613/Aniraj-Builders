'use server';

import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { UserClient } from '@/components/users/user-table';

export default async function UsersPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'USERS', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'USERS', 'CREATE') ?? false;
    const canEdit = hasPermission(role, 'USERS', 'UPDATE') ?? false;
    const canDelete = hasPermission(role, 'USERS', 'DELETE') ?? false;

    return (
        <div className="flex-1 space-y-4">
            <UserClient />
        </div>
    );
}
