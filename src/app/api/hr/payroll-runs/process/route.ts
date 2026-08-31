import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

export async function POST() {
    try {
        const session = await getServerSession(authOptions);
        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const draftRuns = await prisma.payrollRun.findMany({
                where: { company_id, status: 'DRAFT' },
                include: {
                    financialYear: { select: { name: true } },
                    period: { select: { month: true, year: true } },
                    payrollItems: {
                        include: {
                            employee: { select: { id: true, name: true, employee_code: true } },
                            components: { include: { salaryComponent: true } },
                        },
                    },
                },
            });

            if (draftRuns.length === 0) {
                return NextResponse.json(
                    errorResponse('No draft payroll runs to process'),
                    { status: 400 }
                );
            }

            const updatedRuns = await Promise.all(
                draftRuns.map(run =>
                    prisma.payrollRun.update({
                        where: { id: run.id },
                        data: { status: 'PROCESSED' },
                    })
                )
            );

            const fyNames = [...new Set(draftRuns.map(r => r.financialYear?.name).filter(Boolean))];
            const fyLabel = fyNames.length === 1 ? fyNames[0] : fyNames.join(', ');

            await createNotification({
                action: 'Updated',
                entity: 'PayrollRun',
                entityName: `${updatedRuns.length} run(s) processed for ${fyLabel}`,
                userId: (session?.user as any)?.id,
                link: `/hr/payroll-runs`,
            });

            return NextResponse.json(
                successResponse(
                    `${updatedRuns.length} payroll run(s) processed successfully`,
                    updatedRuns
                )
            );
        });
    } catch (error: any) {
        console.error('Error processing payroll:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to process payroll';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
