'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bell, CheckCheck, Eye } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import { toast } from 'sonner';

interface Notification {
    id: string;
    type: string;
    entity: string;
    action: string;
    entityId?: string;
    message: string;
    link?: string;
    isRead: boolean;
    createdAt: string;
}

export function NotificationBell() {
    const { data: session } = useSession();
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    const isSuperAdmin = (session?.user as any)?.role === 'SuperAdmin';

    const fetchNotifications = useCallback(async (isUnreadOnly = false) => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (isUnreadOnly) {
                params.set('unread_only', 'true');
            }
            params.set('limit', '5');

            const response = await axios.get(`/api/notifications?${params}`);
            if (response.data.success) {
                setNotifications(response.data.data || []);
                setUnreadCount(response.data.unreadCount || 0);
            }
        } catch (error: any) {
            if (error.response?.status !== 403) {
                console.error('Error fetching notifications:', error);
            }
        } finally {
            setLoading(false);
        }
    }, []);

    // Fetch unread count on mount and poll every 30 seconds
    useEffect(() => {
        if (!isSuperAdmin) return;

        fetchNotifications(true);

        const interval = setInterval(() => {
            fetchNotifications(true);
        }, 30000); // 30 seconds

        return () => clearInterval(interval);
    }, [fetchNotifications, isSuperAdmin]);

    // Fetch all notifications when dropdown opens
    useEffect(() => {
        if (open && isSuperAdmin) {
            fetchNotifications(false);
        }
    }, [open, fetchNotifications, isSuperAdmin]);

    const handleMarkAsRead = async (ids: string[]) => {
        try {
            await axios.put('/api/notifications', { ids });
            setNotifications(prev =>
                prev.map(n => ids.includes(n.id) ? { ...n, isRead: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - ids.length));
            toast.success(`Marked ${ids.length} notification(s) as read`);
        } catch (error) {
            toast.error('Failed to mark notifications as read');
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await axios.put('/api/notifications', { markAll: true });
            setNotifications(prev =>
                prev.map(n => ({ ...n, isRead: true }))
            );
            setUnreadCount(0);
            toast.success('All notifications marked as read');
        } catch (error) {
            toast.error('Failed to mark all as read');
        }
    };

    const handleNotificationClick = (notification: Notification) => {
        if (!notification.isRead) {
            handleMarkAsRead([notification.id]);
        }
        if (notification.link) {
            router.push(notification.link);
            setOpen(false);
        }
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h ago`;
        const diffDays = Math.floor(diffHours / 24);
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'Created': return 'text-green-600';
            case 'Updated': return 'text-blue-600';
            case 'Deleted': return 'text-red-600';
            default: return 'text-gray-600';
        }
    };

    // Only show for SuperAdmin
    if (!isSuperAdmin) {
        return null;
    }

    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                    <Bell className="h-5 w-5" />
                    {unreadCount > 0 && (
                        <Badge
                            variant="destructive"
                            className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
                        >
                            {unreadCount > 99 ? '99+' : unreadCount}
                        </Badge>
                    )}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 md:w-96 max-h-[70vh] overflow-y-auto">
                <DropdownMenuLabel className="flex items-center justify-between">
                    <span>Notifications</span>
                    {unreadCount > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-auto p-0 text-xs text-blue-600"
                            onClick={handleMarkAllAsRead}
                        >
                            <CheckCheck className="mr-1 h-3 w-3" />
                            Mark all read
                        </Button>
                    )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {loading ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                        Loading...
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                        No notifications
                    </div>
                ) : (
                    notifications.map((notification) => (
                        <DropdownMenuItem
                            key={notification.id}
                            className={`cursor-pointer ${!notification.isRead ? 'bg-muted/50' : ''}`}
                            onClick={() => handleNotificationClick(notification)}
                        >
                            <div className="flex flex-col gap-1 w-full">
                                <div className="flex items-center justify-between">
                                    <span className={`text-xs font-medium ${getActionColor(notification.action)}`}>
                                        {notification.action}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {formatTime(notification.createdAt)}
                                    </span>
                                </div>
                                <p className="text-sm">{(() => { try { const p = JSON.parse(notification.message); return p.text || notification.message; } catch { return notification.message; } })()}</p>
                                {notification.link && (
                                    <div className="flex items-center gap-1 text-xs text-blue-600">
                                        <Eye className="h-3 w-3" />
                                        View details
                                    </div>
                                )}
                            </div>
                        </DropdownMenuItem>
                    ))
                )}
                <DropdownMenuSeparator />
                <div className="p-2">
                    <Link
                        href="/notifications"
                        className="flex items-center justify-center text-sm font-medium text-blue-600 hover:text-blue-700 py-2"
                        onClick={() => setOpen(false)}
                    >
                        View All
                    </Link>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
