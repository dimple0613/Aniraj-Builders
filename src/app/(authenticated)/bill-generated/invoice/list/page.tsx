import { getServerSession, authOptions } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { VardhiInvoiceListClient } from "@/components/bill-generated";

export default async function VardhiInvoiceListPage() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;

    if (!hasPermission(role, 'VARDHI_INVOICE', 'READ')) {
        return <AccessDenied />;
    }

    return <VardhiInvoiceListClient />;
}
