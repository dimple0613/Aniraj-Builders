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

function isValidFileUrl(url: string): boolean {
    return ALLOWED_FILE_EXTENSIONS.includes(getFileExtensionFromUrl(url));
}

const createDocumentSchema = yup.object({
    document_name: yup.string().required('Document name is required').max(NAME_MAX, `Name must not exceed ${NAME_MAX} characters`),
    expire_date: yup.string().required('Expire date is required'),
    reminder_date: yup.string().nullable().optional(),
    reminder_enabled: yup.boolean().default(true),
    reminder_days_before: yup.number().nullable().optional(),
    file: yup.string().required('Document file is required').test('valid-file-type', 'Only PDF, JPG, JPEG and PNG files are allowed', (value) => !!value && isValidFileUrl(value)),
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search')?.trim() || '';
        const sortField = searchParams.get('sortField') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const where: any = { company_id };
            if (search) {
                where.document_name = { contains: search, mode: 'insensitive' };
            }

            const validSortFields = ['document_name', 'expire_date', 'reminder_date', 'createdAt', 'updatedAt'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'createdAt';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const [data, total] = await Promise.all([
                prisma.document.findMany({
                    where,
                    orderBy: { [sortFieldToUse]: sortDirection },
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                prisma.document.count({ where }),
            ]);

            return NextResponse.json(
                successResponse('Documents fetched successfully', data, {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                })
            );
        });
    } catch (error: any) {
        console.error('Error fetching documents:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch documents'), { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        let validated: yup.InferType<typeof createDocumentSchema>;
        try {
            validated = await createDocumentSchema.validate(body, { abortEarly: false });
        } catch (err: any) {
            const errorMessages = err.inner
                .map((issue: any) => `${issue.path}: ${issue.message}`)
                .join('; ');
            return NextResponse.json(errorResponse(errorMessages), { status: 400 });
        }

        const { document_name, expire_date, reminder_date, reminder_enabled, reminder_days_before, file } = validated;

        let computedReminderDate = reminder_date;
        if (reminder_enabled && !reminder_date && reminder_days_before && expire_date) {
            const d = new Date(expire_date);
            d.setDate(d.getDate() - reminder_days_before);
            computedReminderDate = d.toISOString().split('T')[0];
        }
        if (!computedReminderDate) {
            computedReminderDate = expire_date;
        }

        if (reminder_enabled && new Date(computedReminderDate) > new Date(expire_date)) {
            return NextResponse.json(
                errorResponse('Reminder date must be on or before the expire date'),
                { status: 400 }
            );
        }

        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const document = await prisma.document.create({
                data: {
                    company_id,
                    document_name,
                    expire_date: parseDateOnly(expire_date),
                    reminder_date: parseDateOnly(computedReminderDate!),
                    reminder_enabled: reminder_enabled ?? true,
                    reminder_days_before: reminder_days_before ?? null,
                    file,
                    file_type: getFileTypeFromUrl(file),
                },
            });

            await createNotification({
                action: 'Created',
                entity: 'Document',
                entityId: document.id,
                entityName: document.document_name,
                userId: (session?.user as any)?.id,
                link: `/documents`,
            });

            return NextResponse.json(
                successResponse('Document created successfully', document),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error creating document:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to create document'), { status: 500 });
    }
}
