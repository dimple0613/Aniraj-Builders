import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { belongingsTransferSchema } from '@/lib/validations/task';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search');
    const sortField = searchParams.get('sortField') || 'transfer_date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    return await withCompany(async (company) => {
      const companyId = company?.company_id!;
      const skip = (page - 1) * limit;

      const whereClause: any = {
        company_id: companyId,
      };

      if (search) {
        whereClause.OR = [
          { fromProject: { name: { contains: search, mode: 'insensitive' } } },
          { toProject: { name: { contains: search, mode: 'insensitive' } } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [transfers, total] = await Promise.all([
        prisma.belongingsTransfer.findMany({
          where: whereClause,
          skip,
          take: limit,
          orderBy: { [sortField]: sortOrder },
          include: {
            fromProject: { select: { id: true, name: true } },
            toProject: { select: { id: true, name: true } },
          },
        }),
        prisma.belongingsTransfer.count({ where: whereClause }),
      ]);

      return NextResponse.json({
        success: true,
        message: 'Belongings transfers fetched successfully',
        data: transfers,
        pagination: {
          page,
          limit,
          pages: Math.ceil(total / limit),
          total,
        },
      });
    });
  } catch (error) {
    console.error('Error fetching belongings transfers:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch belongings transfers' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = await belongingsTransferSchema.validate(body, { abortEarly: false });

    return await withCompany(async (company) => {
      const companyId = company?.company_id!;

      const [fromProject, toProject] = await Promise.all([
        prisma.project.findFirst({
          where: { id: validatedData.from_project_id, company_id: companyId },
        }),
        prisma.project.findFirst({
          where: { id: validatedData.to_project_id, company_id: companyId },
        }),
      ]);

      if (!fromProject) {
        return NextResponse.json(
          { success: false, message: 'From project not found' },
          { status: 404 }
        );
      }

      if (!toProject) {
        return NextResponse.json(
          { success: false, message: 'To project not found' },
          { status: 404 }
        );
      }

      if (validatedData.from_project_id === validatedData.to_project_id) {
        return NextResponse.json(
          { success: false, message: 'From and To projects cannot be the same' },
          { status: 400 }
        );
      }

      const transfer = await prisma.belongingsTransfer.create({
        data: {
          company_id: companyId,
          from_project_id: validatedData.from_project_id,
          to_project_id: validatedData.to_project_id,
          transfer_date: validatedData.transfer_date,
          description: validatedData.description,
        },
        include: {
          fromProject: { select: { id: true, name: true } },
          toProject: { select: { id: true, name: true } },
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Belongings transfer created successfully',
        data: transfer,
      });
    });
  } catch (error: any) {
    console.error('Error creating belongings transfer:', error);
    if (error.name === 'ValidationError') {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'Failed to create belongings transfer' },
      { status: 500 }
    );
  }
}
