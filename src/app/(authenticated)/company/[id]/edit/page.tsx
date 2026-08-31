'use server';

import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { CompanyForm } from '@/components/company/CompanyForm';
import { canEditCompany } from "@/lib/company-access";

export default async function CompanyEditPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'COMPANY', 'UPDATE') || !(await canEditCompany())) {
        return <AccessDenied />;
    }

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 w-full">
        
            <CompanyForm mode="edit" />
        </div>
    );
}
