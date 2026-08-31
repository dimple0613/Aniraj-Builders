import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';

const updateRateSchema = yup.object({
    capitalSorId: yup.string().uuid('Invalid item ID').required('Item ID is required'),
    newRate: yup.number().required('Rate is required').min(0, 'Rate must be 0 or greater'),
    effectiveDate: yup.string().required('Effective date is required'),
});

function parseLocalDate(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0);
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const validation = await updateRateSchema.validate(body, { abortEarly: false }).catch((err) => {
            throw new Error(err.inner.map((issue: any) => `${issue.path}: ${issue.message}`).join('; '));
        });

        const { capitalSorId, newRate, effectiveDate } = validation as { capitalSorId: string; newRate: number; effectiveDate: string };
        const effectiveDateTime = parseLocalDate(effectiveDate);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;
            if (!company_id) return NextResponse.json(unauthorizedResponse(), { status: 401 });

            const capitalSor = await prisma.capitalSOR.findFirst({
                where: { id: capitalSorId },
            });
            if (!capitalSor) return NextResponse.json(errorResponse('Item not found'), { status: 404 });

            const oldRate = capitalSor.rate;
            const now = new Date();
            const isFuture = effectiveDateTime > now;

            await prisma.$transaction(async (tx) => {
                if (isFuture) {
                    const currentPrice = await tx.capitalSORPrice.findFirst({
                        where: {
                            capitalSor_id: capitalSorId,
                            start_date: { lte: now },
                            OR: [{ expiry_date: null }, { expiry_date: { gt: now } }],
                        },
                        orderBy: { start_date: 'desc' },
                    });
                    if (currentPrice) {
                        await tx.capitalSORPrice.update({
                            where: { id: currentPrice.id },
                            data: { expiry_date: effectiveDateTime },
                        });
                    }

                    await tx.capitalSORPrice.updateMany({
                        where: {
                            capitalSor_id: capitalSorId,
                            start_date: { gt: now },
                            expiry_date: null,
                        },
                        data: { expiry_date: effectiveDateTime },
                    });
                } else {
                    const currentPrice = await tx.capitalSORPrice.findFirst({
                        where: {
                            capitalSor_id: capitalSorId,
                            start_date: { lte: now },
                            OR: [{ expiry_date: null }, { expiry_date: { gt: now } }],
                        },
                        orderBy: { start_date: 'desc' },
                    });
                    if (currentPrice) {
                        await tx.capitalSORPrice.update({
                            where: { id: currentPrice.id },
                            data: { expiry_date: effectiveDateTime },
                        });
                    }
                }

                await tx.capitalSORPrice.create({
                    data: {
                        company_id,
                        capitalSor_id: capitalSorId,
                        price: newRate,
                        start_date: effectiveDateTime,
                        expiry_date: null,
                    },
                });

                await tx.capitalSOR.update({
                    where: { id: capitalSorId },
                    data: { rate: newRate },
                });
            });

            return NextResponse.json(successResponse('Rate updated successfully', {
                oldRate: oldRate ? Number(oldRate) : null,
                newRate,
                effectiveDate,
            }));
        });
    } catch (error: any) {
        console.error('Error updating rate:', error);
        const message = error?.message || 'Failed to update rate';
        return NextResponse.json(errorResponse(message), { status: message.includes(':') ? 400 : 500 });
    }
}
