import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import bcrypt from 'bcryptjs';

export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }

        const body = await request.json();
        const { currentPassword, newPassword, confirmPassword } = body;

        if (!currentPassword || !newPassword || !confirmPassword) {
            return NextResponse.json(
                errorResponse('All password fields are required'),
                { status: 400 }
            );
        }

        if (newPassword !== confirmPassword) {
            return NextResponse.json(
                errorResponse('New password and confirm password do not match'),
                { status: 400 }
            );
        }

        if (newPassword.length < 6) {
            return NextResponse.json(
                errorResponse('Password must be at least 6 characters'),
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
        });

        if (!user) {
            return NextResponse.json(errorResponse('User not found'), { status: 404 });
        }

        const isValidPassword = await bcrypt.compare(currentPassword, user.password);
        if (!isValidPassword) {
            return NextResponse.json(
                errorResponse('Current password is incorrect'),
                { status: 400 }
            );
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await prisma.user.update({
            where: { id: session.user.id },
            data: { password: hashedPassword },
        });

        return NextResponse.json(
            successResponse('Password changed successfully')
        );
    } catch (error) {
        console.error('Password change error:', error);
        return NextResponse.json(
            errorResponse('Failed to change password'),
            { status: 500 }
        );
    }
}
