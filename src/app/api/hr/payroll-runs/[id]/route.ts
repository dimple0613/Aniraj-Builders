import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const updateSchema = yup.object({
    status: yup.string().oneOf(['DRAFT', 'PROCESSED', 'FINALIZED'], 'Status must be DRAFT, PROCESSED, or FINALIZED').optional(),
    notes: yup.string().nullable().optional(),
});

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

            const payrollRun = await prisma.payrollRun.findFirst({
                where: { id },
                include: {
                    financialYear: {
                        select: { id: true, name: true, start_date: true, end_date: true },
                    },
                    period: {
                        select: { id: true, month: true, year: true, start_date: true, end_date: true },
                    },
                    payrollItems: {
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

            if (!payrollRun) {
                return NextResponse.json(
                    errorResponse('Payroll run not found. It may have been created under a different company account.'),
                    { status: 404 }
                );
            }

            return NextResponse.json(
                successResponse('Payroll run fetched successfully', payrollRun)
            );
        });
    } catch (error: any) {
        console.error('Error fetching payroll run:', error);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch payroll run'), { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        let validated: yup.InferType<typeof updateSchema>;
        try {
            validated = await updateSchema.validate(body, { abortEarly: false });
        } catch (err: any) {
            const errorMessages = err.inner
                .map((issue: any) => `${issue.path}: ${issue.message}`)
                .join('; ');
            return NextResponse.json(errorResponse(errorMessages), { status: 400 });
        }

        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existing = await prisma.payrollRun.findFirst({
                where: { id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Payroll run not found. It may have been created under a different company account.'),
                    { status: 404 }
                );
            }

            const updateData: any = {};
            if (validated.status !== undefined) {
                updateData.status = validated.status;
            }
            if (validated.notes !== undefined) {
                updateData.notes = validated.notes;
            }

            const payrollRun = await prisma.payrollRun.update({
                where: { id },
                data: updateData,
                include: {
                    financialYear: {
                        select: { id: true, name: true },
                    },
                    period: {
                        select: { id: true, month: true, year: true },
                    },
                    payrollItems: {
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

            await createNotification({
                action: 'Updated',
                entity: 'PayrollRun',
                entityId: payrollRun.id,
                entityName: `Payroll run for ${payrollRun.financialYear?.name || 'N/A'}`,
                userId: (session?.user as any)?.id,
                link: `/hr/payroll-runs`,
            });

            return NextResponse.json(
                successResponse('Payroll run updated successfully', payrollRun)
            );
        });
    } catch (error: any) {
        console.error('Error updating payroll run:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to update payroll run';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existing = await prisma.payrollRun.findFirst({
                where: { id },
                include: {
                    financialYear: { select: { name: true } },
                },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Payroll run not found. It may have been created under a different company account.'),
                    { status: 404 }
                );
            }

            await prisma.payslip.deleteMany({
                where: { payroll_run_id: id },
            });

            await prisma.payrollRun.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'PayrollRun',
                entityId: id,
                entityName: `Payroll run for ${existing.financialYear?.name || 'N/A'}`,
                userId: (session?.user as any)?.id,
                link: `/hr/payroll-runs`,
            });

            return NextResponse.json(
                successResponse('Payroll run deleted successfully')
            );
        });
    } catch (error: any) {
        console.error('Error deleting payroll run:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to delete payroll run';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
