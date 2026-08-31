import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';
import { createNotification } from '@/lib/notification-service';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;
        const companyId = (session?.user as any)?.company_id;

        if (!hasPermission(role, 'AY_MASTER', 'READ')) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { id } = await context.params;
        const where: any = { id };

        if (role !== 'SuperAdmin' && companyId) {
            where.company_id = companyId;
        }

        const ayMaster = await prisma.aYMaster.findFirst({
            where,
            select: {
                id: true,
                ay_no: true,
                company_id: true,
                createdAt: true,
                updatedAt: true,
                company: {
                    select: {
                        company_name: true,
                    },
                },
                _count: {
                    select: {
                        itemManagements: true,
                    },
                },
            },
        });

        if (!ayMaster) {
            return NextResponse.json(
                { error: 'AY master not found' },
                { status: 404 }
            );
        }

        return NextResponse.json(ayMaster);
    } catch (error) {
        console.error('Error fetching AY master:', error);
        return NextResponse.json(
            { error: 'Failed to fetch AY master' },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;
        const companyId = (session?.user as any)?.company_id;

        if (!hasPermission(role, 'AY_MASTER', 'UPDATE')) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { id } = await context.params;

        if (!id) {
            return NextResponse.json(
                { error: 'ID is missing' },
                { status: 400 }
            );
        }

        const body = await request.json();
        const { ay_no } = body;

        if (!ay_no || !ay_no.toString().trim()) {
            return NextResponse.json(
                { error: 'AY number is required' },
                { status: 400 }
            );
        }

        const trimmedAyNo = ay_no.toString().trim();

        const existingAY = await prisma.aYMaster.findFirst({
            where: {
                id,
                ...(role !== 'SuperAdmin' && companyId ? { company_id: companyId } : {}),
            },
        });

        if (!existingAY) {
            return NextResponse.json(
                { error: 'AY master not found' },
                { status: 404 }
            );
        }

        const duplicateAY = await prisma.aYMaster.findFirst({
            where: {
                company_id: existingAY.company_id,
                ay_no: {
                    equals: trimmedAyNo,
                    mode: 'insensitive',
                },
                id: { not: id },
            },
        });

        if (duplicateAY) {
            return NextResponse.json(
                { error: 'AY number already exists for this company' },
                { status: 409 }
            );
        }

        const ayMaster = await prisma.aYMaster.update({
            where: { id },
            data: {
                ay_no: trimmedAyNo,
            },
            select: {
                id: true,
                ay_no: true,
                company_id: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        await createNotification({
            action: 'Updated',
            entity: 'Item Number',
            entityId: ayMaster.id,
            entityName: ayMaster.ay_no,
            userId: (session?.user as any)?.id,
            link: `/maintenance-sor`,
        });

        return NextResponse.json(ayMaster);

    } catch (error) {
        console.error('Error updating AY master:', error);
        return NextResponse.json(
            { error: 'Failed to update AY master' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;
        const companyId = (session?.user as any)?.company_id;

        if (!hasPermission(role, 'AY_MASTER', 'DELETE')) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { id } = await context.params;

        if (!id) {
            return NextResponse.json(
                { error: 'ID is required' },
                { status: 400 }
            );
        }

        const existingAY = await prisma.aYMaster.findFirst({
            where: {
                id,
                ...(role !== 'SuperAdmin' && companyId ? { company_id: companyId } : {}),
            },
            include: {
                _count: {
                    select: {
                        itemManagements: true,
                    },
                },
            },
        });

        if (!existingAY) {
            return NextResponse.json(
                { error: 'AY master not found' },
                { status: 404 }
            );
        }

        if (existingAY._count.itemManagements > 0) {
            return NextResponse.json(
                { error: 'Cannot delete AY that is referenced by items' },
                { status: 400 }
            );
        }

        await prisma.aYMaster.delete({
            where: { id },
        });

        await createNotification({
            action: 'Deleted',
            entity: 'Item Number',
            entityId: id,
            entityName: existingAY.ay_no,
            userId: (session?.user as any)?.id,
            link: `/maintenance-sor`,
        });

        return NextResponse.json({
            message: 'AY master deleted successfully',
        });

    } catch (error) {
        console.error('Error deleting AY master:', error);
        return NextResponse.json(
            { error: 'Failed to delete AY master' },
            { status: 500 }
        );
    }
}
