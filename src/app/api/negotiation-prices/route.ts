import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';

const createNegotiationPriceSchema = yup.object({
    name: yup.string().required('Name is required').max(100, 'Name must be less than 100 characters'),
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search')?.trim() || '';
        const sortField = searchParams.get('sortField') || 'name';
        const sortOrder = searchParams.get('sortOrder') || 'asc';

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const where: any = { };
            if (search) {
                where.name = { contains: search, mode: 'insensitive' };
            }

            const validSortFields = ['name', 'createdAt', 'updatedAt'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'name';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const [data, total] = await Promise.all([
                prisma.negotiationPrice.findMany({
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
                prisma.negotiationPrice.count({ where }),
            ]);

            return NextResponse.json(
                successResponse('Negotiation prices fetched successfully', data, {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                })
            );
        });
    } catch (error) {
        console.error('Error fetching negotiation prices:', error);
        return NextResponse.json(errorResponse('Failed to fetch negotiation prices'), { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const validation = await createNegotiationPriceSchema.validate(body, { abortEarly: false })
            .catch(err => {
                const errorMessages = err.inner
                    .map((issue: any) => `${issue.path}: ${issue.message}`)
                    .join('; ');
                throw new Error(errorMessages);
            });

        const { name } = validation;

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existingNegotiationPrice = await prisma.negotiationPrice.findFirst({
                where: {
                    company_id,
                    name: { equals: name, mode: 'insensitive' },
                },
            });

            if (existingNegotiationPrice) {
                return NextResponse.json(
                    errorResponse('Negotiation price with this name already exists'),
                    { status: 409 }
                );
            }

            const negotiationPrice = await prisma.negotiationPrice.create({
                data: {
                    name,
                    company_id,
                },
                select: {
                    id: true,
                    name: true,
                    createdAt: true,
                    updatedAt: true,
                },
            });

            return NextResponse.json(
                successResponse('Negotiation price created successfully', negotiationPrice),
                { status: 201 }
            );
        });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json(
                errorResponse('Negotiation price with this name already exists'),
                { status: 409 }
            );
        }
        console.error('Error creating negotiation price:', error);
        const message = error?.message || 'Failed to create negotiation price';
        const isValidationError = message.includes(':');
        return NextResponse.json(errorResponse(message), { status: isValidationError ? 400 : 500 });
    }
}
