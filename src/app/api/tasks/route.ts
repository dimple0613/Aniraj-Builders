import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { taskSchema } from '@/lib/validations/task';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const taskType = searchParams.get('task_type');
    const status = searchParams.get('status');
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const sortBy = searchParams.get('sortField') || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    return await withCompany(async (company) => {
      const where: any = {
        company_id: company?.company_id,
      };

      if (search) {
        where.OR = [
          { title: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (taskType) where.task_type = taskType;
      if (status) where.status = status;

      if (startDate || endDate) {
        where.due_date = {};
        if (startDate) where.due_date.gte = new Date(startDate);
        if (endDate) where.due_date.lte = new Date(endDate);
      }

      const skip = (page - 1) * limit;

      const [data, total] = await Promise.all([
        prisma.task.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
        }),
        prisma.task.count({ where }),
      ]);

      return NextResponse.json({
        success: true,
        message: 'Tasks fetched successfully',
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
    console.error('Error fetching tasks:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = await taskSchema.validate(body, { abortEarly: false });

    return await withCompany(async (company) => {
      const taskData = { ...validatedData, company_id: company?.company_id };

      const task = await prisma.task.create({
        data: taskData as any,
      });

      return NextResponse.json({
        success: true,
        message: 'Task created successfully',
        data: task,
      });
    });
  } catch (error: any) {
    console.error('Error creating task:', error);
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
      { success: false, message: 'Failed to create task' },
      { status: 500 }
    );
  }
}
