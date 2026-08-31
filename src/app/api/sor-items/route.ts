import { NextRequest, NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { getServerSession, authOptions } from '@/lib/auth';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { createNotification } from '@/lib/notification-service';

if (!prisma) {
    throw new Error('Prisma client not initialized');
}

const createSORSchema = yup.object({
    name: yup.string().required('Name is required').max(255, 'Name must be less than 255 characters'),
});

async function getCompanyId(): Promise<string | null> {
    const session = await getServerSession(authOptions);
    const company_id = (session?.user as any)?.company_id;
    
    if (company_id) {
        return company_id;
    }
    
    const headerList = await headers();
    const headerCompanyId = headerList.get('x-company-id');
    if (headerCompanyId) {
        return headerCompanyId;
    }

    // SuperAdmin fallback: use the first active company
    if ((session?.user as any)?.role === 'SuperAdmin') {
        const firstCompany = await prisma.company.findFirst({
            where: { status: 'ACTIVE' },
            orderBy: { createdAt: 'asc' },
        });
        return firstCompany?.id || null;
    }
    
    return null;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search')?.trim() || '';
        const sortField = searchParams.get('sortField') || 'name';
        const sortOrder = searchParams.get('sortOrder') || 'asc';
        
        const company_id = await getCompanyId();
        if (!company_id) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }

        const where: any = {};
        if (search) {
            where.name = { contains: search, mode: 'insensitive' };
        }

        const validSortFields = ['name', 'createdAt', 'updatedAt'];
        const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'name';
        const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

        const [data, total] = await Promise.all([
            prisma.sORItem.findMany({
                where,
                orderBy: { [sortFieldToUse]: sortDirection },
                skip: (page - 1) * limit,
                take: limit,
                select: {
                    id: true,
                    name: true,
                    createdAt: true,
                    updatedAt: true,
                },
            }),
            prisma.sORItem.count({ where }),
        ]);

        return NextResponse.json(
            successResponse('SOR items fetched successfully', data, {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            })
        );
    } catch (error: any) {
        console.error('Error fetching SOR items:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch SOR items'), { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const validation = await createSORSchema.validate(body, { abortEarly: false })
            .catch(err => {
                const errorMessages = err.inner
                    .map((issue: any) => `${issue.path}: ${issue.message}`)
                    .join('; ');
                throw new Error(errorMessages);
            });

        const { name } = validation;
        const company_id = await getCompanyId();

        if (!company_id) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }

        const existingSOR = await prisma.sORItem.findFirst({
            where: {
                name: { equals: name, mode: 'insensitive' },
            },
        });

        if (existingSOR) {
            return NextResponse.json(
                errorResponse('SOR item with this name already exists'),
                { status: 409 }
            );
        }

        const sorItem = await prisma.sORItem.create({
            data: {
                name: name.trim(),
                company_id,
            },
        });

        // Create notification for SuperAdmin
        const session = await getServerSession(authOptions);
        await createNotification({
            action: 'Created',
            entity: 'Maintenance SOR',
            entityId: sorItem.id,
            entityName: sorItem.name,
            userId: (session?.user as any)?.id,
            link: `/item-master`,
        });

        return NextResponse.json(
            successResponse('SOR item created successfully', sorItem),
            { status: 201 }
        );
    } catch (error: any) {
        console.error('Error creating SOR item:', error);
        const message = error?.message || 'Failed to create SOR item';
        const isValidationError = message.includes(':');
        return NextResponse.json(errorResponse(message), { status: isValidationError ? 400 : 500 });
    }
}