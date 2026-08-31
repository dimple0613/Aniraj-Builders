import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { getServerSession, authOptions } from '@/lib/auth';
import { unlink } from 'fs/promises';
import path from 'path';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ photoId: string }> }
) {
  try {
    const { photoId } = await params;

    return await withCompany(async (company) => {
      const session = await getServerSession(authOptions);
      const userId = (session?.user as any)?.id;

      if (!userId) {
        return NextResponse.json(
          { success: false, message: 'Unauthorized' },
          { status: 401 }
        );
      }

      const photo = await prisma.projectPhoto.findFirst({
        where: {
          id: photoId,
          uploaded_by: userId,
          company_id: company?.company_id,
        },
      });

      if (!photo) {
        return NextResponse.json(
          { success: false, message: 'Photo not found' },
          { status: 404 }
        );
      }

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

      await prisma.projectPhoto.delete({
        where: { id: photoId },
      });

      return NextResponse.json({
        success: true,
        message: 'Photo deleted successfully',
      });
    });
  } catch (error) {
    console.error('Error deleting project photo:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete photo' },
      { status: 500 }
    );
  }
}
