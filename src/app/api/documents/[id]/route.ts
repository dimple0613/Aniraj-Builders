import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';
import { parseDateOnly } from '@/lib/date-utils';

const NAME_MAX = 200;
const ALLOWED_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];

function getFileExtensionFromUrl(url: string): string {
    const cleanUrl = url.split('?')[0];
    return cleanUrl.split('.').pop()?.toLowerCase() || '';
}

function getFileTypeFromUrl(url: string): string | null {
    const ext = getFileExtensionFromUrl(url);
    if (!ext) return null;
    if (ext === 'pdf') return 'pdf';
    if (['jpg', 'jpeg', 'png'].includes(ext)) return 'image';
    return null;
}

const updateDocumentSchema = yup.object({
    document_name: yup.string().max(NAME_MAX, `Name must not exceed ${NAME_MAX} characters`).optional(),
    expire_date: yup.string().optional(),
    reminder_date: yup.string().nullable().optional(),
    reminder_enabled: yup.boolean().optional(),
    reminder_days_before: yup.number().nullable().optional(),
    file: yup.string().nullable().optional().test('valid-file-type', 'Only PDF, JPG, JPEG and PNG files are allowed', (value) => !value || isValidFileUrl(value)),
});

function isValidFileUrl(url: string): boolean {
    return ALLOWED_FILE_EXTENSIONS.includes(getFileExtensionFromUrl(url));
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const document = await prisma.document.findFirst({
                where: { id, company_id },
            });

            if (!document) {
                return NextResponse.json(
                    errorResponse('Document not found'),
                    { status: 404 }
                );
            }

            return NextResponse.json(
                successResponse('Document fetched successfully', document)
            );
        });
    } catch (error: any) {
        console.error('Error fetching document:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch document'), { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        let validated: yup.InferType<typeof updateDocumentSchema>;
        try {
            validated = await updateDocumentSchema.validate(body, { abortEarly: false });
        } catch (err: any) {
            const errorMessages = err.inner
                .map((issue: any) => `${issue.path}: ${issue.message}`)
                .join('; ');
            return NextResponse.json(errorResponse(errorMessages), { status: 400 });
        }

        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existing = await prisma.document.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Document not found'),
                    { status: 404 }
                );
            }

            const expire_date = validated.expire_date ?? existing.expire_date.toISOString();
            const reminder_enabled = validated.reminder_enabled ?? existing.reminder_enabled;
            const reminder_days_before = validated.reminder_days_before ?? existing.reminder_days_before;

            let reminder_date = validated.reminder_date ?? existing.reminder_date.toISOString();
            if (reminder_enabled && validated.reminder_days_before !== undefined && validated.reminder_days_before !== null) {
                const d = new Date(expire_date);
                d.setDate(d.getDate() - validated.reminder_days_before);
                reminder_date = d.toISOString();
            } else if (reminder_enabled && validated.expire_date && existing.reminder_days_before) {
                const d = new Date(validated.expire_date);
                d.setDate(d.getDate() - existing.reminder_days_before);
                reminder_date = d.toISOString();
            }
            if (!reminder_enabled) {
                reminder_date = expire_date;
            }

            if (reminder_enabled && new Date(reminder_date) > new Date(expire_date)) {
                return NextResponse.json(
                    errorResponse('Reminder date must be on or before the expire date'),
                    { status: 400 }
                );
            }

            const document = await prisma.document.update({
                where: { id },
                data: {
                    ...(validated.document_name !== undefined && { document_name: validated.document_name }),
                    ...(validated.expire_date !== undefined && { expire_date: parseDateOnly(validated.expire_date) }),
                    ...(reminder_date && { reminder_date: parseDateOnly(new Date(reminder_date).toISOString().split('T')[0]) }),
                    ...(validated.reminder_enabled !== undefined && { reminder_enabled: validated.reminder_enabled }),
                    ...(validated.reminder_days_before !== undefined && { reminder_days_before: validated.reminder_days_before }),
                    ...(validated.file !== undefined && {
                        file: validated.file,
                        file_type: validated.file ? getFileTypeFromUrl(validated.file) : null,
                    }),
                },
            });

            await createNotification({
                action: 'Updated',
                entity: 'Document',
                entityId: document.id,
                entityName: document.document_name,
                userId: (session?.user as any)?.id,
                link: `/documents`,
            });

            return NextResponse.json(
                successResponse('Document updated successfully', document)
            );
        });
    } catch (error: any) {
        console.error('Error updating document:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to update document'), { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existing = await prisma.document.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Document not found'),
                    { status: 404 }
                );
            }

            await prisma.document.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'Document',
                entityId: id,
                entityName: existing.document_name,
                userId: (session?.user as any)?.id,
                link: `/documents`,
            });

            return NextResponse.json(
                successResponse('Document deleted successfully')
            );
        });
    } catch (error: any) {
        console.error('Error deleting document:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to delete document'), { status: 500 });
    }
}
