import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';
import { parseDateOnly } from '@/lib/date-utils';

const NAME_MAX = 200;

const updateDocumentSchema = yup.object({
    employee_id: yup.string().optional(),
    document_name: yup.string().max(NAME_MAX, `Name must not exceed ${NAME_MAX} characters`).optional(),
    file: yup.string().nullable().optional(),
    expiry_date: yup.string().nullable().optional(),
});

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

            const document = await prisma.employeeDocument.findFirst({
                where: { id, company_id },
                include: {
                    employee: {
                        select: { id: true, name: true, employee_code: true },
                    },
                },
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

            const existing = await prisma.employeeDocument.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Document not found'),
                    { status: 404 }
                );
            }

            if (validated.employee_id) {
                const employee = await prisma.employee.findFirst({
                    where: { id: validated.employee_id, company_id },
                });
                if (!employee) {
                    return NextResponse.json(
                        errorResponse('Selected employee does not exist'),
                        { status: 400 }
                    );
                }
            }

            const document = await prisma.employeeDocument.update({
                where: { id },
                data: {
                    ...(validated.employee_id !== undefined && { employee_id: validated.employee_id }),
                    ...(validated.document_name !== undefined && { document_name: validated.document_name }),
                    ...(validated.file !== undefined && { file: validated.file }),
                    ...(validated.expiry_date !== undefined && { expiry_date: validated.expiry_date ? parseDateOnly(validated.expiry_date) : null }),
                },
            });

            await createNotification({
                action: 'Updated',
                entity: 'EmployeeDocument',
                entityId: document.id,
                entityName: document.document_name,
                userId: (session?.user as any)?.id,
                link: `/hr/documents`,
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

            const existing = await prisma.employeeDocument.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Document not found'),
                    { status: 404 }
                );
            }

            await prisma.employeeDocument.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'EmployeeDocument',
                entityId: id,
                entityName: existing.document_name,
                userId: (session?.user as any)?.id,
                link: `/hr/documents`,
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
