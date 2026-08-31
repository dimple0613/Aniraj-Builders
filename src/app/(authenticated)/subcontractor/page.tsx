'use server';

import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { SubcontractorManagementClient } from '@/components/subcontractor-management';

export default async function SubcontractorManagementPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'SUBCONTRACTORS', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'SUBCONTRACTORS', 'CREATE') ?? false;
    const canEdit = hasPermission(role, 'SUBCONTRACTORS', 'UPDATE') ?? false;
    const canDelete = hasPermission(role, 'SUBCONTRACTORS', 'DELETE') ?? false;

    return (
        <div className="flex-1 space-y-4">
            <SubcontractorManagementClient 
                canCreate={canCreate} 
                canEdit={canEdit} 
                canDelete={canDelete} 
            />
        </div>
    );
}
