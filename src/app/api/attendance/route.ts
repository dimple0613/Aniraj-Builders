import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { attendanceSchema } from '@/lib/validations/attendance';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';
    const projectId = searchParams.get('project_id') || '';
    const employeeId = searchParams.get('employee_id') || '';
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';
    const sortBy = searchParams.get('sortField') || 'attendance_date';
    const sortOrder = searchParams.get('sortOrder') || 'desc';

    return await withCompany(async (company) => {
      const where: any = {
        company_id: company?.company_id,
      };

      if (projectId) {
        where.project_id = projectId;
      }

      if (employeeId) {
        const employeeIds = employeeId.split(',');
        const employees = await prisma.employee.findMany({
          where: { id: { in: employeeIds } },
          select: { name: true },
        });
        const employeeNames = employees.map(e => e.name);
        where.worker_name = { in: employeeNames };
      }

      if (startDate && endDate) {
        where.attendance_date = {
          gte: new Date(startDate),
          lte: new Date(endDate),
        };
      }

      const skip = (page - 1) * limit;

      const [rawData, total] = await Promise.all([
        prisma.attendance.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [sortBy]: sortOrder },
          include: {
            project: true,
          },
        }),
        prisma.attendance.count({ where }),
      ]);

      const grouped = new Map<string, any>();
      for (const record of rawData) {
        const key = `${record.attendance_date.toISOString()}|${record.project_id || ''}`;
        if (!grouped.has(key)) {
          grouped.set(key, {
            id: record.id,
            sr_no: record.sr_no,
            attendance_date: record.attendance_date,
            project_id: record.project_id,
            project: record.project,
            employees: [],
          });
        }
        grouped.get(key).employees.push({
          id: record.id,
          employee: { name: record.worker_name },
          wages: Number(record.wages || 0),
          overtime_hours: record.overtime_hours?.toString() || null,
          status: record.status,
        });
      }

      const data = Array.from(grouped.values());

      return NextResponse.json({
        success: true,
        message: 'Attendance fetched successfully',
        data,
        pagination: {
          page,
          limit,
          total: data.length,
          pages: Math.ceil(data.length / limit),
        },
      });
    });
  } catch (error) {
    console.error('Error fetching attendance:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'Failed to fetch attendance' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = await attendanceSchema.validate(body, { abortEarly: false });

    return await withCompany(async (company) => {
      const existingAttendance = await prisma.attendance.findFirst({
        where: {
          company_id: company?.company_id,
          attendance_date: new Date(validatedData.attendance_date),
          project_id: validatedData.project_id,
        },
      });

      if (existingAttendance) {
        return NextResponse.json(
          { success: false, message: 'Attendance already exists for this date and project. You can edit the existing attendance.' },
          { status: 409 }
        );
      }

      const latestAttendance = await prisma.attendance.findFirst({
        where: { company_id: company?.company_id },
        orderBy: { sr_no: 'desc' },
      });

      let nextSrNo = (latestAttendance?.sr_no || 0) + 1;

      const employeeIds = (validatedData.employees || []).map(e => e.employee_id);
      const employees = await prisma.employee.findMany({
        where: { id: { in: employeeIds } },
        select: { id: true, name: true },
      });
      const employeeMap = new Map(employees.map(e => [e.id, e.name]));

      const attendanceRecords = [];
      for (const emp of (validatedData.employees || [])) {
        const workerName = employeeMap.get(emp.employee_id) || 'Unknown';
        const record = await prisma.attendance.create({
          data: {
            company_id: company?.company_id,
            attendance_date: new Date(validatedData.attendance_date),
            project_id: validatedData.project_id,
            worker_name: workerName,
            wages: emp.wages,
            overtime_hours: emp.overtime_hours || null,
            status: 'PRESENT',
            sr_no: nextSrNo++,
          },
          include: {
            project: true,
          },
        });
        attendanceRecords.push(record);
      }

      const session = await getServerSession(authOptions);
      const firstRecord = attendanceRecords[0];
      if (firstRecord) {
        await createNotification({
          action: 'Created',
          entity: 'Attendance',
          entityId: firstRecord.id,
          entityName: firstRecord.project?.name || firstRecord.id,
          userId: (session?.user as any)?.id,
          link: `/attendance`,
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Attendance created successfully',
        data: attendanceRecords,
      });
    });
  } catch (error: any) {
    console.error('Error creating attendance:', error);
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
      { success: false, message: 'Failed to create attendance' },
      { status: 500 }
    );
  }
}
