import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { withCompany } from '@/lib/company-server';

const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'application/pdf',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: projectId } = await params;

    return await withCompany(async (company) => {
      const company_id = company?.company_id;
      if (!company_id) {
        return NextResponse.json(
          { success: false, message: 'Unauthorized' },
          { status: 401 },
        );
      }

      const formData = await request.formData();
      const file = formData.get('file') as File | null;

      if (!file) {
        return NextResponse.json(
          { success: false, message: 'No file provided' },
          { status: 400 },
        );
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        return NextResponse.json(
          { success: false, message: 'Invalid file type. Allowed: JPG, JPEG, PNG, WEBP, PDF' },
          { status: 400 },
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { success: false, message: 'File too large. Max 10MB' },
          { status: 400 },
        );
      }

      const ext = file.name.split('.').pop()?.toLowerCase() || 'bin';
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      const filename = `${timestamp}-${randomSuffix}.${ext}`;

      const uploadDir = join(process.cwd(), 'public', 'uploads', 'correspondence', company_id, projectId);
      await mkdir(uploadDir, { recursive: true });

      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(join(uploadDir, filename), buffer);

      const url = `/api/uploads/correspondence/${company_id}/${projectId}/${filename}`;
      const fileType = file.type;

      return NextResponse.json({ success: true, url, fileType }, { status: 201 });
    });
  } catch (error) {
    console.error('Error uploading correspondence file:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to upload file' },
      { status: 500 },
    );
  }
}
