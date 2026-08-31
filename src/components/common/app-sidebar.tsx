"use client"

import * as React from "react"
import { NavDocuments } from "@/components/common/nav-documents"
import { NavUser } from "@/components/common/nav-user"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
} from "@/components/ui/sidebar"
import { getAllRoutes } from "@/lib/route-discovery"
import { useCompanyContext } from "@/lib/company-context"
import { VersionSwitcher } from "./version-switcher"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
    const routes = getAllRoutes(props?.role);
    const { currentCompany } = useCompanyContext();

    const filteredRoutes = routes.map((group) => {
        if (!group.children) return group;
        const allowedModules = currentCompany?.module_access;
        if (!allowedModules || !Array.isArray(allowedModules) || allowedModules.length === 0) {
            return group;
        }
        return {
            ...group,
            children: group.children.filter((route: any) =>
                allowedModules.includes(route.label)
            ),
        };
    }).filter((group) => group.children && group.children.length > 0);

    return (
        <Sidebar collapsible="offcanvas" {...props}>
            <SidebarHeader>
                <VersionSwitcher
                    currentCompany={currentCompany}
                />
            </SidebarHeader>
            <SidebarContent>
                <NavDocuments routes={filteredRoutes} />
            </SidebarContent>
            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    )
}
