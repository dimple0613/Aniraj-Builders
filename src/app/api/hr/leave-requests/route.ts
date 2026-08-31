import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';
import { parseDateOnly } from '@/lib/date-utils';

const createLeaveRequestSchema = yup.object({
    employee_id: yup.string().required('Employee is required'),
    leave_type_id: yup.string().required('Leave type is required'),
    from_date: yup.string().required('From date is required'),
    to_date: yup.string().required('To date is required'),
    reason: yup.string().nullable().optional(),
    status: yup.string().oneOf(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING').optional(),
});

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search')?.trim() || '';
        const sortField = searchParams.get('sortField') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';
        const status = searchParams.get('status')?.trim() || '';
        const employee_id = searchParams.get('employee_id')?.trim() || '';
        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const where: any = { company_id };
            if (search) {
                where.reason = { contains: search, mode: 'insensitive' };
            }
            if (status) {
                where.status = status;
            }
            if (employee_id) {
                where.employee_id = employee_id;
            }

            const validSortFields = ['createdAt', 'updatedAt', 'from_date', 'to_date', 'status'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'createdAt';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const [data, total] = await Promise.all([
                prisma.leaveRequest.findMany({
                    where,
                    orderBy: { [sortFieldToUse]: sortDirection },
                    skip: (page - 1) * limit,
                    take: limit,
                    include: {
                        employee: {
                            select: { id: true, name: true, employee_code: true },
                        },
                        leaveType: {
                            select: { id: true, name: true, days: true },
                        },
                    },
                }),
                prisma.leaveRequest.count({ where }),
            ]);

            return NextResponse.json(
                successResponse('Leave requests fetched successfully', data, {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                })
            );
        });
    } catch (error: any) {
        console.error('Error fetching leave requests:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch leave requests'), { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        let validated: {
            employee_id: string;
            leave_type_id: string;
            from_date: string;
            to_date: string;
            reason?: string | null;
            status?: string;
        };
        try {
            const validation = await createLeaveRequestSchema.validate(body, { abortEarly: false });
            validated = validation;
        } catch (err: any) {
            const errorMessages = err.inner
                .map((issue: any) => `${issue.path}: ${issue.message}`)
                .join('; ');
            return NextResponse.json(errorResponse(errorMessages), { status: 400 });
        }

        const { employee_id, leave_type_id, from_date, to_date, reason, status } = validated;
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

            const leaveType = await prisma.leaveType.findFirst({
                where: { id: leave_type_id, company_id },
            });

            if (!leaveType) {
                return NextResponse.json(
                    errorResponse('Selected leave type does not exist'),
                    { status: 400 }
                );
            }

            const fromDate = parseDateOnly(from_date);
            const toDate = parseDateOnly(to_date);

            if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
                return NextResponse.json(
                    errorResponse('Invalid date format'),
                    { status: 400 }
                );
            }

            if (toDate < fromDate) {
                return NextResponse.json(
                    errorResponse('To date must be on or after from date'),
                    { status: 400 }
                );
            }

            const leaveRequest = await prisma.leaveRequest.create({
                data: {
                    company_id,
                    employee_id,
                    leave_type_id,
                    from_date: fromDate,
                    to_date: toDate,
                    reason: reason || null,
                    status: status || 'PENDING',
                },
            });

            await createNotification({
                action: 'Created',
                entity: 'LeaveRequest',
                entityId: leaveRequest.id,
                entityName: `Leave request for ${employee.name}`,
                userId: (session?.user as any)?.id,
                link: `/hr/leave-requests`,
            });

            return NextResponse.json(
                successResponse('Leave request created successfully', leaveRequest),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error creating leave request:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        return NextResponse.json(errorResponse(error?.message || 'Failed to create leave request'), { status: 500 });
    }
}
