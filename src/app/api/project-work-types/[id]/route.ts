import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
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
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existingWorkType = await prisma.projectWorkType.findFirst({
                where: { id },
            });

            if (!existingWorkType) {
                return NextResponse.json(
                    errorResponse('Project work type not found'),
                    { status: 404 }
                );
            }

            // Check if any project uses this work type
            const projectUsingWorkType = await prisma.project.findFirst({
                where: { work_type: id },
            });

            if (projectUsingWorkType) {
                // Get project name for better error message
                const projectWithName = await prisma.project.findUnique({
                    where: { id: projectUsingWorkType.id },
                    select: { name: true }
                });
                return NextResponse.json(
                    errorResponse(`Cannot delete work type that is in use by project ${projectWithName?.name || 'unknown'}`),
                    { status: 400 }
                );
            }

            await prisma.projectWorkType.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'ProjectWorkType',
                entityId: id,
                entityName: existingWorkType.title,
                userId: (session?.user as any)?.id,
                link: `/project-work-types`,
            });

            return NextResponse.json(
                successResponse('Project work type deleted successfully')
            );
        });
    } catch (error) {
        console.error('Error deleting project work type:', error);
        return NextResponse.json(
            errorResponse('Failed to delete project work type'),
            { status: 500 }
        );
    }
}