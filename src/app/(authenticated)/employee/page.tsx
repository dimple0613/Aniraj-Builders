'use server';

import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { EmployeeManagementClient } from '@/components/employee-management';

export default async function EmployeeManagementPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'EMPLOYEES', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'EMPLOYEES', 'CREATE') ?? false;
    const canEdit = hasPermission(role, 'EMPLOYEES', 'UPDATE') ?? false;
    const canDelete = hasPermission(role, 'EMPLOYEES', 'DELETE') ?? false;

    return (
        <div className="flex-1 space-y-4">
            <EmployeeManagementClient 
                canCreate={canCreate} 
                canEdit={canEdit} 
                canDelete={canDelete} 
            />
        </div>
    );
}