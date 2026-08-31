/**
 * Activity API Routes
 * GET /api/activity - Fetch activities with filtering
 * PATCH /api/activity - Mark activity as read
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/activity
 * Fetch activities with filtering
 * Query params:
 * - companyId: Filter by company (optional, defaults to user's company)
 * - entityType: Filter by entity type (project, invoice, etc.)
 * - entityId: Filter by entity ID
 * - action: Filter by action (CREATE, UPDATE, DELETE)
 * - isRead: Filter by read status (true/false)
 * - page: Page number (default 1)
 * - limit: Items per page (default 50)
 */
export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const companyId = searchParams.get('companyId') || session.user.companyId;
        const entityType = searchParams.get('entityType');
        const entityId = searchParams.get('entityId');
        const action = searchParams.get('action') as any;
        const isRead = searchParams.get('isRead');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '50');

        // Build where clause
        const where: any = {};

        // SuperAdmin can see all companies' activities if companyId is not specified
        // Otherwise, filter by company
        if (session.user.role !== 'SuperAdmin' || companyId) {
            where.companyId = companyId;
        }

        if (entityType) where.entityType = entityType;
        if (entityId) where.entityId = entityId;
        if (action) where.action = action;
        if (isRead !== null) where.isRead = isRead === 'true';

        const [activities, total] = await Promise.all([
            prisma.activity.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip: (page - 1) * limit,
                take: limit,
                include: {
                    user: {
                        select: { id: true, name: true, email: true },
                    },
                    company: {
                        select: { id: true, company_name: true },
                    },
                },
            }),
            prisma.activity.count({ where }),
        ]);

        return NextResponse.json({
            activities,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Error fetching activities:', error);
        return NextResponse.json(
            { error: 'Failed to fetch activities' },
            { status: 500 }
        );
    }
}

/**
 * PATCH /api/activity
 * Mark activity as read
 * Body: { id: string } or { markAll: true, companyId: string }
 */
export async function PATCH(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const { id, markAll, companyId } = body;

        if (markAll && companyId) {
            // Only allow marking all for user's company or if SuperAdmin
            if (session.user.role !== 'SuperAdmin' && companyId !== session.user.companyId) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }

            await prisma.activity.updateMany({
                where: {
                    companyId,
                    isRead: false,
                },
                data: { isRead: true },
            });

            return NextResponse.json({ success: true, message: 'All activities marked as read' });
        }

        if (!id) {
            return NextResponse.json({ error: 'Activity ID required' }, { status: 400 });
        }

        // Check if user has access to this activity
        const activity = await prisma.activity.findUnique({
            where: { id },
            select: { companyId: true },
        });

        if (!activity) {
            return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
        }

        if (session.user.role !== 'SuperAdmin' && activity.companyId !== session.user.companyId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await prisma.activity.update({
            where: { id },
            data: { isRead: true },
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating activity:', error);
        return NextResponse.json(
            { error: 'Failed to update activity' },
            { status: 500 }
        );
    }
}
