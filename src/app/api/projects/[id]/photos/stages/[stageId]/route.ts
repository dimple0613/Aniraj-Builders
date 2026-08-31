import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { getServerSession, authOptions } from '@/lib/auth';
import { unlink } from 'fs/promises';
import path from 'path';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; stageId: string }> }
) {
  try {
    const { id, stageId } = await params;

    return await withCompany(async (company) => {
      const session = await getServerSession(authOptions);
      const userId = (session?.user as any)?.id;

      if (!userId) {
        return NextResponse.json(
          { success: false, message: 'Unauthorized' },
          { status: 401 }
        );
      }

      const stage = await prisma.projectPhotoStage.findFirst({
        where: {
          id: stageId,
          project_id: id,
          uploaded_by: userId,
          company_id: company?.company_id,
        },
        include: {
          photos: true,
        },
      });

      if (!stage) {
        return NextResponse.json(
          { success: false, message: 'Stage not found' },
          { status: 404 }
        );
      }

      for (const photo of stage.photos) {
        if (photo.file_url) {
          try {
            const fullPath = path.join(process.cwd(), 'public', photo.file_url);
            await unlink(fullPath);
          } catch (error: any) {
            if (error.code !== 'ENOENT') {
              console.error('Error deleting photo file:', error);
            }
          }
        }
      }

      await prisma.projectPhotoStage.delete({
        where: { id: stageId },
      });

      return NextResponse.json({
        success: true,
        message: 'Stage deleted successfully',
      });
    });
  } catch (error) {
    console.error('Error deleting project photo stage:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete stage' },
      { status: 500 }
    );
  }
}
