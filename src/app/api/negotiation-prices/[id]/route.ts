import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        return await withCompany(async (company) => {
            const premium = await prisma.negotiationPrice.findFirst({
                where: {
                    id,
                },
            });

            if (!premium) {
                return NextResponse.json(
                    errorResponse('Negotiation price not found'),
                    { status: 404 }
                );
            }

            await prisma.negotiationPrice.delete({
                where: { id },
            });

            return NextResponse.json(
                successResponse('Negotiation price deleted successfully')
            );
        });
    } catch (error: any) {
        console.error('Error deleting negotiation price:', error);
        if (error.code === 'P2003') {
            return NextResponse.json(
                errorResponse('Cannot delete negotiation price that is in use'),
                { status: 400 }
            );
        }
        return NextResponse.json(
            errorResponse('Failed to delete negotiation price'),
            { status: 500 }
        );
    }
}
