import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';
import { createNotification } from '@/lib/notification-service';
import { logUpdateActivity, logDeleteActivity } from '@/lib/activityLogger';

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;
        const companyId = (session?.user as any)?.company_id;

        if (!hasPermission(role, 'ITEMS', 'UPDATE')) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { id } = await context.params;
        const body = await request.json();
        const { name } = body;

        if (!name || !name.toString().trim()) {
            return NextResponse.json(
                { error: 'Name is required' },
                { status: 400 }
            );
        }

        const trimmedName = name.toString().trim();

        const existingGroup = await prisma.sORGroup.findFirst({
            where: {
                id: id,
            },
        });

        if (!existingGroup) {
            return NextResponse.json({ error: 'Group not found' }, { status: 404 });
        }

        const duplicateGroup = await prisma.sORGroup.findFirst({
            where: {
                company_id: existingGroup.company_id,
                name: {
                    equals: trimmedName,
                    mode: 'insensitive',
                },
                id: { not: id },
            },
        });

        if (duplicateGroup) {
            return NextResponse.json(
                { error: 'Group with this name already exists for this company' },
                { status: 409 }
            );
        }

        const group = await prisma.sORGroup.update({
            where: { id: id },
            data: {
                name: trimmedName,
            },
        });

        await createNotification({
            action: 'Updated',
            entity: 'Group',
            entityId: group.id,
            entityName: group.name,
            userId: (session?.user as any)?.id,
            link: `/maintenance-sor`,
        });
        await logUpdateActivity({
            companyId: group.company_id,
            userId: (session?.user as any)?.id,
            entityType: 'sor_group',
            entityId: group.id,
            entityName: group.name,
            oldValues: { name: existingGroup.name },
            newValues: { name: trimmedName },
        });

        return NextResponse.json(group);
    } catch (error) {
        console.error('Error updating group:', error);
        return NextResponse.json(
            { error: 'Failed to update group' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;
        const companyId = (session?.user as any)?.company_id;

        if (!hasPermission(role, 'ITEMS', 'DELETE')) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const existingGroup = await prisma.sORGroup.findFirst({
            where: {
                id: id,
            },
        });

        if (!existingGroup) {
            return NextResponse.json({ error: 'Group not found' }, { status: 404 });
        }

        await prisma.sORGroup.delete({
            where: { id: id },
        });

        await createNotification({
            action: 'Deleted',
            entity: 'Group',
            entityId: id,
            entityName: existingGroup.name,
            userId: (session?.user as any)?.id,
            link: `/maintenance-sor`,
        });
        await logDeleteActivity({
            companyId: existingGroup.company_id,
            userId: (session?.user as any)?.id,
            entityType: 'sor_group',
            entityId: id,
            entityName: existingGroup.name,
        });

        return NextResponse.json({ message: 'Group deleted successfully' });
    } catch (error) {
        console.error('Error deleting group:', error);
        return NextResponse.json(
            { error: 'Failed to delete group' },
            { status: 500 }
        );
    }
}
