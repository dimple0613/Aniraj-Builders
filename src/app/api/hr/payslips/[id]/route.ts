import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const payslip = await prisma.payslip.findFirst({
                where: { id },
                include: {
                    employee: {
                        select: { id: true, name: true, employee_code: true },
                    },
                    payrollRun: {
                        select: {
                            id: true,
                            company_id: true,
                            process_date: true,
                            status: true,
                            financialYear: {
                                select: { id: true, name: true },
                            },
                            period: {
                                select: { id: true, month: true, year: true, start_date: true, end_date: true },
                            },
                        },
                    },
                    payrollItem: {
                        include: {
                            employee: {
                                select: { id: true, name: true, employee_code: true },
                            },
                            components: {
                                include: {
                                    salaryComponent: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!payslip || payslip.payrollRun.company_id !== company_id) {
                return NextResponse.json(
                    errorResponse('Payslip not found'),
                    { status: 404 }
                );
            }

            return NextResponse.json(
                successResponse('Payslip fetched successfully', payslip)
            );
        });
    } catch (error: any) {
        console.error('Error fetching payslip:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch payslip'), { status: 500 });
    }
}
