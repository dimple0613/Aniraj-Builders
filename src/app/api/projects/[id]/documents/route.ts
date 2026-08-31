import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id?: string }> }
) {
  try {
    const { id: projectIdFromParams } = await params;
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const documentType = formData.get('documentType') as string | null;
    const projectIdFromForm = formData.get('projectId') as string | null;

    const projectId = projectIdFromForm || projectIdFromParams || null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'No file provided' },
        { status: 400 }
      );
    }

    if (!documentType) {
      return NextResponse.json(
        { success: false, message: 'Document type is required' },
        { status: 400 }
      );
    }

    const allowedTypes = ['application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: 'Only PDF files are allowed' },
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, message: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

    return await withCompany(async (company) => {
      let relativePath: string;
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const fileName = `${generateId()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

      if (projectId) {
        const project = await prisma.project.findFirst({
          where: {
            id: projectId,
            company_id: company?.company_id,
          },
        });

        if (!project) {
          return NextResponse.json(
            { success: false, message: 'Project not found' },
            { status: 404 }
          );
        }

        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'projects', projectId);
        await ensureDir(uploadDir);
        const filePath = path.join(uploadDir, fileName);
        await writeFile(filePath, buffer);
        relativePath = `/uploads/projects/${projectId}/${fileName}`;

        const projectDocument = await prisma.projectDocument.create({
          data: {
            company_id: company?.company_id!,
            project_id: projectId,
            document_type: documentType,
            file_url: relativePath,
            file_name: file.name,
            file_size: buffer.length,
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Document uploaded successfully',
          data: {
            id: projectDocument.id,
            file_url: projectDocument.file_url,
            file_name: projectDocument.file_name,
            document_type: projectDocument.document_type,
            file_size: buffer.length,
          },
        });
      } else {
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'temp');
        await ensureDir(uploadDir);
        const filePath = path.join(uploadDir, fileName);
        await writeFile(filePath, buffer);
        relativePath = `/uploads/temp/${fileName}`;

        const tempDocument = await prisma.tempProjectDocument.create({
          data: {
            company_id: company?.company_id!,
            document_type: documentType,
            file_url: relativePath,
            file_name: file.name,
            file_size: buffer.length,
          },
        });

        return NextResponse.json({
          success: true,
          message: 'Document uploaded successfully',
          data: {
            id: tempDocument.id,
            file_url: tempDocument.file_url,
            file_name: tempDocument.file_name,
            document_type: tempDocument.document_type,
            file_size: buffer.length,
          },
        });
      }
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to upload document' },
      { status: 500 }
    );
  }
}
