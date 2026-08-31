import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const createProjectAreaSchema = yup.object({
    name: yup.string().required('Name is required').max(100, 'Name must be less than 100 characters'),
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search')?.trim() || '';

        return await withCompany(async (company) => {
            const where: any = {};
            if (search) {
                where.title = { contains: search, mode: 'insensitive' };
            }

            const data = await prisma.projectArea.findMany({
                where,
                orderBy: { title: 'asc' },
                select: {
                    id: true,
                    title: true,
                    createdAt: true,
                },
            });

            return NextResponse.json(
                successResponse('Project areas fetched successfully', data)
            );
        });
    } catch (error) {
        console.error('Error fetching project areas:', error);
        return NextResponse.json(
            errorResponse('Failed to fetch project areas'),
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const validation = await createProjectAreaSchema.validate(body, { abortEarly: false })
            .catch(err => {
                const errorMessages = err.inner
                    .map((issue: any) => `${issue.path}: ${issue.message}`)
                    .join('; ');
                throw new Error(errorMessages);
            });

        const { name } = validation;

        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const projectArea = await prisma.projectArea.create({
                data: {
                    title: name,
                    company_id,
                },
                select: {
                    id: true,
                    title: true,
                    createdAt: true,
                },
            });

            await createNotification({
                action: 'Created',
                entity: 'ProjectArea',
                entityId: projectArea.id,
                entityName: projectArea.title,
                userId: (session?.user as any)?.id,
                link: `/project-areas`,
            });

            return NextResponse.json(
                successResponse('Project area created successfully', projectArea),
                { status: 201 }
            );
        });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json(
                errorResponse('Project area with this name already exists'),
                { status: 409 }
            );
        }
        console.error('Error creating project area:', error);
        const message = error?.message || 'Failed to create project area';
        const isValidationError = message.includes(':');
        return NextResponse.json(
            errorResponse(message),
            { status: isValidationError ? 400 : 500 }
        );
    }
}
