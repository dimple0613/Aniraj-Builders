import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { generatePasswordResetEmailHtml, sendEmail } from '@/lib/email-utils';
import { randomBytes } from 'crypto';
import * as yup from 'yup';

const forgotPasswordSchema = yup.object({
    email: yup.string().required('Email is required').email('Invalid email address'),
});

const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 5;

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

function checkRateLimit(email: string): boolean {
    const now = Date.now();
    const record = rateLimitStore.get(email);

    if (!record || now > record.resetTime) {
        rateLimitStore.set(email, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
        return true;
    }

    if (record.count >= MAX_REQUESTS) {
        return false;
    }

    record.count++;
    return true;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        const validation = await forgotPasswordSchema.validate(body, { abortEarly: false })
            .catch(err => {
                const errorMessages = err.inner
                    .map((issue: any) => `${issue.path}: ${issue.message}`)
                    .join('; ');
                throw new Error(errorMessages);
            });

        const { email } = validation;

        if (!checkRateLimit(email)) {
            return NextResponse.json(
                { error: 'Too many reset requests. Please try again later.' },
                { status: 429 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (!user) {
            return NextResponse.json(
                { message: 'If an account with this email exists, a reset link has been sent.' },
                { status: 200 }
            );
        }

        const existingTokens = await prisma.passwordResetToken.findMany({
            where: {
                user_id: user.id,
                expiresAt: { gt: new Date() },
                usedAt: null,
            },
        });

        if (existingTokens.length > 0) {
            await prisma.passwordResetToken.updateMany({
                where: {
                    id: { in: existingTokens.map(t => t.id) },
                },
                data: {
                    expiresAt: new Date(),
                },
            });
        }

        const resetToken = randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        await prisma.passwordResetToken.create({
            data: {
                user_id: user.id,
                token: resetToken,
                expiresAt,
            },
        });

        const emailSent = await sendEmail({
            to: user.email,
            subject: 'Password Reset Request',
            html: generatePasswordResetEmailHtml(user.name, resetToken, 15),
        });

        if (!emailSent) {
            console.error('Failed to send password reset email');
            return NextResponse.json(
                { error: 'Failed to send reset email. Please try again later.' },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { message: 'If an account with this email exists, a reset link has been sent.' },
            { status: 200 }
        );

    } catch (error: any) {
        console.error('Forgot password error:', error);
        const message = error?.message || 'An error occurred';
        const isValidationError = message.includes(':');
        return NextResponse.json(
            { error: isValidationError ? message : 'An error occurred. Please try again later.' },
            { status: isValidationError ? 400 : 500 }
        );
    }
}
