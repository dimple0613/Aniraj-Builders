import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import * as yup from 'yup';

const resetPasswordSchema = yup.object({
    token: yup.string().required('Token is required'),
    password: yup
        .string()
        .required('Password is required')
        .min(8, 'Password must be at least 8 characters')
        .matches(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .matches(/[a-z]/, 'Password must contain at least one lowercase letter')
        .matches(/[0-9]/, 'Password must contain at least one number'),
});

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const validation = await resetPasswordSchema.validate(body, { abortEarly: false })
            .catch(err => {
                const errorMessages = err.inner
                    .map((issue: any) => `${issue.path}: ${issue.message}`)
                    .join('; ');
                throw new Error(errorMessages);
            });

        const { token, password } = validation;

        const resetToken = await prisma.passwordResetToken.findUnique({
            where: { token },
        });

        if (!resetToken) {
            return NextResponse.json(
                { error: 'Invalid or expired reset token' },
                { status: 400 }
            );
        }

        if (resetToken.usedAt) {
            return NextResponse.json(
                { error: 'This reset token has already been used' },
                { status: 400 }
            );
        }

        if (new Date() > resetToken.expiresAt) {
            return NextResponse.json(
                { error: 'Reset token has expired. Please request a new password reset.' },
                { status: 400 }
            );
        }

        const hashedPassword = await bcrypt.hash(password, 12);

        await prisma.$transaction([
            prisma.user.update({
                where: { id: resetToken.user_id },
                data: { password: hashedPassword },
            }),
            prisma.passwordResetToken.update({
                where: { id: resetToken.id },
                data: { usedAt: new Date() },
            }),
        ]);

        return NextResponse.json(
            { message: 'Password has been reset successfully. You can now log in with your new password.' },
            { status: 200 }
        );

    } catch (error: any) {
        console.error('Reset password error:', error);
        const message = error?.message || 'An error occurred';
        const isValidationError = message.includes(':');
        return NextResponse.json(
            { error: isValidationError ? message : 'An error occurred. Please try again later.' },
            { status: isValidationError ? 400 : 500 }
        );
    }
}
