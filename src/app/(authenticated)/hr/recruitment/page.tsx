import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { RecruitmentClient } from "@/components/hr/recruitment/RecruitmentClient";

export default async function HRRecruitmentPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'HR_RECRUITMENT', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'HR_RECRUITMENT', 'CREATE');
    const canEdit = hasPermission(role, 'HR_RECRUITMENT', 'UPDATE');
    const canDelete = hasPermission(role, 'HR_RECRUITMENT', 'DELETE');

    return (
        <div className="flex-1 space-y-4">
            <RecruitmentClient canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
        </div>
    );
}
