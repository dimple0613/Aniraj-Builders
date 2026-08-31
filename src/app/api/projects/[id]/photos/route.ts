import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { getServerSession, authOptions } from '@/lib/auth';
import { toClientFileUrl } from '@/lib/upload-utils';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

async function ensureDir(dirPath: string): Promise<void> {
  if (!existsSync(dirPath)) {
    await mkdir(dirPath, { recursive: true });
  }
}

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

      const stages = await prisma.projectPhotoStage.findMany({
        where: {
          project_id: id,
        },
        orderBy: { created_at: 'asc' },
        include: {
          photos: {
            orderBy: { created_at: 'asc' },
          },
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Project photos fetched successfully',
        data: stages.map((stage) => ({
          ...stage,
          photos: (stage.photos || []).map((photo) => ({
            ...photo,
            file_url: toClientFileUrl(photo.file_url),
          })),
        })),
      });
    });
  } catch (error) {
    console.error('Error fetching project photos:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch project photos' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const stageId = formData.get('stage_id') as string | null;

    if (!file) {
      return NextResponse.json(
        { success: false, message: 'No file provided' },
        { status: 400 }
      );
    }

    if (!stageId) {
      return NextResponse.json(
        { success: false, message: 'Stage ID is required' },
        { status: 400 }
      );
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, message: 'Only image files are allowed' },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { success: false, message: 'File size must be less than 10MB' },
        { status: 400 }
      );
    }

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
      });

      if (!stage) {
        return NextResponse.json(
          { success: false, message: 'Stage not found' },
          { status: 404 }
        );
      }

      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'projects', id, 'photos');
      await ensureDir(uploadDir);

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const fileName = `${generateId()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const filePath = path.join(uploadDir, fileName);
      await writeFile(filePath, buffer);

      const relativePath = `/uploads/projects/${id}/photos/${fileName}`;

      const photo = await prisma.projectPhoto.create({
        data: {
          company_id: company?.company_id!,
          project_id: id,
          stage_id: stageId,
          uploaded_by: userId,
          file_url: relativePath,
          file_name: file.name,
          file_size: buffer.length,
          mime_type: file.type,
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Photo uploaded successfully',
        data: {
          id: photo.id,
          file_url: toClientFileUrl(photo.file_url),
          file_name: photo.file_name,
          file_size: photo.file_size,
          mime_type: photo.mime_type,
        },
      });
    });
  } catch (error) {
    console.error('Error uploading project photo:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to upload project photo' },
      { status: 500 }
    );
  }
}
