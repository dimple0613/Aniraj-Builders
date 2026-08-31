import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

/**
 * GET /api/notifications/filters
 * Returns all unique filter values (users, modules, actions) across ALL notifications.
 * Used to populate filter dropdowns independent of pagination.
 */
export async function GET() {
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
                { success: false, message: 'Forbidden' },
                { status: 403 }
            );
        }

        // Fetch all notifications (targeting SuperAdmin), excluding SuperAdmin authors
        // Only select the fields needed for filters to keep the query light
        const notifications = await prisma.notification.findMany({
            where: { targetRole: 'SuperAdmin' },
            select: {
                userId: true,
                entity: true,
                action: true,
                user: {
                    select: { id: true, name: true, email: true, role: true },
                },
            },
        });

        // Exclude notifications created by SuperAdmin users
        const filtered = notifications.filter((n) => n.user?.role !== 'SuperAdmin');

        // Deduplicate users
        const userMap = new Map<string, { id: string; name: string; email: string | null; role: string }>();
        for (const n of filtered) {
            if (n.user && !userMap.has(n.user.id)) {
                userMap.set(n.user.id, n.user);
            }
        }

        // Deduplicate modules and actions
        const modules = Array.from(new Set(filtered.map((n) => n.entity))).sort();
        const actions = Array.from(new Set(filtered.map((n) => n.action))).sort();

        return NextResponse.json({
            success: true,
            data: {
                users: Array.from(userMap.values()),
                modules,
                actions,
            },
        });
    } catch (error) {
        console.error('Error fetching notification filters:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to fetch filter options' },
            { status: 500 }
        );
    }
}
