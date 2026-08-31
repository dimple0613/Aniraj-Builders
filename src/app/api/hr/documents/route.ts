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

const createDocumentSchema = yup.object({
    employee_id: yup.string().required('Employee is required'),
    document_name: yup.string().required('Document name is required').max(NAME_MAX, `Name must not exceed ${NAME_MAX} characters`),
    file: yup.string().nullable().optional(),
    expiry_date: yup.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search')?.trim() || '';
        const sortField = searchParams.get('sortField') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';
        const employee_id = searchParams.get('employee_id')?.trim() || '';
        const document_name = searchParams.get('document_name')?.trim() || '';
        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const where: any = { company_id };
            if (search) {
                where.document_name = { contains: search, mode: 'insensitive' };
            }
            if (employee_id) {
                where.employee_id = employee_id;
            }
            if (document_name) {
                where.document_name = { contains: document_name, mode: 'insensitive' };
            }

            const validSortFields = ['document_name', 'createdAt', 'updatedAt', 'expiry_date'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'createdAt';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const [data, total] = await Promise.all([
                prisma.employeeDocument.findMany({
                    where,
                    orderBy: { [sortFieldToUse]: sortDirection },
                    skip: (page - 1) * limit,
                    take: limit,
                    include: {
                        employee: {
                            select: { id: true, name: true, employee_code: true },
                        },
                    },
                }),
                prisma.employeeDocument.count({ where }),
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

        let validated: {
            employee_id: string;
            document_name: string;
            file?: string | null;
            expiry_date?: string | null;
        };
        try {
            const validation = await createDocumentSchema.validate(body, { abortEarly: false });
            validated = validation;
        } catch (err: any) {
            const errorMessages = err.inner
                .map((issue: any) => `${issue.path}: ${issue.message}`)
                .join('; ');
            return NextResponse.json(errorResponse(errorMessages), { status: 400 });
        }

        const { employee_id, document_name, file, expiry_date } = validated;
        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const employee = await prisma.employee.findFirst({
                where: { id: employee_id, company_id },
            });

            if (!employee) {
                return NextResponse.json(
                    errorResponse('Selected employee does not exist'),
                    { status: 400 }
                );
            }

            const document = await prisma.employeeDocument.create({
                data: {
                    company_id,
                    employee_id,
                    document_name,
                    file: file || null,
                    expiry_date: expiry_date ? parseDateOnly(expiry_date) : null,
                },
            });

            await createNotification({
                action: 'Created',
                entity: 'EmployeeDocument',
                entityId: document.id,
                entityName: document.document_name,
                userId: (session?.user as any)?.id,
                link: `/hr/documents`,
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
