import { NextRequest, NextResponse } from 'next/server';
import { readFile, stat } from 'fs/promises';
import { join, normalize, relative } from 'path';
import { getServerSession, authOptions } from '@/lib/auth';

const UPLOADS_DIR = join(process.cwd(), 'public', 'uploads');

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MIME_TYPES: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'pdf': 'application/pdf',
};

function getMimeType(ext: string): string {
    return MIME_TYPES[ext.toLowerCase()] || 'application/octet-stream';
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ path: string[] }> }
) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return new NextResponse('Unauthorized', { status: 401 });
        }

        const { path } = await params;
        
        if (!path || path.length === 0) {
            return new NextResponse('Invalid path', { status: 400 });
        }

        const requestedPath = path.join('/');

        const normalizedPath = normalize(requestedPath);
        const relativePath = relative(normalize(UPLOADS_DIR), normalize(join(UPLOADS_DIR, normalizedPath)));

        if (relativePath.startsWith('..') || normalizedPath.includes('..')) {
            return new NextResponse('Invalid path', { status: 400 });
        }

        const filePath = join(UPLOADS_DIR, normalizedPath);

        try {
            const fileStats = await stat(filePath);
            const fileBuffer = await readFile(filePath);
            const ext = filePath.split('.').pop()?.toLowerCase() || 'bin';
            const mimeType = getMimeType(ext);

            return new NextResponse(fileBuffer, {
                headers: {
                    'Content-Type': mimeType,
                    'Content-Length': fileStats.size.toString(),
                    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                    'Pragma': 'no-cache',
                    'Expires': '0',
                    'ETag': `"${fileStats.ino}-${fileStats.mtime.getTime()}"`,
                    'Vary': 'Accept-Encoding',
                },
            });
        } catch (error: any) {
            if (error.code === 'ENOENT') {
                return new NextResponse('File not found', { status: 404 });
            }
            throw error;
        }
    } catch (error) {
        console.error('Error serving file:', error);
        return new NextResponse('Internal server error', { status: 500 });
    }
}
