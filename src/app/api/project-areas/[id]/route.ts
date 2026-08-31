import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const existingArea = await prisma.projectArea.findFirst({
                where: { id },
            });

            if (!existingArea) {
                return NextResponse.json(
                    errorResponse('Project area not found'),
                    { status: 404 }
                );
            }

            // Check if any project uses this area
            const projectUsingArea = await prisma.$queryRawUnsafe<
                Array<{ count: string }>
            >(
                'SELECT COUNT(*) as count FROM "Project" WHERE area = $1',
                id
            );

            if (Number(projectUsingArea[0]?.count || 0) > 0) {
                return NextResponse.json(
                    errorResponse('Cannot delete area that is in use by projects'),
                    { status: 400 }
                );
            }

            await prisma.projectArea.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'ProjectArea',
                entityId: id,
                entityName: existingArea.title,
                userId: (session?.user as any)?.id,
                link: `/project-areas`,
            });

            return NextResponse.json(
                successResponse('Project area deleted successfully')
            );
        });
    } catch (error) {
        console.error('Error deleting project area:', error);
        return NextResponse.json(
            errorResponse('Failed to delete project area'),
            { status: 500 }
        );
    }
}