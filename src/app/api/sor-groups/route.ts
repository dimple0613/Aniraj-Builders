import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';
import { createNotification } from '@/lib/notification-service';
import { logCreateActivity } from '@/lib/activityLogger';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;
        const companyId = (session?.user as any)?.company_id;

        if (!hasPermission(role, 'ITEMS', 'READ')) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search') || '';
        const sortField = searchParams.get('sortField') || 'name';
        const sortOrder = searchParams.get('sortOrder') || 'asc';

        const skip = (page - 1) * limit;

        const where: any = {};

        if (search) {
            where.name = { contains: search, mode: 'insensitive' as const };
        }

        const [groups, total] = await Promise.all([
            prisma.sORGroup.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [sortField]: sortOrder },
                select: {
                    id: true,
                    name: true,
                    company_id: true,
                    createdAt: true,
                    updatedAt: true,
                    company: {
                        select: {
                            company_name: true,
                        },
                    },
                },
            }),
            prisma.sORGroup.count({ where }),
        ]);

        return NextResponse.json({
            data: groups,
            pagination: {
                page,
                pages: Math.ceil(total / limit),
                total,
                limit,
            },
        });
    } catch (error) {
        console.error('Error fetching groups:', error);
        return NextResponse.json(
            { error: 'Failed to fetch groups' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;
        const companyId = (session?.user as any)?.company_id;

        if (!hasPermission(role, 'ITEMS', 'CREATE')) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const body = await request.json();
        const { name } = body;

        if (!name || !name.toString().trim()) {
            return NextResponse.json(
                { error: 'Name is required' },
                { status: 400 }
            );
        }

        const trimmedName = name.toString().trim();
        const finalCompanyId = role === 'SuperAdmin' ? body.company_id || companyId : companyId;

        if (!finalCompanyId) {
            return NextResponse.json(
                { error: 'Company ID is required' },
                { status: 400 }
            );
        }

        const existingGroup = await prisma.sORGroup.findFirst({
            where: {
                company_id: finalCompanyId,
                name: {
                    equals: trimmedName,
                    mode: 'insensitive',
                },
            },
        });

        if (existingGroup) {
            return NextResponse.json(
                { error: 'Group with this name already exists for this company' },
                { status: 409 }
            );
        }

        const group = await prisma.sORGroup.create({
            data: {
                name: trimmedName,
                company_id: finalCompanyId,
            },
        });

        await createNotification({
            action: 'Created',
            entity: 'Group',
            entityId: group.id,
            entityName: group.name,
            userId: (session?.user as any)?.id,
            link: `/maintenance-sor`,
        });
        await logCreateActivity({
            companyId: finalCompanyId,
            userId: (session?.user as any)?.id,
            entityType: 'sor_group',
            entityId: group.id,
            entityName: group.name,
        });

        return NextResponse.json(group, { status: 201 });
    } catch (error) {
        console.error('Error creating group:', error);
        return NextResponse.json(
            { error: 'Failed to create group' },
            { status: 500 }
        );
    }
}
