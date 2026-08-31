'use server';

import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { CompanyForm } from '@/components/company/CompanyForm';
import { canAddCompany } from "@/lib/company-access";

export default async function CompanyAddPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'COMPANY', 'CREATE') || !(await canAddCompany())) {
        return <AccessDenied />;
    }

    return (
        <CompanyForm mode="add" />
    );
}
