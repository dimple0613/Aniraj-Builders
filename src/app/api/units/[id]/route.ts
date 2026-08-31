import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';
import { createNotification } from '@/lib/notification-service';
import { logUpdateActivity, logDeleteActivity } from '@/lib/activityLogger';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;
        const companyId = (session?.user as any)?.company_id;

        if (!hasPermission(role, 'UNIT', 'READ')) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { id } = await context.params;
        const where: any = { id };

        const unit = await prisma.unit.findFirst({
            where,
            select: {
                id: true,
                unit_name: true,
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
                        vardhiEstimationItems: true,
                    },
                },
            },
        });

        if (!unit) {
            return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
        }

        return NextResponse.json(unit);
    } catch (error) {
        console.error('Error fetching unit:', error);
        return NextResponse.json(
            { error: 'Failed to fetch unit' },
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

        if (!hasPermission(role, 'UNIT', 'UPDATE')) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { id } = await context.params;
        const body = await request.json();
        const { unit_name } = body;

        if (!unit_name || !unit_name.toString().trim()) {
            return NextResponse.json(
                { error: 'Unit name is required' },
                { status: 400 }
            );
        }

        const trimmedName = unit_name.toString().trim();

        const existingUnit = await prisma.unit.findFirst({
            where: { id },
        });

        if (!existingUnit) {
            return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
        }

        const duplicateUnit = await prisma.unit.findFirst({
            where: {
                unit_name: {
                    equals: trimmedName,
                    mode: 'insensitive',
                },
                id: { not: id },
            },
        });

        if (duplicateUnit) {
            return NextResponse.json(
                { error: 'Unit with this name already exists for this company' },
                { status: 409 }
            );
        }

        const unit = await prisma.unit.update({
            where: { id: id },
            data: {
                unit_name: trimmedName,
            },
            select: {
                id: true,
                unit_name: true,
                company_id: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        await createNotification({
            action: 'Updated',
            entity: 'Unit',
            entityId: unit.id,
            entityName: unit.unit_name,
            userId: (session?.user as any)?.id,
            link: `/maintenance-sor`,
        });
        await logUpdateActivity({
            companyId: unit.company_id,
            userId: (session?.user as any)?.id,
            entityType: 'unit',
            entityId: unit.id,
            entityName: unit.unit_name,
            oldValues: { unit_name: existingUnit.unit_name },
            newValues: { unit_name: trimmedName },
        });

        return NextResponse.json(unit);
    } catch (error) {
        console.error('Error updating unit:', error);
        return NextResponse.json(
            { error: 'Failed to update unit' },
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

        if (!hasPermission(role, 'UNIT', 'DELETE')) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const existingUnit = await prisma.unit.findFirst({
            where: { id },
            include: {
                _count: {
                    select: {
                        itemManagements: true,
                        vardhiEstimationItems: true,
                    },
                },
            },
        });

        if (!existingUnit) {
            return NextResponse.json({ error: 'Unit not found' }, { status: 404 });
        }

        // Check if any CapitalSOR records reference this unit by name
        const capitalSORUsingUnit = await prisma.capitalSOR.findFirst({
            where: { uom: existingUnit.unit_name }
        });

        if (existingUnit._count.itemManagements > 0 || existingUnit._count.vardhiEstimationItems > 0 || capitalSORUsingUnit) {
            return NextResponse.json(
                { error: 'This record cannot be deleted because it is currently in use.' },
                { status: 400 }
            );
        }

        await prisma.unit.delete({
            where: { id: id },
        });

        await createNotification({
            action: 'Deleted',
            entity: 'Unit',
            entityId: id,
            entityName: existingUnit.unit_name,
            userId: (session?.user as any)?.id,
            link: `/maintenance-sor`,
        });
        await logDeleteActivity({
            companyId: existingUnit.company_id,
            userId: (session?.user as any)?.id,
            entityType: 'unit',
            entityId: id,
            entityName: existingUnit.unit_name,
        });

        return NextResponse.json({ message: 'Unit deleted successfully' });
    } catch (error) {
        console.error('Error deleting unit:', error);
        return NextResponse.json(
            { error: 'Failed to delete unit' },
            { status: 500 }
        );
    }
}
