import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { AnnouncementsClient } from "@/components/hr/announcements/AnnouncementsClient";

export default async function HRAnnouncementsPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'HR_ANNOUNCEMENTS', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'HR_ANNOUNCEMENTS', 'CREATE');
    const canEdit = hasPermission(role, 'HR_ANNOUNCEMENTS', 'UPDATE');
    const canDelete = hasPermission(role, 'HR_ANNOUNCEMENTS', 'DELETE');

    return (
        <div className="flex-1 space-y-4">
            <AnnouncementsClient canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
        </div>
    );
}
