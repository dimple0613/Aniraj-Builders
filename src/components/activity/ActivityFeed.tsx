/**
 * Activity Feed Component
 * Displays a timeline of user activities with filtering
 */

'use client';

import { useState, useEffect } from 'react';
import { format } from 'date-fns';

interface Activity {
    id: string;
    companyId: string;
    userId: string;
    entityType: string;
    entityId: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE';
    title: string;
    message: string;
    metadata: any;
    isRead: boolean;
    createdAt: string;
    user?: {
        id: string;
        name: string;
        email: string;
    };
    company?: {
        id: string;
        company_name: string;
    };
}

interface ActivityFeedProps {
    activities?: Activity[];
    showFilters?: boolean;
    showCompanyFilter?: boolean;
    companyId?: string;
    title?: string;
}

export function ActivityFeed({
    activities: initialActivities,
    showFilters = true,
    showCompanyFilter = false,
    companyId,
    title = 'Activity Feed',
}: ActivityFeedProps) {
    const [activities, setActivities] = useState<Activity[]>(initialActivities || []);
    const [loading, setLoading] = useState(!initialActivities);
    const [entityTypeFilter, setEntityTypeFilter] = useState('');
    const [actionFilter, setActionFilter] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchActivities = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (companyId) params.set('companyId', companyId);
            if (entityTypeFilter) params.set('entityType', entityTypeFilter);
            if (actionFilter) params.set('action', actionFilter);
            params.set('page', page.toString());
            params.set('limit', '20');

            const res = await fetch(`/api/activity?${params.toString()}`);
            const data = await res.json();

            if (data.activities) {
                setActivities(data.activities);
                setTotalPages(data.pagination?.totalPages || 1);
            }
        } catch (error) {
            console.error('Error fetching activities:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!initialActivities) {
            fetchActivities();
        }
    }, [entityTypeFilter, actionFilter, page]);

    const handleMarkAsRead = async (id: string) => {
        try {
            await fetch('/api/activity', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id }),
            });
            setActivities(prev =>
                prev.map(a => (a.id === id ? { ...a, isRead: true } : a))
            );
        } catch (error) {
            console.error('Error marking as read:', error);
        }
    };

    const getActionColor = (action: string) => {
        switch (action) {
            case 'CREATE':
                return 'bg-green-500';
            case 'UPDATE':
                return 'bg-blue-500';
            case 'DELETE':
                return 'bg-red-500';
            default:
                return 'bg-gray-500';
        }
    };

    const getActionIcon = (action: string) => {
        switch (action) {
            case 'CREATE':
                return '+';
            case 'UPDATE':
                return '✎';
            case 'DELETE':
                return '×';
            default:
                return '•';
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{title}</h3>
                {showFilters && (
                    <button
                        onClick={() => fetchActivities()}
                        className="text-sm text-blue-600 hover:text-blue-800"
                    >
                        Refresh
                    </button>
                )}
            </div>

            {showFilters && (
                <div className="flex gap-4 mb-4">
                    <select
                        value={entityTypeFilter}
                        onChange={e => setEntityTypeFilter(e.target.value)}
                        className="px-3 py-1 border rounded"
                    >
                        <option value="">All Entities</option>
                        <option value="project">Project</option>
                        <option value="vardhi">Vardhi</option>
                        <option value="invoice">Invoice</option>
                        <option value="user">User</option>
                        <option value="purchase">Purchase</option>
                    </select>

                    <select
                        value={actionFilter}
                        onChange={e => setActionFilter(e.target.value)}
                        className="px-3 py-1 border rounded"
                    >
                        <option value="">All Actions</option>
                        <option value="CREATE">Create</option>
                        <option value="UPDATE">Update</option>
                        <option value="DELETE">Delete</option>
                    </select>
                </div>
            )}

            {loading ? (
                <div className="text-center py-8 text-gray-500">Loading activities...</div>
            ) : activities.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No activities found</div>
            ) : (
                <div className="space-y-4">
                    {activities.map(activity => (
                        <div
                            key={activity.id}
                            className={`border-l-2 pl-4 relative ${activity.isRead ? 'opacity-60' : ''}`}
                        >
                            <div
                                className={`absolute -left-2 top-2 w-4 h-4 rounded-full ${getActionColor(activity.action)} flex items-center justify-center text-white text-xs`}
                            >
                                {getActionIcon(activity.action)}
                            </div>

                            <div className="flex items-start justify-between">
                                <div className="flex-1">
                                    <p className="text-sm font-medium">{activity.title}</p>
                                    <p className="text-xs text-gray-600">{activity.message}</p>

                                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                                        <span>{format(new Date(activity.createdAt), 'PPp')}</span>
                                        {activity.user && (
                                            <span>• {activity.user.name}</span>
                                        )}
                                        {showCompanyFilter && activity.company && (
                                            <span>• {activity.company.company_name}</span>
                                        )}
                                    </div>

                                    {activity.action === 'DELETE' && (
                                        <span className="inline-block mt-1 text-xs text-red-500 font-medium">
                                            This item was deleted
                                        </span>
                                    )}

                                    {activity.metadata && activity.action === 'UPDATE' && (
                                        <details className="mt-2 text-xs">
                                            <summary className="cursor-pointer text-blue-600">
                                                View changes
                                            </summary>
                                            <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-auto">
                                                {JSON.stringify(activity.metadata, null, 2)}
                                            </pre>
                                        </details>
                                    )}
                                </div>

                                {!activity.isRead && (
                                    <button
                                        onClick={() => handleMarkAsRead(activity.id)}
                                        className="text-xs text-blue-600 hover:text-blue-800"
                                    >
                                        Mark as read
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                        Previous
                    </button>
                    <span className="px-3 py-1">
                        Page {page} of {totalPages}
                    </span>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1 border rounded disabled:opacity-50"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
