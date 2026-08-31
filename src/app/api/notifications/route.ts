import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';

/**
 * GET /api/notifications
 * Fetch notifications for SuperAdmin users
 * Supports pagination and unread filter
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        
        if (!session?.user) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized' },
                { status: 401 }
            );
        }

        const userRole = (session.user as any)?.role;
        
        // Only SuperAdmin can access notifications
        if (userRole !== 'SuperAdmin') {
            return NextResponse.json(
                unauthorizedResponse(),
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const unreadOnly = searchParams.get('unread_only') === 'true';
        const userIds = searchParams.get('user_id')?.split(',').filter(Boolean) || [];
        const entities = searchParams.get('entity')?.split(',').filter(Boolean) || [];
        const actions = searchParams.get('action')?.split(',').filter(Boolean) || [];

        const where: any = {
            targetRole: 'SuperAdmin',
            ...(unreadOnly ? { isRead: false } : {}),
            ...(userIds.length > 0 ? { userId: { in: userIds } } : {}),
            ...(entities.length > 0 ? { entity: { in: entities } } : {}),
            ...(actions.length > 0 ? { action: { in: actions } } : {}),
        };

        // Get all notifications first, then filter out SuperAdmin actions
        const notifications = await prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                user: true,
            },
        });

        // Filter out notifications created by SuperAdmin users
        const filteredNotifications = notifications.filter(
            (n: any) => n.user?.role !== 'SuperAdmin'
        );

        // Apply pagination manually after filtering
        const total = filteredNotifications.length;
        const paginatedNotifications = filteredNotifications.slice(
            (page - 1) * limit,
            (page - 1) * limit + limit
        );

        // Get unread count (only for non-SuperAdmin)
        const unreadCount = await prisma.notification.count({
            where: {
                targetRole: 'SuperAdmin',
                isRead: false,
                user: {
                    NOT: {
                        role: 'SuperAdmin'
                    }
                }
            },
        });

        return NextResponse.json({
            success: true,
            message: 'Notifications fetched successfully',
            data: paginatedNotifications,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
            unreadCount,
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        return NextResponse.json(
            errorResponse('Failed to fetch notifications'),
            { status: 500 }
        );
    }
}

/**
 * PUT /api/notifications
 * Mark notifications as read
 * Body: { ids: string[] } or { markAll: true }
 */
export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        
        if (!session?.user) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized' },
                { status: 401 }
            );
        }

        const userRole = (session.user as any)?.role;
        
        // Only SuperAdmin can modify notifications
        if (userRole !== 'SuperAdmin') {
            return NextResponse.json(
                unauthorizedResponse(),
                { status: 403 }
            );
        }

        const body = await request.json();
        const { ids, markAll } = body;

        if (markAll) {
            // Mark all as read
            const result = await prisma.notification.updateMany({
                where: {
                    targetRole: 'SuperAdmin',
                    isRead: false,
                },
                data: {
                    isRead: true,
                },
            });

            return NextResponse.json(
                successResponse(`Marked ${result.count} notifications as read`)
            );
        }

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json(
                errorResponse('Notification IDs are required'),
                { status: 400 }
            );
        }

        // Mark specific notifications as read
        const result = await prisma.notification.updateMany({
            where: {
                id: { in: ids },
                targetRole: 'SuperAdmin',
            },
            data: {
                isRead: true,
            },
        });

        return NextResponse.json(
            successResponse(`Marked ${result.count} notifications as read`)
        );
    } catch (error) {
        console.error('Error updating notifications:', error);
        return NextResponse.json(
            errorResponse('Failed to update notifications'),
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/notifications
 * Delete notifications (optional - for cleanup)
 */
export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        
        if (!session?.user) {
            return NextResponse.json(
                { success: false, message: 'Unauthorized' },
                { status: 401 }
            );
        }

        const userRole = (session.user as any)?.role;
        
        if (userRole !== 'SuperAdmin') {
            return NextResponse.json(
                unauthorizedResponse(),
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const ids = searchParams.get('ids')?.split(',') || [];

        if (ids.length === 0) {
            return NextResponse.json(
                errorResponse('Notification IDs are required'),
                { status: 400 }
            );
        }

        await prisma.notification.deleteMany({
            where: {
                id: { in: ids },
                targetRole: 'SuperAdmin',
            },
        });

        return NextResponse.json(
            successResponse('Notifications deleted successfully')
        );
    } catch (error) {
        console.error('Error deleting notifications:', error);
        return NextResponse.json(
            errorResponse('Failed to delete notifications'),
            { status: 500 }
        );
    }
}
