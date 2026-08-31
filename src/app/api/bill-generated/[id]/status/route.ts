import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';

const VALID_TRANSITIONS: Record<string, string[]> = {
    DRAFT: ['FINAL'],
    FINAL: ['APPROVED', 'DRAFT'],
    APPROVED: [],
};

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { status } = await request.json();

        if (!status) {
            return NextResponse.json({ error: 'status is required' }, { status: 400 });
        }

        const result = await withCompany(async (company) => {
            const existing = await prisma.vardhiEstimation.findFirst({
                where: { id, company_id: company.company_id },
                select: { id: true, status: true },
            });

            if (!existing) throw new Error('ESTIMATION_NOT_FOUND');

            const allowed = VALID_TRANSITIONS[existing.status] || [];
            if (!allowed.includes(status)) {
                throw new Error(
                    `Invalid status transition: ${existing.status} → ${status}. Allowed: ${allowed.join(', ') || 'none'}`
                );
            }

            return prisma.vardhiEstimation.update({
                where: { id },
                data: { status },
            });
        });

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error updating estimation status:', error);
        if (error.message === 'ESTIMATION_NOT_FOUND') {
            return NextResponse.json({ error: 'Estimation not found' }, { status: 404 });
        }
        return NextResponse.json(
            { error: error.message || 'Failed to update status' },
            { status: 400 }
        );
    }
}
