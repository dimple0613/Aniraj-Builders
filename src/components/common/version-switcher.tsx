"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import axios from "axios"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { useCompanyContext } from "@/lib/company-context"

interface Company {
    id: string;
    company_name: string;
}

export function VersionSwitcher({
    currentCompany,
}: {
    currentCompany: any
}) {
    const { data: session } = useSession();
    const { switchCompany } = useCompanyContext();
    const [companies, setCompanies] = React.useState<Company[]>([]);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        if (session?.user?.role === "SuperAdmin") {
            fetchCompanies();
        }
    }, [session?.user?.role]);

    const fetchCompanies = async () => {
        try {
            const response = await axios.get("/api/companies?limit=9999");
            setCompanies(response.data.data);
        } catch (error) {
            console.error("Failed to fetch companies", error);
        }
    };

    const handleCompanyChange = async (companyId: string) => {
        setLoading(true);
        try {
            await switchCompany(companyId);
        } catch (error) {
            toast.error("Failed to switch company");
        } finally {
            setLoading(false);
        }
    };
    return (
        <>
            {
                session?.user?.role === "SuperAdmin" ?
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <SidebarMenuButton
                                        className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                                    >
                                        <div className=" text-sidebar-primary-foreground flex aspect-square  items-center justify-center rounded-lg">
                                            {currentCompany?.logo ? (
                                                <img src={currentCompany?.logo} alt="Logo" className="h-5 w-5 object-contain" />
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="tabler-icon tabler-icon-inner-shadow-top !size-5 text-black"><path d="M5.636 5.636a9 9 0 1 0 12.728 12.728a9 9 0 0 0 -12.728 -12.728z"></path><path d="M16.243 7.757a6 6 0 0 0 -8.486 0"></path></svg>
                                            )}

                                        </div>
                                        <div className="flex flex-col gap-0.5 leading-none">
                                            <span className="text-base font-semibold">{currentCompany?.company_name || 'Aniraj Bilders'}</span>
                                        </div>
                                        <ChevronsUpDown className="ml-auto" />
                                    </SidebarMenuButton>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    className="w-(--radix-dropdown-menu-trigger-width)"
                                    align="start"
                                >
                                    {companies.map((company) => (
                                        <DropdownMenuItem
                                            key={company.id}
                                            onSelect={() => handleCompanyChange(company.id)}
                                        >
                                            {company.company_name}
                                            {company.id === currentCompany?.id && <Check className="ml-auto" />}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </SidebarMenuItem>
                    </SidebarMenu>
                    :
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton
                                asChild
                                className="data-[slot=sidebar-menu-button]:!p-1.5"
                            >
                                <a href="#">
                                    {currentCompany?.logo ? (
                                        <img src={currentCompany?.logo} alt="Logo" className="h-5 w-5 object-contain" />
                                    ) : (
                                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="tabler-icon tabler-icon-inner-shadow-top !size-5"><path d="M5.636 5.636a9 9 0 1 0 12.728 12.728a9 9 0 0 0 -12.728 -12.728z"></path><path d="M16.243 7.757a6 6 0 0 0 -8.486 0"></path></svg>
                                    )}
                                    <span className="text-base font-semibold">{currentCompany?.company_name || 'Aniraj Bilders'}</span>
                                </a>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
            }
        </>
    )
}
