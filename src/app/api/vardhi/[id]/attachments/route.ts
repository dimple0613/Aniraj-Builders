import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir, unlink } from 'fs/promises';
import { join } from 'path';
import { getServerSession, authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_PDF_TYPES = ['application/pdf'];
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const attachmentTypes = ['report_pdf', 'site_photography', 'site_clear_photo', 'other_attachment'] as const;
type AttachmentType = typeof attachmentTypes[number];

function extractEXIFData(buffer: Buffer, mimeType: string): { isMobilePhoto: boolean; error?: string } {
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
                return { isMobilePhoto: true };
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

const validations: Record<AttachmentType, { allowedTypes: string[]; validateExif: boolean }> = {
    report_pdf: { allowedTypes: ALLOWED_PDF_TYPES, validateExif: false },
    site_photography: { allowedTypes: ALLOWED_IMAGE_TYPES, validateExif: true },
    site_clear_photo: { allowedTypes: ALLOWED_IMAGE_TYPES, validateExif: true },
    other_attachment: { allowedTypes: [...ALLOWED_PDF_TYPES, ...ALLOWED_IMAGE_TYPES], validateExif: true },
};

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const vardhi = await prisma.vardhi.findFirst({
                where: { id, company_id },
            });

            if (!vardhi) {
                return NextResponse.json(errorResponse('Vardhi not found'), { status: 404 });
            }

            const attachments = await prisma.vardhiAttachment.findMany({
                where: { vardhi_id: id },
                orderBy: { created_at: 'desc' },
            });

            const grouped = attachments.reduce((acc: any, att: any) => {
                if (!acc[att.type]) {
                    acc[att.type] = [];
                }
                acc[att.type].push(att);
                return acc;
            }, {} as Record<string, typeof attachments>);

            return NextResponse.json(successResponse('Attachments fetched successfully', {
                attachments,
                grouped,
                legacy: {
                    report_pdf: vardhi.report_pdf,
                    site_photography: vardhi.site_photography,
                    site_clear_photo: vardhi.site_clear_photo,
                    other_attachment: vardhi.other_attachment,
                }
            }));
        });
    } catch (error: any) {
        console.error('Error fetching attachments:', error);
        if (error.message?.includes('COMPANY_CONTEXT_MISSING')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse('Failed to fetch attachments'), { status: 500 });
    }
}

export async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const session = await getServerSession(authOptions);

        if (!session?.user?.id) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const type = formData.get('type') as string;

        if (!file) {
            return NextResponse.json(errorResponse('No file uploaded'), { status: 400 });
        }

        if (!type || !attachmentTypes.includes(type as AttachmentType)) {
            return NextResponse.json(errorResponse('Invalid attachment type'), { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(errorResponse('File size must be less than 5MB'), { status: 400 });
        }

        const validation = validations[type as AttachmentType];
        if (!validation.allowedTypes.includes(file.type)) {
            return NextResponse.json(
                errorResponse(`Only ${validation.allowedTypes.join(', ')} files are allowed`),
                { status: 400 }
            );
        }

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const vardhi = await prisma.vardhi.findFirst({
                where: { id, company_id },
            });

            if (!vardhi) {
                return NextResponse.json(errorResponse('Vardhi not found'), { status: 404 });
            }

            const bytes = await file.arrayBuffer();
            const buffer = Buffer.from(bytes);

            if (validation.validateExif && file.type.startsWith('image/')) {
                const exifResult = extractEXIFData(buffer, file.type);
                if (!exifResult.isMobilePhoto) {
                    return NextResponse.json(
                        errorResponse(exifResult.error || 'Please upload a mobile-taken photo'),
                        { status: 400 }
                    );
                }
            }

            const folderPath = join('uploads', 'vardhi', company_id, id);
            const uploadsDir = join(process.cwd(), 'public', folderPath);

            try {
                await mkdir(uploadsDir, { recursive: true });
            } catch { }

            const timestamp = Date.now();
            const ext = file.name.split('.').pop()?.toLowerCase() || (file.type === 'application/pdf' ? 'pdf' : 'jpg');
            const filename = `${type}_${timestamp}.${ext}`;
            const filepath = join(uploadsDir, filename);

            await writeFile(filepath, buffer);

            const filePath = `/${folderPath}/${filename}`;

            const attachment = await prisma.vardhiAttachment.create({
                data: {
                    vardhi_id: id,
                    company_id,
                    type,
                    file_path: filePath,
                    file_name: file.name,
                    file_size: file.size,
                    mime_type: file.type,
                },
            });

            return NextResponse.json(successResponse('File uploaded successfully', attachment));
        });
    } catch (error: any) {
        console.error('Upload error:', error);
        if (error.message?.includes('COMPANY_CONTEXT_MISSING')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse('Failed to upload file'), { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const { searchParams } = new URL(request.url);
        const attachmentId = searchParams.get('attachmentId');
        const type = searchParams.get('type');

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            if (attachmentId) {
                const attachment = await prisma.vardhiAttachment.findFirst({
                    where: { id: attachmentId, vardhi_id: id, company_id },
                });

                if (!attachment) {
                    return NextResponse.json(errorResponse('Attachment not found'), { status: 404 });
                }

                try {
                    const fullPath = join(process.cwd(), 'public', attachment.file_path);
                    await unlink(fullPath);
                } catch (error: any) {
                    if (error.code !== 'ENOENT') {
                        console.error('Error deleting file:', error);
                    }
                }

                await prisma.vardhiAttachment.delete({ where: { id: attachmentId } });
                return NextResponse.json(successResponse('Attachment deleted successfully'));
            }

            if (type && attachmentTypes.includes(type as AttachmentType)) {
                const attachments = await prisma.vardhiAttachment.findMany({
                    where: { vardhi_id: id, company_id, type },
                });

                for (const attachment of attachments) {
                    try {
                        const fullPath = join(process.cwd(), 'public', attachment.file_path);
                        await unlink(fullPath);
                    } catch { }
                }

                await prisma.vardhiAttachment.deleteMany({
                    where: { vardhi_id: id, company_id, type },
                });

                return NextResponse.json(successResponse('All attachments of this type deleted'));
            }

            return NextResponse.json(errorResponse('Attachment ID or type is required'), { status: 400 });
        });
    } catch (error: any) {
        console.error('Delete error:', error);
        if (error.message?.includes('COMPANY_CONTEXT_MISSING')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse('Failed to delete attachment'), { status: 500 });
    }
}
