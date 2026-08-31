import { getServerSession } from "next-auth"
import { authOptions } from '@/lib/auth';
import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar"
import { CompanyProvider } from '@/lib/company-context';
import { DynamicSidebar, DynamicHeader } from '@/components/common/client-layout-components';

export const dynamic = 'force-dynamic';

export default async function AuthenticatedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role;
    return (
        <CompanyProvider>
            <SidebarProvider
                style={
                    {
                        "--sidebar-width": "calc(var(--spacing) * 72)",
                        "--header-height": "calc(var(--spacing) * 12)",
                    } as React.CSSProperties
                }
            >
                <DynamicSidebar variant="inset"  role={role}/>
                <SidebarInset>
                    <DynamicHeader />
                    <div className="flex flex-1 flex-col">
                        <div className="@container/main flex flex-1 flex-col gap-2">
                            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                              
                              <div className='*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4'>{children}</div>  
                            </div>
                        </div>
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </CompanyProvider>
    );
}
