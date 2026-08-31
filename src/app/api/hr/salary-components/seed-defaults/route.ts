import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { getServerSession, authOptions } from '@/lib/auth';
import { upsertDefaultSalaryComponents, DEFAULT_SALARY_COMPONENTS } from '@/lib/payroll-defaults';
import { createNotification } from '@/lib/notification-service';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            await upsertDefaultSalaryComponents(prisma, company_id);

            const components = await prisma.payrollSalaryComponent.findMany({
                where: { company_id, code: { in: DEFAULT_SALARY_COMPONENTS.map((c) => c.code) } },
                orderBy: { sort_order: 'asc' },
            });

            await createNotification({
                action: 'Created',
                entity: 'SalaryComponent',
                entityId: company_id,
                entityName: 'Default salary components',
                userId: (session?.user as any)?.id,
                link: `/hr/salary-components`,
            });

            return NextResponse.json(
                successResponse('Default salary components loaded successfully', components),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error loading default salary components:', error);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to load default salary components';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
