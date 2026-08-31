import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar"
import { CompanyProvider } from "@/lib/company-context"
import { getPublicVardhiData } from "../actions/public-vardhi-full"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function Layout({
    children,
    params,
}: {
    children: React.ReactNode
    params: Promise<{ company_slug: string }>
}) {
    const { company_slug } = await params

    const result = await getPublicVardhiData(company_slug)

    if (!result?.company) {
        notFound()
    }

    return (
        <CompanyProvider>
            <SidebarProvider
                style={
                    {
                        "--sidebar-width": "calc(var(--spacing) * 72)",
                        "--header-height": "calc(var(--spacing) * 12)",
                    } as React.CSSProperties
                }
                className="bg-sidebar"
            >
                <SidebarInset className="ml-2 rounded-xl shadow max-w-4/5 flex-[0_0_80%] mx-auto my-[10px]">
                    <div className="flex flex-1 flex-col">
                        <div className="@container/main flex flex-1 flex-col gap-2">
                            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 my-auto">
                                <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
                                    {children}
                                </div>
                            </div>
                        </div>
                    </div>
                </SidebarInset>
            </SidebarProvider>
        </CompanyProvider>
    )
}