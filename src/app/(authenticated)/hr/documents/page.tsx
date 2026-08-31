import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { DocumentsClient } from "@/components/hr/documents/DocumentsClient";

export default async function HRDocumentsPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'HR_DOCUMENTS', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'HR_DOCUMENTS', 'CREATE');
    const canEdit = hasPermission(role, 'HR_DOCUMENTS', 'UPDATE');
    const canDelete = hasPermission(role, 'HR_DOCUMENTS', 'DELETE');

    return (
        <div className="flex-1 space-y-4">
            <DocumentsClient canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
        </div>
    );
}
