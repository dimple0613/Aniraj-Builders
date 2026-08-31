import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { unlink } from 'fs/promises';
import { join } from 'path';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: tempDocId } = await params;

    return await withCompany(async (company) => {
      const tempDoc = await prisma.tempProjectDocument.findFirst({
        where: {
          id: tempDocId,
          company_id: company?.company_id,
        },
      });

      if (!tempDoc) {
        return NextResponse.json(
          { success: false, message: 'Document not found' },
          { status: 404 }
        );
      }

      try {
        if (tempDoc.file_url) {
          const fullPath = join(process.cwd(), 'public', tempDoc.file_url);
          await unlink(fullPath);
        }
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          console.error('Error deleting file:', error);
        }
      }

      await prisma.tempProjectDocument.delete({
        where: { id: tempDocId },
      });

      return NextResponse.json({
        success: true,
        message: 'Document deleted successfully',
      });
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to delete document' },
      { status: 500 }
    );
  }
}
