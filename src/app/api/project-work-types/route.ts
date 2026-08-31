import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const createProjectWorkTypeSchema = yup.object({
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

            const data = await prisma.projectWorkType.findMany({
                where,
                orderBy: { title: 'asc' },
                select: {
                    id: true,
                    title: true,
                    createdAt: true,
                },
            });

            return NextResponse.json(
                successResponse('Project work types fetched successfully', data)
            );
        });
    } catch (error) {
        console.error('Error fetching project work types:', error);
        return NextResponse.json(
            errorResponse('Failed to fetch project work types'),
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const validation = await createProjectWorkTypeSchema.validate(body, { abortEarly: false })
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

            const projectWorkType = await prisma.projectWorkType.create({
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
                entity: 'ProjectWorkType',
                entityId: projectWorkType.id,
                entityName: projectWorkType.title,
                userId: (session?.user as any)?.id,
                link: `/project-work-types`,
            });

            return NextResponse.json(
                successResponse('Project work type created successfully', projectWorkType),
                { status: 201 }
            );
        });
    } catch (error: any) {
        if (error.code === 'P2002') {
            return NextResponse.json(
                errorResponse('Project work type with this name already exists'),
                { status: 409 }
            );
        }
        console.error('Error creating project work type:', error);
        const message = error?.message || 'Failed to create project work type';
        const isValidationError = message.includes(':');
        return NextResponse.json(
            errorResponse(message),
            { status: isValidationError ? 400 : 500 }
        );
    }
}
