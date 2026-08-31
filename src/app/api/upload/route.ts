import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getServerSession, authOptions } from '@/lib/auth';
import { sanitizeFilename } from '@/lib/validations/upload';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_PDF_TYPES = ['application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const data = await request.formData();
        const file: File | null = data.get('file') as unknown as File;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: 'File size must be less than 5MB' }, { status: 400 });
        }

        if (!ALLOWED_IMAGE_TYPES.includes(file.type) && !ALLOWED_PDF_TYPES.includes(file.type)) {
            return NextResponse.json({ error: 'Only JPG, PNG, and PDF files are allowed' }, { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const uploadsDir = join(process.cwd(), 'public', 'uploads');
        try {
            await mkdir(uploadsDir, { recursive: true });
        } catch (error) {
        }

        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 10);
        const sanitizedName = sanitizeFilename(file.name);
        const ext = sanitizedName.split('.').pop()?.toLowerCase() || (file.type === 'application/pdf' ? 'pdf' : 'jpg');
        const filename = `${timestamp}-${randomSuffix}.${ext}`;
        const filepath = join(uploadsDir, filename);

        await writeFile(filepath, buffer);

        const url = `/api/uploads/${filename}?v=${timestamp}`;

        return NextResponse.json({ url }, {
            status: 201,
            headers: {
                'Cache-Control': 'no-store, must-revalidate',
                'Pragma': 'no-cache',
            },
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(
            { error: 'Failed to upload file' },
            { status: 500 }
        );
    }
}