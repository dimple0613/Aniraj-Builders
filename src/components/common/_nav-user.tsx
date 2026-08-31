"use client"

import {
    BellIcon,
    CreditCardIcon,
    DownloadIcon,
    LogOutIcon,
    MoreVerticalIcon,
    UserCircleIcon,
} from "lucide-react"

import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@/components/ui/avatar"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    useSidebar,
} from "@/components/ui/sidebar"

import { signOut, useSession } from 'next-auth/react';
import { useUser } from "@/lib/user-context"
import { useEffect, useState } from "react"
import { useRouter } from 'next/navigation';

export function NavUser() {
    const { isMobile } = useSidebar()
    const { data: session, update } = useSession();
    const router = useRouter();
    const { user: userContext, setUser } = useUser();
    const [isDownloading, setIsDownloading] = useState(false);

    const isSuperAdmin = session?.user?.role === 'SuperAdmin';

    useEffect(() => {
        if (session?.user) {
            setUser({
                name: session.user.name || null,
                email: session.user.email || null,
                profile_photo: (session.user.profile_photo as string | null) || null,
            });
        }
    }, [session, setUser]);

    const userName = userContext?.name || session?.user?.name || undefined;
    const userEmail = userContext?.email || session?.user?.email || undefined;
    const userImage = userContext?.profile_photo || (session?.user?.profile_photo as string | null | undefined) || undefined;

    const handleDownloadDatabase = async () => {
        setIsDownloading(true);
        try {
            const response = await fetch('/api/admin/backup/download');
            if (!response.ok) {
                const errorData = await response.json().catch(() => null);
                throw new Error(errorData?.message || 'Backup failed');
            }
            const blob = await response.blob();
            const contentDisposition = response.headers.get('Content-Disposition');
            let filename = 'database-backup.sql';
            const match = contentDisposition?.match(/filename="(.+?)"/);
            if (match) filename = match[1];
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (err: any) {
            alert(err?.message || 'Failed to download database backup');
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <SidebarMenuButton
                            size="lg"
                            className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
                        >
                            <Avatar className="h-8 w-8 rounded-lg grayscale">
                                <AvatarImage src={userImage} alt={userName} className='aspect-square size-full' />
                                <AvatarFallback>{userName?.slice(0, 2).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <div className="grid flex-1 text-left text-sm leading-tight">
                                <span className="truncate font-medium">{userName}</span>
                                <span className="truncate text-xs text-muted-foreground">
                                    {userEmail}
                                </span>
                            </div>
                            <MoreVerticalIcon className="ml-auto size-4" />
                        </SidebarMenuButton>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                        className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
                        side={isMobile ? "bottom" : "right"}
                        align="end"
                        sideOffset={4}
                    >
                        <DropdownMenuLabel className="p-0 font-normal">
                            <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                                <Avatar className="h-8 w-8 rounded-lg">
                                    <AvatarImage src={userImage} alt={userName} />
                                    <AvatarFallback>{userName?.slice(0, 2).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div className="grid flex-1 text-left text-sm leading-tight">
                                    <span className="truncate font-medium">{userName}</span>
                                    <span className="truncate text-xs text-muted-foreground">
                                        {userEmail}
                                    </span>
                                </div>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                            <DropdownMenuItem onClick={() => router.push('/profile')}>
                                <UserCircleIcon />
                                Account
                            </DropdownMenuItem>
                        </DropdownMenuGroup>
                        <DropdownMenuSeparator />
                        {isSuperAdmin && (
                            <DropdownMenuItem onClick={handleDownloadDatabase} disabled={isDownloading}>
                                <DownloadIcon />
                                {isDownloading ? 'Backing up...' : 'Download Database'}
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => signOut({ callbackUrl: '/login' })}>
                            <LogOutIcon />
                            Log out
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
