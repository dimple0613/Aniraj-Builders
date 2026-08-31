import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { DocumentsClient } from "@/components/documents/DocumentsClient";

export default async function DocumentsPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'DOCUMENTS', 'READ')) {
        return <AccessDenied />;
    }

    const canCreate = hasPermission(role, 'DOCUMENTS', 'CREATE');
    const canEdit = hasPermission(role, 'DOCUMENTS', 'UPDATE');
    const canDelete = hasPermission(role, 'DOCUMENTS', 'DELETE');

    return (
        <div className="flex-1 space-y-4">
            <DocumentsClient canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
        </div>
    );
}
