"use client"

import { useState } from "react"
import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown } from "lucide-react"

interface NavDocumentsProps {
    routes?: any[]
}

export function NavDocuments({ routes = [] }: NavDocumentsProps) {
    const pathname = usePathname()
    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({})

    if (!routes.length) return null

    const toggleGroup = (label: string) => {
        setOpenGroups((prev) => ({
            ...prev,
            [label]: !prev[label],
        }))
    }

    return (
        <>
            {routes.map((group) => {
                const hasManyChildren = group.children?.length > 2

                const isChildActive = group.children?.some((item: any) =>
                    pathname.startsWith(item.href)
                )

                const isOpen = openGroups[group.label] ?? isChildActive

                return (
                    <SidebarGroup
                        key={group.label}
                        className="group-data-[collapsible=icon]:hidden"
                    >
                        {/* 🔽 ONLY show toggle if more than 2 */}
                        {hasManyChildren ? (
                            <>
                                <SidebarGroupLabel
                                    onClick={() => toggleGroup(group.label)}
                                    className="cursor-pointer flex items-center justify-between px-2 py-2 rounded-lg hover:bg-muted/50"
                                >
                                    <span className="text-sm font-medium">
                                        {group.label}
                                    </span>

                                    <ChevronDown
                                        className={`h-4 w-4 transition-transform duration-200 ${isOpen
                                                ? "rotate-180 text-primary"
                                                : "text-muted-foreground"
                                            }`}
                                    />
                                </SidebarGroupLabel>

                                <div
                                    className={`overflow-hidden transition-all duration-300 ${isOpen ? "max-h-[800px] mt-1" : "max-h-0"
                                        }`}
                                >
                                    <SidebarMenu>
                                        {group.children?.map((item: any) => {
                                            const isActive =
                                                pathname === item.href ||
                                                pathname.startsWith(item.href + "/")

                                            return (
                                                <SidebarMenuItem key={item.label}>
                                                <SidebarMenuButton asChild>
                                                        <Link
                                                            href={item.href}
                                                            className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${isActive
                                                                            ? "bg-sky-100 text-sky-600"
                                                                            : "hover:bg-muted/50"
                                                                        }`}
                                                        >
                                                            {item.icon && <item.icon className="h-4 w-4" />}
                                                            <span className="text-sm">
                                                                {item.label}
                                                            </span>
                                                        </Link>
                                                    </SidebarMenuButton>
                                                </SidebarMenuItem>
                                            )
                                        })}
                                    </SidebarMenu>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* 🔹 No dropdown → show label + items directly */}
                                <SidebarGroupLabel className="px-2 py-2 text-sm font-medium text-muted-foreground">
                                    {group.label}
                                </SidebarGroupLabel>

                                <SidebarMenu>
                                    {group.children?.map((item: any) => {
                                        const isActive =
                                            pathname === item.href ||
                                            pathname.startsWith(item.href + "/")

                                        return (
                                            <SidebarMenuItem key={item.label}>
                                                    <SidebarMenuButton asChild>
                                                        <Link
                                                            href={item.href}
                                                            className={`flex items-center gap-2 px-2 py-1.5 rounded-md ${isActive
                                                                            ? "bg-sky-100 text-sky-600"
                                                                            : "hover:bg-muted/50"
                                                                        }`}
                                                        >
                                                            {item.icon && <item.icon className="h-4 w-4" />}
                                                            <span className="text-sm">
                                                                {item.label}
                                                            </span>
                                                        </Link>
                                                    </SidebarMenuButton>
                                            </SidebarMenuItem>
                                        )
                                    })}
                                </SidebarMenu>
                            </>
                        )}
                    </SidebarGroup>
                )
            })}
        </>
    )
}