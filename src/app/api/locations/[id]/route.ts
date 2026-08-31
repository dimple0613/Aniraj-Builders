import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const location = await prisma.location.findFirst({
                where: {
                    id,
                },
            });

            if (!location) {
                return NextResponse.json(
                    { success: false, message: 'Location not found' },
                    { status: 404 }
                );
            }

            // Check if any project uses this location
            const projectLocationLink = await prisma.projectLocation.findFirst({
                where: { location_id: id },
                include: {
                    project: {
                        select: {
                            name: true
                        }
                    }
                }
            });

            if (projectLocationLink) {
                return NextResponse.json(
                    { success: false, message: 'Cannot delete location that is in use by projects' },
                    { status: 400 }
                );
            }

            await prisma.location.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'Location',
                entityId: id,
                entityName: location.name,
                userId: (session?.user as any)?.id,
                link: `/locations`,
            });

            return NextResponse.json({
                success: true,
                message: 'Location deleted successfully',
            });
        });
    } catch (error) {
        console.error('Error deleting location:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to delete location' },
            { status: 500 }
        );
    }
}