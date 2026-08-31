import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { HolidaysClient } from "@/components/hr/holidays/HolidaysClient";

export default async function HRHolidaysPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'HR_HOLIDAYS', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'HR_HOLIDAYS', 'CREATE');
    const canEdit = hasPermission(role, 'HR_HOLIDAYS', 'UPDATE');
    const canDelete = hasPermission(role, 'HR_HOLIDAYS', 'DELETE');

    return (
        <div className="flex-1 space-y-4">
            <HolidaysClient canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
        </div>
    );
}
