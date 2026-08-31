import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const createLocationSchema = yup.object({
    name: yup.string().required('Name is required').max(100, 'Name must be less than 100 characters'),
    address: yup.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const projectId = searchParams.get('project_id');

    return await withCompany(async (company) => {
      const where: any = {};

      if (search) {
        where.name = { contains: search, mode: 'insensitive' };
      }

      if (projectId) {
        where.projectLocations = {
          some: { project_id: projectId }
        };
      }

      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        prisma.location.findMany({
          where,
          skip,
          take: limit,
          orderBy: { name: 'asc' },
        }),
        prisma.location.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        message: 'Locations fetched successfully',
        data,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const validation = await createLocationSchema.validate(body, { abortEarly: false })
      .catch(err => {
        const errorMessages = err.inner
          .map((issue: any) => `${issue.path}: ${issue.message}`)
          .join('; ');
        throw new Error(errorMessages);
      });

    const { name, address } = validation;

    const session = await getServerSession(authOptions);

    return await withCompany(async (company) => {
      const company_id = company?.company_id;

      const existingLocation = await prisma.location.findFirst({
        where: { name, ...(company_id && { company_id }) },
      });

      if (existingLocation) {
        return NextResponse.json(
          { success: false, message: 'Location with this name already exists' },
          { status: 409 }
        );
      }

      const location = await prisma.location.create({
        data: {
          name,
          address,
          ...(company_id && { company_id }),
        },
      });

      await createNotification({
        action: 'Created',
        entity: 'Location',
        entityId: location.id,
        entityName: location.name,
        userId: (session?.user as any)?.id,
        link: `/locations`,
      });

      return NextResponse.json({
        success: true,
        message: 'Location created successfully',
        data: location,
      });
    });
  } catch (error: any) {
    console.error('Error creating location:', error);
    const message = error?.message || 'Failed to create location';
    const isValidationError = message.includes(':');
    return NextResponse.json(
      { success: false, message },
      { status: isValidationError ? 400 : 500 }
    );
  }
}
