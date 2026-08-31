import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { itemId, capitalSorId, section, actual1 } = body;

        const numValue = typeof actual1 === 'number' ? actual1 : parseFloat(actual1);
        const value = isNaN(numValue) ? 0 : numValue;
        const field = section === 2 ? 'add2_actual1' : 'add1_actual1';

        return await withCompany(async (company) => {
            const data = field === 'add2_actual1' ? { add2_actual1: value } : { add1_actual1: value };

            if (itemId) {
                const updated = await prisma.projectItem.updateMany({
                    where: { id: itemId, project_id: id, company_id: company.company_id },
                    data,
                });
                return NextResponse.json({ ok: true, updated: updated.count });
            }

            if (capitalSorId) {
                const updated = await prisma.projectItem.updateMany({
                    where: { project_id: id, capital_sor_id: capitalSorId, company_id: company.company_id },
                    data,
                });
                return NextResponse.json({ ok: true, updated: updated.count });
            }

            return NextResponse.json({ ok: false, error: 'No item reference provided' }, { status: 400 });
        });
    } catch (error) {
        console.error('Error saving abstract comparison:', error);
        return NextResponse.json({ ok: false, error: 'Failed to save' }, { status: 500 });
    }
}
