import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: session.user.id },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                company_id: true,
                profile_photo: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        if (!user) {
            return NextResponse.json(errorResponse('User not found'), { status: 404 });
        }

        return NextResponse.json(
            successResponse('User profile fetched successfully', user)
        );
    } catch (error) {
        console.error('Error fetching profile:', error);
        return NextResponse.json(
            errorResponse('Failed to fetch profile'),
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }

        const body = await request.json();
        const { name, email, profile_photo } = body;

        if (!name || !email) {
            return NextResponse.json(
                errorResponse('Name and email are required'),
                { status: 400 }
            );
        }

        const existingUser = await prisma.user.findUnique({
            where: { id: session.user.id },
        });

        if (!existingUser) {
            return NextResponse.json(errorResponse('User not found'), { status: 404 });
        }

        if (existingUser.email.toLowerCase() !== email.toLowerCase().trim()) {
            const emailExists = await prisma.user.findFirst({
                where: {
                    email: email.toLowerCase().trim(),
                    id: { not: session.user.id },
                },
            });

            if (emailExists) {
                return NextResponse.json(
                    errorResponse('Email is already taken'),
                    { status: 400 }
                );
            }
        }

        const updateData: Record<string, unknown> = {
            name: name.trim(),
            email: email.toLowerCase().trim(),
        };

        if (profile_photo !== undefined) {
            const cleanPath = profile_photo ? profile_photo.split('?v=')[0] : null;
            updateData.profile_photo = cleanPath;
        }

        const whereClause: { id: string; } = {
            id: session.user.id,
        };


        const updatedUser = await prisma.user.update({
            where: whereClause,
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                company_id: true,
                profile_photo: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        const profilePhotoWithVersion = updatedUser.profile_photo
            ? `${updatedUser.profile_photo}?v=${Date.now()}`
            : null;

       
        return NextResponse.json(successResponse('Profile updated successfully', updatedUser));
    } catch (error) {
        console.error('Error updating profile:', error);
        return NextResponse.json(
            errorResponse('Failed to update profile'),
            { status: 500 }
        );
    }
}
