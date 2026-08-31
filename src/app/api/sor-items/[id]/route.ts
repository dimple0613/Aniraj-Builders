import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getServerSession, authOptions } from '@/lib/auth';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { createNotification } from '@/lib/notification-service';

if (!prisma) {
    throw new Error('Prisma client not initialized');
}

async function getCompanyId(): Promise<string | null> {
    const session = await getServerSession(authOptions);
    const company_id = (session?.user as any)?.company_id;
    
    if (company_id) {
        return company_id;
    }
    
    const headerList = await headers();
    const headerCompanyId = headerList.get('x-company-id');
    if (headerCompanyId) {
        return headerCompanyId;
    }

    // SuperAdmin fallback: use the first active company
    if ((session?.user as any)?.role === 'SuperAdmin') {
        const firstCompany = await prisma.company.findFirst({
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'asc' },
        });
        return firstCompany?.id || null;
    }
    
    return null;
}

export async function PUT(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const company_id = await getCompanyId();

        if (!company_id) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }

        const body = await request.json();
        const { name } = body;

        if (!name || !name.toString().trim()) {
            return NextResponse.json(
                errorResponse('Name is required'),
                { status: 400 }
            );
        }

        const trimmedName = name.toString().trim();

        const existingSOR = await prisma.sORItem.findFirst({
            where: { id },
        });

        if (!existingSOR) {
            return NextResponse.json(
                errorResponse('SOR item not found'),
                { status: 404 }
            );
        }

        const duplicateSOR = await prisma.sORItem.findFirst({
            where: {
                name: { equals: trimmedName, mode: 'insensitive' },
                id: { not: id },
            },
        });

        if (duplicateSOR) {
            return NextResponse.json(
                errorResponse('SOR item with this name already exists'),
                { status: 409 }
            );
        }

        const sorItem = await prisma.sORItem.update({
            where: { id },
            data: { name: trimmedName },
        });

        // Create notification for SuperAdmin
        const session = await getServerSession(authOptions);
        await createNotification({
            action: 'Updated',
            entity: 'Maintenance SOR',
            entityId: id,
            entityName: sorItem.name,
            userId: (session?.user as any)?.id,
            link: `/item-master`,
        });

        return NextResponse.json(
            successResponse('SOR item updated successfully', sorItem),
            { status: 200 }
        );
    } catch (error: any) {
        console.error('Error updating SOR item:', error);
        return NextResponse.json(
            errorResponse(error.message || 'Failed to update SOR item'),
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const company_id = await getCompanyId();

        if (!company_id) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }

        const sorItem = await prisma.sORItem.findFirst({
            where: { id },
        });

        if (!sorItem) {
            return NextResponse.json(
                errorResponse('SOR item not found'),
                { status: 404 }
            );
        }

        // Check if any ItemMaster records reference this SOR
        const itemMasterUsingSor = await prisma.itemMaster.findFirst({
            where: { sorId: id }
        });

        if (itemMasterUsingSor) {
            return NextResponse.json(
                errorResponse('This record cannot be deleted because it is currently in use.'),
                { status: 400 }
            );
        }

        // Check if any project uses this SOR through project items
        const projectUsingSor = await prisma.projectItem.findFirst({
            where: {
                OR: [
                    { capital_sor_id: id },
                    { capitalSOR: { sorId: id } }
                ]
            },
            include: {
                project: { select: { name: true } }
            }
        });

        if (projectUsingSor) {
            return NextResponse.json(
                errorResponse('This record cannot be deleted because it is currently in use.'),
                { status: 400 }
            );
        }

        await prisma.sORItem.delete({
            where: { id },
        });

        // Create notification for SuperAdmin
        const session = await getServerSession(authOptions);
        await createNotification({
            action: 'Deleted',
            entity: 'Maintenance SOR',
            entityId: id,
            entityName: sorItem.name,
            userId: (session?.user as any)?.id,
            link: `/item-master`,
        });

        return NextResponse.json(
            successResponse('SOR item deleted successfully'),
            { status: 200 }
        );
    } catch (error: any) {
        console.error('Error deleting SOR item:', error);
        if (error.code === 'P2003') {
            return NextResponse.json(
                errorResponse('Cannot delete SOR item that is in use'),
                { status: 400 }
            );
        }
        return NextResponse.json(
            errorResponse(error.message || 'Failed to delete SOR item'),
            { status: 500 }
        );
    }
}