import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { CompanyTable } from "@/components/company";
import { canAddCompany, canEditCompany } from "@/lib/company-access";


export default async function CompanyPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'COMPANY', 'READ')) {
        return <AccessDenied />;
    }

    const hasCreatePermission = hasPermission(role, 'COMPANY', 'CREATE') ?? false;
    const hasUpdatePermission = hasPermission(role, 'COMPANY', 'UPDATE') ?? false;

    const allowAdd = hasCreatePermission && await canAddCompany();
    const allowEdit = hasUpdatePermission && await canEditCompany();

    return <CompanyTable canCreate={allowAdd} canEdit={allowEdit} />;
}
