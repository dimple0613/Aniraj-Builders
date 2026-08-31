'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCheck, Bell, ExternalLink, Eye } from 'lucide-react';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import { toast } from 'sonner';
import { Column, DataTable, DataTableFilter } from '@/components/common';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog';

interface NotificationUser {
    id: string;
    name: string;
    email: string | null;
    role: string;
}

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
    user: NotificationUser | null;
}

function extractUserName(message: string): string {
    try {
        const parsed = JSON.parse(message);
        if (parsed.text) message = parsed.text;
    } catch {}
    const patterns = [' created ', ' updated ', ' deleted '];
    for (const p of patterns) {
        const idx = message.toLowerCase().indexOf(p);
        if (idx !== -1) return message.substring(0, idx);
    }
    const wasPatterns = [' was created', ' was updated', ' was deleted'];
    for (const p of wasPatterns) {
        const idx = message.toLowerCase().indexOf(p);
        if (idx !== -1) return message.substring(0, idx);
    }
    return message;
}

export default function NotificationsPage() {
    const { data: session } = useSession();
    const router = useRouter();
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);
    const [total, setTotal] = useState(0);
    const [unreadCount, setUnreadCount] = useState(0);
    const [limit, setLimit] = useState(10);
    const [filterUser, setFilterUser] = useState<string[]>([]);
    const [filterModule, setFilterModule] = useState<string[]>([]);
    const [filterAction, setFilterAction] = useState<string[]>([]);
    const [filterOptions, setFilterOptions] = useState<{ users: NotificationUser[]; modules: string[]; actions: string[] }>({ users: [], modules: [], actions: [] });

    const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

    const isSuperAdmin = (session?.user as any)?.role === 'SuperAdmin';

    const notificationsWithRowNumbers = useMemo(() => {
        return notifications
            .filter(n => n.user?.role !== 'SuperAdmin')
            .map((notification, index) => ({
                ...notification,
                rowNumber: ((page - 1) * limit) + index + 1,
            }));
    }, [notifications, page, limit]);

    const fetchNotifications = useCallback(async (
        currentPage: number,
        currentLimit: number,
        userFilter = filterUser,
        moduleFilter = filterModule,
        actionFilter = filterAction
    ) => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: String(currentPage),
                limit: String(currentLimit),
            });
            if (userFilter.length > 0) params.append('user_id', userFilter.join(','));
            if (moduleFilter.length > 0) params.append('entity', moduleFilter.join(','));
            if (actionFilter.length > 0) params.append('action', actionFilter.join(','));
            const response = await axios.get(`/api/notifications?${params.toString()}`);
            if (response.data.success) {
                setNotifications(response.data.data || []);
                setTotalPages(response.data.pagination?.pages || 0);
                setTotal(response.data.pagination?.total || 0);
                setUnreadCount(response.data.unreadCount || 0);
            }
        } catch (error: any) {
            if (error.response?.status === 403) {
                toast.error('You do not have permission to view notifications');
                router.push('/dashboard');
            } else {
                toast.error('Failed to load notifications');
            }
        } finally {
            setLoading(false);
        }
    }, [router, filterUser, filterModule, filterAction]);

    useEffect(() => {
        if (!isSuperAdmin) return;
        fetchNotifications(page, limit);
    }, [page, limit, isSuperAdmin, fetchNotifications, filterUser, filterModule, filterAction]);

    useEffect(() => {
        if (!isSuperAdmin) return;
        const fetchFilters = async () => {
            try {
                const res = await axios.get('/api/notifications/filters');
                if (res.data.success) {
                    setFilterOptions(res.data.data);
                }
            } catch {
                // Silently ignore - filters will just be empty
            }
        };
        fetchFilters();
    }, [isSuperAdmin]);

    const handleMarkAsRead = async (ids: string[]) => {
        try {
            await axios.put('/api/notifications', { ids });
            setNotifications(prev =>
                prev.map(n => ids.includes(n.id) ? { ...n, isRead: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - ids.length));
            toast.success(`Marked ${ids.length} notification(s) as read`);
        } catch (error) {
            toast.error('Failed to mark as read');
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

    const handleViewDetails = (notification: Notification) => {
        if (!notification.isRead) {
            handleMarkAsRead([notification.id]);
        }
        if (notification.link) {
            router.push(notification.link);
        }
    };

    const formatDateTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        });
    };

    const userOptions = useMemo(() => {
        return filterOptions.users.map((u) => ({ label: u.name, value: u.id }));
    }, [filterOptions.users]);

    const moduleOptions = useMemo(() => {
        return filterOptions.modules.map((e) => ({ label: e, value: e }));
    }, [filterOptions.modules]);

    const actionOptions = useMemo(() => {
        return filterOptions.actions.map((a) => ({ label: a, value: a }));
    }, [filterOptions.actions]);

    const columns = useMemo<Column<Notification & { rowNumber: number }>[]>(() => {
        return [
            {
                header: 'No.',
                accessorKey: 'rowNumber',
                cell: (item) => (
                    <span className="font-medium text-muted-foreground">
                        {item.rowNumber}
                    </span>
                ),
            },
            {
                header: 'User',
                cell: (item) => {
                    const userName = item.user?.name || extractUserName(item.message);
                    return item.user ? (
                        <div>
                            <p className="font-medium text-sm">{item.user.name}</p>
                            <p className="text-xs text-muted-foreground">
                                {item.user.role} / {item.user.email || 'No email'}
                            </p>
                        </div>
                    ) : (
                        <div>
                            <p className="font-medium text-sm">{userName}</p>
                            <p className="text-xs text-muted-foreground">User deleted</p>
                        </div>
                    );
                },
            },
            {
                header: 'Module',
                accessorKey: 'entity',
                cell: (item) => (
                    <Badge variant="outline" className="font-normal">
                        {item.entity}
                    </Badge>
                ),
            },
            {
                header: 'Action',
                accessorKey: 'action',
                cell: (item) => {
                    const isZoneOfficer = item.user?.role === 'Zone';
                    return (
                        <div className="flex items-center gap-2">
                            {(() => {
                                switch (item.action) {
                                    case 'Created':
                                        return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Created</Badge>;
                                    case 'Updated':
                                        return <Badge variant="default" className="bg-blue-600 hover:bg-blue-700">Updated</Badge>;
                                    case 'Deleted':
                                        return <Badge variant="destructive">Deleted</Badge>;
                                    default:
                                        return <Badge variant="secondary">{item.action}</Badge>;
                                }
                            })()}
                            {isZoneOfficer && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setSelectedNotification(item)}
                                    title="View Change Details"
                                >
                                    <Eye className="h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    );
                },
            },
            {
                header: 'What Changes Made',
                accessorKey: 'message',
                cell: (item) => {
                    let displayMessage = item.message;
                    try {
                        const parsed = JSON.parse(item.message);
                        if (parsed.text) displayMessage = parsed.text;
                    } catch {}
                    return (
                        <p className="text-sm truncate max-w-[250px]" title={displayMessage}>
                            {displayMessage}
                        </p>
                    );
                },
            },
            {
                header: 'Date',
                accessorKey: 'createdAt',
                cell: (item) => (
                    <span className="text-xs text-muted-foreground">
                        {formatDateTime(item.createdAt)}
                    </span>
                ),
            },
            {
                header: 'View Details',
                accessorKey: 'link',
                cell: (item) => (
                    item.link ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2"
                            onClick={() => handleViewDetails(item)}
                        >
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />
                            View
                        </Button>
                    ) : null
                ),
            },
        ];
    }, [page, limit, formatDateTime, handleViewDetails]);

    if (!isSuperAdmin) {
        return (
            <div className="flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
                <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-xl md:text-2xl font-semibold tracking-tight flex items-center gap-2">
                            <Bell className="h-6 w-6" />
                            Notifications
                        </h2>
                    </div>
                </div>
                <div className="border rounded-lg p-6 text-center text-muted-foreground">
                    You do not have permission to view notifications.
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight flex items-center gap-2">
                        <Bell className="h-6 w-6" />
                        Notifications
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {total} total &middot; {unreadCount} unread
                    </p>
                </div>
                {unreadCount > 0 && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleMarkAllAsRead}
                    >
                        <CheckCheck className="mr-2 h-4 w-4" />
                        Mark all as read
                    </Button>
                )}
            </div>

            <DataTable
                data={notificationsWithRowNumbers}
                columns={columns}
                loading={loading}
                pagination={{
                    page: page,
                    totalPages: totalPages,
                    total: total,
                    limit: limit,
                }}
                onPageChange={(newPage) => setPage(newPage)}
                onLimitChange={(newLimit) => {
                    setLimit(newLimit);
                    setPage(1);
                }}
                emptyMessage="No notifications yet. When you receive notifications, they will appear here."
                getRowClassName={(item: Notification & { rowNumber: number }) => 
                    !item.isRead ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''
                }
                filters={(
                    <div className="flex flex-wrap items-center gap-2 order-[3] w-full sm:w-auto">
                        <DataTableFilter
                            title="User"
                            options={userOptions}
                            selectedValues={filterUser}
                            onChange={(values: any) => {
                                setFilterUser(values);
                                setPage(1);
                            }}
                        />
                        <DataTableFilter
                            title="Module"
                            options={moduleOptions}
                            selectedValues={filterModule}
                            onChange={(values: any) => {
                                setFilterModule(values);
                                setPage(1);
                            }}
                        />
                        <DataTableFilter
                            title="Action"
                            options={actionOptions}
                            selectedValues={filterAction}
                            onChange={(values: any) => {
                                setFilterAction(values);
                                setPage(1);
                            }}
                        />
                        {(filterUser.length > 0 || filterModule.length > 0 || filterAction.length > 0) && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setFilterUser([]);
                                    setFilterModule([]);
                                    setFilterAction([]);
                                }}
                                className='inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border gap-1.5'
                            >
                                Clear All
                            </Button>
                        )}
                    </div>
                )}
            />

            <Dialog open={!!selectedNotification} onOpenChange={(open) => { if (!open) setSelectedNotification(null); }}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-lg">
                            <Eye className="h-5 w-5" />
                            Change Log Details
                        </DialogTitle>
                        <DialogDescription>
                            Detailed change tracking information for this update
                        </DialogDescription>
                    </DialogHeader>

                    {selectedNotification && (() => {
                        let parsedMessage: any = null;
                        try {
                            const parsed = JSON.parse(selectedNotification.message);
                            if (parsed.changes && Array.isArray(parsed.changes)) {
                                parsedMessage = parsed;
                            }
                        } catch {}
                        const changes = parsedMessage?.changes || [];
                        const vardhiNumber = parsedMessage?.text ? parsedMessage.text.split('Vardhi ').pop() || '' : '';

                        return (
                            <div className="space-y-4">
                                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Overview</h4>
                                        {vardhiNumber && (
                                            <span className="inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold bg-blue-50 text-blue-700 border-blue-200">
                                                {vardhiNumber}
                                            </span>
                                        )}
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div>
                                            <span className="text-muted-foreground">Changed By:</span>
                                            <p className="font-medium">{selectedNotification.user?.name || 'Zone Officer'}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Role:</span>
                                            <p className="font-medium">{selectedNotification.user?.role || 'Zone Officer'}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Section / Page:</span>
                                            <p className="font-medium">{selectedNotification.entity} &rarr; Edit {selectedNotification.entity}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Module:</span>
                                            <p className="font-medium">{selectedNotification.entity}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Date & Time:</span>
                                            <p className="font-medium">{formatDateTime(selectedNotification.createdAt)}</p>
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground">Action:</span>
                                            <p className="font-medium">{selectedNotification.action}</p>
                                        </div>
                                    </div>
                                </div>

                                {changes.length > 0 ? (
                                    <>
                                        <div className="rounded-lg border">
                                            <div className="bg-muted/50 px-4 py-2 border-b">
                                                <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Field Changes</h4>
                                            </div>
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                        <tr className="border-b bg-muted/30">
                                                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">#</th>
                                                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Field Name</th>
                                                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Previous Value</th>
                                                            <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Updated Value</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {changes.map((row: any, idx: number) => (
                                                            <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                                                                <td className="px-4 py-2.5 text-muted-foreground">{idx + 1}</td>
                                                                <td className="px-4 py-2.5 font-medium">{row.field}</td>
                                                                <td className="px-4 py-2.5">
                                                                    <span className="inline-block bg-red-50 text-red-700 rounded px-2 py-0.5 text-xs font-medium">{row.oldValue || '(empty)'}</span>
                                                                </td>
                                                                <td className="px-4 py-2.5">
                                                                    <span className="inline-block bg-green-50 text-green-700 rounded px-2 py-0.5 text-xs font-medium">{row.newValue || '(empty)'}</span>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                                            <p className="font-medium">Total {changes.length} field(s) were modified in this update.</p>
                                            <p className="text-xs mt-1">Changes were made from the {selectedNotification.entity} &rarr; Edit {selectedNotification.entity} section by {selectedNotification.user?.role === 'Zone' ? 'Zone Officer' : selectedNotification.user?.role || 'Zone Officer'}.</p>
                                        </div>
                                    </>
                                ) : (
                                    <div className="rounded-lg border p-6 text-center text-muted-foreground text-sm">
                                        {parsedMessage?.text || selectedNotification.message}
                                    </div>
                                )}
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </div>
    );
}
