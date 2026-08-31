import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { getServerSession, authOptions } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const stageName = typeof body?.stage_name === 'string' ? body.stage_name.trim() : '';

    return await withCompany(async (company) => {
      const session = await getServerSession(authOptions);
      const userId = (session?.user as any)?.id;

      if (!userId) {
        return NextResponse.json(
          { success: false, message: 'Unauthorized' },
          { status: 401 }
        );
      }

      const project = await prisma.project.findFirst({
        where: {
          id,
          company_id: company?.company_id,
        },
        select: { id: true },
      });

      if (!project) {
        return NextResponse.json(
          { success: false, message: 'Project not found' },
          { status: 404 }
        );
      }

      const existingCount = await prisma.projectPhotoStage.count({
        where: {
          project_id: id,
          uploaded_by: userId,
        },
      });

      const stage = await prisma.projectPhotoStage.create({
        data: {
          company_id: company?.company_id!,
          project_id: id,
          uploaded_by: userId,
          stage_name: stageName || `Stage ${existingCount + 1}`,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Stage created successfully',
        data: {
          id: stage.id,
          stage_name: stage.stage_name,
        },
      });
    });
  } catch (error) {
    console.error('Error creating project photo stage:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create stage' },
      { status: 500 }
    );
  }
}
