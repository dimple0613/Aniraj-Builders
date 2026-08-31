'use server';

import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { AddVardhiClient } from '@/components/vardhi/add';

export default async function AddVardhiPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'VARDHI', 'CREATE')) {
        return <AccessDenied />;
    }

    return (
        <div className="flex-1 space-y-4">
            <AddVardhiClient />
        </div>
    );
}
