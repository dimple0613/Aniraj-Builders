import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { attendanceSchema } from '@/lib/validations/attendance';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    return await withCompany(async (company) => {
      const record = await prisma.attendance.findFirst({
        where: {
          id,
          company_id: company?.company_id,
        },
        include: {
          project: true,
        },
      });

      if (!record) {
        return NextResponse.json(
          { success: false, message: 'Attendance not found' },
          { status: 404 }
        );
      }

      const siblings = await prisma.attendance.findMany({
        where: {
          company_id: company?.company_id,
          attendance_date: record.attendance_date,
          project_id: record.project_id,
        },
      });

      const employeeNames = siblings.map(s => s.worker_name);
      const matchedEmployees = await prisma.employee.findMany({
        where: { name: { in: employeeNames } },
        select: { id: true, name: true },
      });
      const nameToEmployeeId = new Map(matchedEmployees.map(e => [e.name, e.id]));

      const employees = siblings.map(s => ({
        id: s.id,
        employee_id: nameToEmployeeId.get(s.worker_name) || '',
        employee: { name: s.worker_name },
        is_overtime: !!s.overtime_hours && s.overtime_hours.toNumber() > 0,
        overtime_hours: s.overtime_hours?.toString() || null,
        wages: s.wages ? Number(s.wages) : 0,
      }));

      return NextResponse.json({
        success: true,
        message: 'Attendance fetched successfully',
        data: {
          id: record.id,
          attendance_date: record.attendance_date,
          project_id: record.project_id,
          project: record.project,
          employees,
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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();

    return await withCompany(async (company) => {
      const existing = await prisma.attendance.findFirst({
        where: {
          id,
          company_id: company?.company_id,
        },
      });

      if (!existing) {
        return NextResponse.json(
          { success: false, message: 'Attendance not found' },
          { status: 404 }
        );
      }

      const employeeIds = (body.employees || []).map((e: any) => e.employee_id);
      const employees = await prisma.employee.findMany({
        where: { id: { in: employeeIds } },
        select: { id: true, name: true },
      });
      const employeeMap = new Map(employees.map(e => [e.id, e.name]));

      const latestSrNo = await prisma.attendance.findFirst({
        where: { company_id: company?.company_id },
        orderBy: { sr_no: 'desc' },
      });

      await prisma.attendance.deleteMany({
        where: {
          company_id: company?.company_id,
          attendance_date: existing.attendance_date,
          project_id: existing.project_id,
        },
      });

      let nextSrNo = (latestSrNo?.sr_no || 0) + 1;
      const newRecords = [];
      for (const emp of (body.employees || [])) {
        const workerName = employeeMap.get(emp.employee_id) || 'Unknown';
        const record = await prisma.attendance.create({
          data: {
            company_id: company?.company_id,
            attendance_date: new Date(body.attendance_date || existing.attendance_date),
            project_id: body.project_id ?? existing.project_id,
            worker_name: workerName,
            wages: emp.wages,
            overtime_hours: emp.overtime_hours || null,
            status: 'PRESENT',
            sr_no: nextSrNo++,
          },
          include: { project: true },
        });
        newRecords.push(record);
      }

      const session = await getServerSession(authOptions);
      const firstRecord = newRecords[0];
      if (firstRecord) {
        await createNotification({
          action: 'Updated',
          entity: 'Attendance',
          entityId: firstRecord.id,
          entityName: firstRecord.project?.name || firstRecord.id,
          userId: (session?.user as any)?.id,
          link: `/attendance`,
        });
      }

      return NextResponse.json({
        success: true,
        message: 'Attendance updated successfully',
        data: newRecords,
      });
    });
  } catch (error: any) {
    console.error('Error updating attendance:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'Failed to update attendance' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    return await withCompany(async (company) => {
      const existingAttendance = await prisma.attendance.findFirst({
        where: {
          id,
          company_id: company?.company_id,
        },
        include: { project: true },
      });

      if (!existingAttendance) {
        return NextResponse.json(
          { success: false, message: 'Attendance not found' },
          { status: 404 }
        );
      }

      await prisma.attendance.deleteMany({
        where: {
          company_id: company?.company_id,
          attendance_date: existingAttendance.attendance_date,
          project_id: existingAttendance.project_id,
        },
      });

      const session = await getServerSession(authOptions);
      await createNotification({
        action: 'Deleted',
        entity: 'Attendance',
        entityId: id,
        entityName: existingAttendance.project?.name || id,
        userId: (session?.user as any)?.id,
        link: `/attendance`,
      });

      return NextResponse.json({
        success: true,
        message: 'Attendance deleted successfully',
      });
    });
  } catch (error) {
    console.error('Error deleting attendance:', error);
    if (error instanceof Error) {
      return NextResponse.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, message: 'Failed to delete attendance' },
      { status: 500 }
    );
  }
}
