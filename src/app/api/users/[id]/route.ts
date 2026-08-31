import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import bcrypt from 'bcryptjs';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { createNotification } from '@/lib/notification-service';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const user = await withCompany(async (companyId) => {
      const company_id = companyId?.company_id;

      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        return NextResponse.json(errorResponse('User not found'), { status: 404 });
      }

      if (company_id && user.company_id !== company_id) {
        return NextResponse.json(unauthorizedResponse(), { status: 403 });
      }

      return user;
    });

    if (user instanceof NextResponse) {
      return user;
    }

    return NextResponse.json(
      successResponse('User fetched successfully', user)
    );
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      errorResponse('Failed to fetch user'),
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;
    const body = await request.json();
    const { username, name, email, role, password, projectIds, zone_id, whatsapp_number } = body;

    if (!username || !name || !email || !role) {
      return NextResponse.json(
        errorResponse('Username, name, email, and role are required'),
        { status: 400 }
      );
    }

    if (role === 'Zone' && !zone_id) {
      return NextResponse.json(
        errorResponse('Zone is required for Zone role'),
        { status: 400 }
      );
    }

    const trimmedUsername = username.trim();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedUsername || !trimmedName || !trimmedEmail) {
      return NextResponse.json(
        errorResponse('Username, name, and email are required'),
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return NextResponse.json(
        errorResponse('Invalid email format'),
        { status: 400 }
      );
    }

    const result = await withCompany(async (companyId) => {
      const company_id = companyId?.company_id;

      if (!company_id) {
        return NextResponse.json(unauthorizedResponse(), { status: 401 });
      }

      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: { 
          company_id: true, 
          email: true, 
          username: true 
        } as any
      }) as any;

      if (!existingUser) {
        return NextResponse.json(errorResponse('User not found'), { status: 404 });
      }

      if (existingUser.company_id !== company_id) {
        return NextResponse.json(unauthorizedResponse(), { status: 403 });
      }

      // Check username uniqueness (exclude current user)
      if ((existingUser as any)?.username !== trimmedUsername) {
        const duplicateUsername = await prisma.user.findFirst({
          where: {
            username: trimmedUsername,
            id: { not: id },
          } as any
        });

        if (duplicateUsername) {
          return NextResponse.json(
            errorResponse('Username already exists'),
            { status: 409 }
          );
        }
      }

      if ((existingUser as any)?.email?.toLowerCase() !== trimmedEmail) {
        const duplicateEmail = await prisma.user.findFirst({
          where: {
            email: trimmedEmail,
            id: { not: id },
          },
        });

        if (duplicateEmail) {
          return NextResponse.json(
            errorResponse('Email already exists'),
            { status: 409 }
          );
        }
      }

      const updateData: any = {
        username: trimmedUsername,
        name: trimmedName,
        email: trimmedEmail,
        role,
        zone_id: role === 'Zone' ? zone_id : null,
        whatsapp_number: whatsapp_number || null,
      };

      if (password) {
        updateData.password = await bcrypt.hash(password, 10);
      }

      const user = await prisma.user.update({
        where: { id },
        data: updateData,
      });

      return prisma.user.findUnique({
        where: { id },
        include: {
          zone: {
            select: { id: true, name: true }
          }
        } as any
      });
    });

        if (result instanceof NextResponse) {
            return result;
        }

        // Create notification for SuperAdmin
        await createNotification({
            action: 'Updated',
            entity: 'User',
            entityId: id,
            entityName: (result as any)?.name,
            userId: userId as string,
            link: `/users`,
        });

        return NextResponse.json(
            successResponse('User updated successfully', result)
        );
  } catch (error: any) {
    if (error.code === 'P2002') {
      if (error.meta?.target?.includes('username')) {
        return NextResponse.json(
          errorResponse('Username already exists'),
          { status: 409 }
        );
      }
      return NextResponse.json(
        errorResponse('Email already exists'),
        { status: 409 }
      );
    }
    console.error('Error updating user:', error);
    return NextResponse.json(
      errorResponse('Failed to update user'),
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);
    const userId = (session?.user as any)?.id;

    let deletedUser: any = null;

    const result = await withCompany(async (companyId) => {
      const company_id = companyId?.company_id;

      if (!company_id) {
        return NextResponse.json(unauthorizedResponse(), { status: 401 });
      }

      const existingUser = await prisma.user.findUnique({
        where: { id },
        select: { company_id: true, name: true }
      });

      if (!existingUser) {
        return NextResponse.json(errorResponse('User not found'), { status: 404 });
      }

      if (existingUser.company_id !== company_id) {
        return NextResponse.json(unauthorizedResponse(), { status: 403 });
      }

      deletedUser = existingUser;

      await prisma.user.delete({
        where: { id },
      });

      return successResponse('User deleted successfully');
    });

    if (result instanceof NextResponse) {
      return result;
    }

    await createNotification({
      action: 'Deleted',
      entity: 'User',
      entityId: id,
      entityName: deletedUser?.name || id,
      userId: userId as string,
      link: `/users`,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      errorResponse('Failed to delete user'),
      { status: 500 }
    );
  }
}
