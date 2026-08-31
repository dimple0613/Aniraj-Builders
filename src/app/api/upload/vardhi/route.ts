import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { getServerSession, authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';

const ALLOWED_PDF_TYPES = ['application/pdf'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const ALLOWED_EXTENSIONS: Record<string, string[]> = {
    'application/pdf': ['pdf'],
    'image/jpeg': ['jpg', 'jpeg'],
    'image/jpg': ['jpg', 'jpeg'],
    'image/png': ['png'],
};
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function validateFileExtension(filename: string, mimeType: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase();
    const allowedExts = ALLOWED_EXTENSIONS[mimeType] || [];
    return ext ? allowedExts.includes(ext) : false;
}

function validateMagicNumbers(buffer: Buffer, mimeType: string): boolean {
    if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
        return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
    }
    if (mimeType === 'image/png') {
        return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47;
    }
    if (mimeType === 'application/pdf') {
        return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
    }
    return false;
}

function extractEXIFData(buffer: Buffer, mimeType: string): { isMobilePhoto: boolean; error?: string } {
    // PNG files don't have EXIF data - allow them
    const allowedTypes = [
        'image/png',
        'image/jpeg',
        'image/jpg',
        'image/webp',
        'image/heic',
        'image/heif',
        'image/bmp',
        'image/tiff'
    ];

    if (allowedTypes.includes(mimeType)) {
        return { isMobilePhoto: true };
    }

    try {
        const exifHeader = buffer.toString('ascii', 0, 4);
        // if (exifHeader !== 'MM' && exifHeader !== 'II') {
        //     return { isMobilePhoto: false, error: 'Invalid image format' };
        // }

        const marker = buffer[2] === 0xFF ? 'JPEG' : '';
        if (marker !== 'JPEG') {
            return { isMobilePhoto: false, error: 'Only JPEG images are allowed' };
        }

        let offset = 2;
        while (offset < buffer.length) {
            if (buffer[offset] !== 0xFF) {
                offset++;
                continue;
            }

            const markerByte = buffer[offset + 1];

            if (markerByte === 0xD8 || markerByte === 0xD9) {
                offset += 2;
                continue;
            }

            if (markerByte === 0xE1) {
                const length = buffer.readUInt16BE(offset + 2);
                const exifData = buffer.slice(offset + 4, offset + 2 + length);
                const exifString = exifData.toString('ascii', 0, 6);

                if (exifString === 'Exif') {
                    const ifd0Start = offset + 10;

                    for (let i = ifd0Start; i < Math.min(ifd0Start + 500, buffer.length - 4); i += 12) {
                        const tag = buffer.readUInt16BE(i);
                        const type = buffer.readUInt16BE(i + 2);
                        const count = buffer.readUInt32BE(i + 4);

                        if (tag === 0x010F) {
                            return { isMobilePhoto: true };
                        }
                    }

                    return { isMobilePhoto: true };
                }
            }

            const length = buffer.readUInt16BE(offset + 2);
            offset += 2 + length;
        }

        return { isMobilePhoto: false, error: 'No EXIF data found - please upload a mobile-taken photo' };
    } catch (error) {
        console.error('EXIF extraction error:', error);
        return { isMobilePhoto: false, error: 'Failed to validate image' };
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const field = formData.get('field') as string;
        const vardhiId = formData.get('vardhi_id') as string;
        const companySlug = formData.get('company_slug') as string | null;

        if (!file) {
            return NextResponse.json(errorResponse('No file uploaded'), { status: 400 });
        }

        if (!field || !['report_pdf', 'site_photography', 'site_clear_photo', 'other_attachment'].includes(field)) {
            return NextResponse.json(errorResponse('Invalid field type'), { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(errorResponse('File size must be less than 5MB'), { status: 400 });
        }

        const validations: Record<string, { allowedTypes: string[]; validateExif: boolean }> = {
            report_pdf: { allowedTypes: ALLOWED_PDF_TYPES, validateExif: false },
            site_photography: { allowedTypes: ALLOWED_IMAGE_TYPES, validateExif: true },
            site_clear_photo: { allowedTypes: ALLOWED_IMAGE_TYPES, validateExif: true },
            other_attachment: { allowedTypes: [...ALLOWED_PDF_TYPES, ...ALLOWED_IMAGE_TYPES], validateExif: true },
        };

        const validation = validations[field];

        if (!validation.allowedTypes.includes(file.type)) {
            const allowedTypesStr = field === 'report_pdf' ? 'PDF' : field === 'other_attachment' ? 'PDF or JPG/PNG' : 'JPG/PNG';
            return NextResponse.json(errorResponse(`Only ${allowedTypesStr} files are allowed for ${field}`), { status: 400 });
        }

        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        if (validation.validateExif && file.type.startsWith('image/')) {
            const exifResult = extractEXIFData(buffer, file.type);
            if (!exifResult.isMobilePhoto) {
                return NextResponse.json(errorResponse(exifResult.error || 'Please upload a mobile-taken photo'), { status: 400 });
            }
        }

        let company_id: string | null = null;

        if (companySlug && !session?.user?.id) {
            const company = await prisma.company.findUnique({
                where: { slug: companySlug },
                select: { id: true }
            });
            company_id = company?.id || null;
        }

        if (!company_id) {
            const result = await withCompany(async (companyId) => {
                company_id = companyId?.company_id || null;
                return processUpload(file, field, vardhiId, company_id, session, buffer);
            });

            if (result instanceof NextResponse) return result;
            return NextResponse.json(successResponse('File uploaded successfully', result), {
                headers: { 'Cache-Control': 'no-store, must-revalidate', 'Pragma': 'no-cache' },
            });
        }

        const result = await processUpload(file, field, vardhiId, company_id, session, buffer);

        if (result instanceof NextResponse) return result;

        return NextResponse.json(successResponse('File uploaded successfully', result), {
            headers: { 'Cache-Control': 'no-store, must-revalidate', 'Pragma': 'no-cache' },
        });
    } catch (error: any) {
        console.error('Vardhi upload error:', error);
        if (error.message?.includes('COMPANY_CONTEXT_MISSING')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse('Failed to upload file'), { status: 500 });
    }
}

async function processUpload(file: File, field: string, vardhiId: string, company_id: string | null, session: any, buffer: Buffer) {
    if (!company_id) {
        return NextResponse.json(unauthorizedResponse(), { status: 401 });
    }

    let existingVardhi = null;
    if (vardhiId) {
        existingVardhi = await prisma.vardhi.findFirst({
            where: { id: vardhiId, company_id },
        });
        if (!existingVardhi) {
            return NextResponse.json(errorResponse('Vardhi not found'), { status: 404 });
        }
    }

    const folderPath = vardhiId
        ? join('vardhi', company_id, vardhiId)
        : session?.user?.id
            ? join('temp', company_id, session.user.id)
            : join('temp', company_id, 'public');

    const uploadsDir = join(process.cwd(), 'public', 'uploads', folderPath);

    try {
        await mkdir(uploadsDir, { recursive: true });
    } catch (error) { }

    const timestamp = Date.now();
    const ext = file.name.split('.').pop()?.toLowerCase() || (file.type === 'application/pdf' ? 'pdf' : 'jpg');
    const filename = `${field}_${timestamp}.${ext}`;
    const filepath = join(uploadsDir, filename);

    await writeFile(filepath, buffer);

    const url = `/api/uploads/${folderPath}/${filename}?v=${timestamp}`;
    let attachmentId = null;

    if (vardhiId && existingVardhi) {
        const folderPathForAttachment = join('uploads', 'vardhi', company_id, vardhiId);

        const attachment = await prisma.vardhiAttachment.create({
            data: {
                vardhi_id: vardhiId,
                company_id,
                type: field,
                file_path: `/api/${folderPathForAttachment}/${filename}?v=${timestamp}`,
                file_name: file.name,
                file_size: file.size,
                mime_type: file.type,
            },
        });
        attachmentId = attachment.id;
    }

    return { url, field, attachmentId };
}

export async function DELETE(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const field = searchParams.get('field');
        const vardhiId = searchParams.get('vardhi_id');
        const filepath = searchParams.get('filepath');

        if (!field || !filepath) {
            return NextResponse.json(
                errorResponse('Field and filepath are required'),
                { status: 400 }
            );
        }

        const result = await withCompany(async (companyId) => {
            const company_id = companyId?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            if (vardhiId) {
                const existingVardhi = await prisma.vardhi.findFirst({
                    where: {
                        id: vardhiId,
                        company_id,
                    },
                });

                if (!existingVardhi) {
                    return NextResponse.json(errorResponse('Vardhi not found'), { status: 404 });
                }

                const attachments = await prisma.vardhiAttachment.findMany({
                    where: { vardhi_id: vardhiId, type: field },
                });

                for (const att of attachments) {
                    try {
                        const fullPath = join(process.cwd(), 'public', att.file_path);
                        const { unlink } = await import('fs/promises');
                        await unlink(fullPath);
                    } catch { }
                }

                await prisma.vardhiAttachment.deleteMany({
                    where: { vardhi_id: vardhiId, type: field },
                });
            } else if (filepath) {
                const fullPath = join(process.cwd(), 'public', filepath);
                try {
                    const { unlink } = await import('fs/promises');
                    await unlink(fullPath);
                } catch (error: any) {
                    if (error.code !== 'ENOENT') {
                        throw error;
                    }
                }
            }

            return successResponse('File deleted successfully');
        });

        if (result instanceof NextResponse) {
            return result;
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Delete error:', error);
        if (error.message?.includes('COMPANY_CONTEXT_MISSING')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse('Failed to delete file'), { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const vardhiId = searchParams.get('vardhi_id');

        // vardhiId is optional - return empty if not provided
        if (!vardhiId) {
            return NextResponse.json(successResponse('Files retrieved successfully', {
                report_pdf: null,
                site_photography: null,
                site_clear_photo: null,
                other_attachment: null,
            }));
        }

        const result = await withCompany(async (companyId) => {
            const company_id = companyId?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const vardhi = await prisma.vardhi.findFirst({
                where: {
                    id: vardhiId,
                    company_id,
                },
            });

            if (!vardhi) {
                return NextResponse.json(errorResponse('Vardhi not found'), { status: 404 });
            }

            const attachments = await prisma.vardhiAttachment.findMany({
                where: { vardhi_id: vardhiId },
                orderBy: { created_at: 'desc' },
            });

            const grouped = attachments.reduce((acc: Record<string, any[]>, att) => {
                if (!acc[att.type]) {
                    acc[att.type] = [];
                }
                acc[att.type].push({
                    id: att.id,
                    file_path: att.file_path,
                    file_name: att.file_name,
                    file_size: att.file_size,
                    mime_type: att.mime_type,
                    created_at: att.created_at,
                });
                return acc;
            }, {});

            return {
                vardhi_id: vardhiId,
                attachments: attachments.map(att => ({
                    id: att.id,
                    type: att.type,
                    file_path: att.file_path,
                    file_name: att.file_name,
                    file_size: att.file_size,
                    mime_type: att.mime_type,
                    created_at: att.created_at,
                })),
                grouped,
            };
        });

        if (result instanceof NextResponse) {
            return result;
        }

        return NextResponse.json(successResponse('Files retrieved successfully', result));
    } catch (error: any) {
        console.error('Get files error:', error);
        if (error.message?.includes('COMPANY_CONTEXT_MISSING')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse('Failed to get files'), { status: 500 });
    }
}
