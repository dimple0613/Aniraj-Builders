import { getServerSession } from "next-auth"
import { authOptions } from '@/lib/auth'
import { hasPermission } from '@/lib/permissions'
import { AccessDenied } from '@/components/auth/AccessDenied'
import { VardhiClient } from '@/components/vardhi'

export default async function VardhiListPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'VARDHI', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'VARDHI', 'CREATE') ?? false;
    const canEdit = hasPermission(role, 'VARDHI', 'UPDATE') ?? false;
    const canDelete = hasPermission(role, 'VARDHI', 'DELETE') ?? false;


    return (
        <div className="flex flex-col gap-4 md:gap-6  w-full overflow-hidden">
            <VardhiClient />
        </div>
    )
}
