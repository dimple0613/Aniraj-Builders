'use server';

import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { EditVardhiClient } from '@/components/vardhi/edit';

export default async function EditVardhiPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'VARDHI', 'UPDATE')) {
        return <AccessDenied />;
    }

    return (
        <div className="flex-1 space-y-4">
            <EditVardhiClient userRole={role} />
        </div>
    );
}
