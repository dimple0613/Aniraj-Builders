import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { getServerSession, authOptions } from '@/lib/auth';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE = 2 * 1024 * 1024;

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return NextResponse.json(errorResponse('No file uploaded'), { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(errorResponse('File size must be less than 2MB'), { status: 400 });
        }

        if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
            return NextResponse.json(
                errorResponse('Only JPG, JPEG, and PNG files are allowed'),
                { status: 400 }
            );
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const companyId = session.user.company_id || 'default';

        const uploadsDir = join(process.cwd(), 'public', 'uploads', 'profile', companyId);

        await mkdir(uploadsDir, { recursive: true });

        const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const timestamp = Date.now();
        const filename = `${session.user.id}_${timestamp}.${ext}`;
        const filepath = join(uploadsDir, filename);

        await writeFile(filepath, buffer);

        const url = `/api/uploads/profile/${companyId}/${filename}?v=${timestamp}`;

        return NextResponse.json(successResponse('Image uploaded successfully', { url }), {
            headers: {
                'Cache-Control': 'no-store, must-revalidate',
                'Pragma': 'no-cache',
            },
        });
    } catch (error) {
        console.error('Upload error:', error);
        return NextResponse.json(errorResponse('Failed to upload file'), { status: 500 });
    }
}
