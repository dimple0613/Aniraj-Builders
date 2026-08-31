"use client"

import { usePathname } from "next/navigation"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { NotificationBell } from "@/components/common/notification-bell"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { DownloadDatabaseButton } from "@/components/common/download-database-button"

export function SiteHeader() {
    const pathname = usePathname()

    const segments = pathname.split("/").filter(Boolean)

    const formatSegment = (segment: string) => {
        if (!isNaN(Number(segment))) return segment

        return segment
            .split("-")
            .map(word =>
                word.charAt(0).toUpperCase() + word.slice(1)
            )
            .join(" ")
    }

    const title =
        segments.length > 0
            ? segments.map(formatSegment).join(" - ")
            : "Dashboard"

    return (
        <header className="group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 flex h-12 shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear sticky top-0 bg-white">
            <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
                <SidebarTrigger className="-ml-1" />
                <Separator
                    orientation="vertical"
                    className="mx-2 data-[orientation=vertical]:h-4"
                />
                <h1 className="text-base font-medium">{title}</h1>
                <div className="ml-auto flex items-center gap-1">
                    <DownloadDatabaseButton />
                    <NotificationBell />
                </div>
            </div>
        </header>
    )
}