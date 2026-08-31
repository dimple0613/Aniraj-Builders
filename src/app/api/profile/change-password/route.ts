import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json(unauthorizedResponse(), { status: 401 });
    }

    const body = await request.json();
    const { current_password, new_password } = body;

    if (!current_password || !new_password) {
      return NextResponse.json(
        errorResponse('Current password and new password are required'),
        { status: 400 }
      );
    }

    if (new_password.length < 6) {
      return NextResponse.json(
        errorResponse('New password must be at least 6 characters'),
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true, company_id: true },
    });

    if (!existingUser) {
      return NextResponse.json(errorResponse('User not found'), { status: 404 });
    }

    const isValidPassword = await bcrypt.compare(
      current_password,
      existingUser.password
    );

    if (!isValidPassword) {
      return NextResponse.json(
        errorResponse('Current password is incorrect'),
        { status: 400 }
      );
    }

    if (current_password === new_password) {
      return NextResponse.json(
        errorResponse('New password must be different from current password'),
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(new_password, 10);

    await prisma.user.update({
      where: {
        id: session.user.id,
        company_id: session.user.company_id,
      },
      data: {
        password: hashedPassword,
      },
    });

    return NextResponse.json(
      successResponse('Password changed successfully', null)
    );
  } catch (error) {
    console.error('Error changing password:', error);
    return NextResponse.json(
      errorResponse('Failed to change password'),
      { status: 500 }
    );
  }
}
