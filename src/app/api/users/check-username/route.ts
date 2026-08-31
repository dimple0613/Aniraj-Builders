import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { errorResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const username = searchParams.get('username')?.trim() || '';
        const userId = searchParams.get('userId') || '';

        if (!username) {
            return NextResponse.json({ available: false });
        }

        const result = await withCompany(async () => {
            const existing = await prisma.user.findFirst({
                where: {
                    username,
                    ...(userId ? { id: { not: userId } } : {}),
                } as any,
            });

            return { available: !existing };
        });

        if (result instanceof NextResponse) {
            return result;
        }

        return NextResponse.json(result);
    } catch (error) {
        console.error('Error checking username:', error);
        return NextResponse.json(
            errorResponse('Failed to check username'),
            { status: 500 }
        );
    }
}
