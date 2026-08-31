import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getServerSession, authOptions } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { company_id } = body;

    if (!company_id) {
      return NextResponse.json({ error: 'Company ID is required' }, { status: 400 });
    }

    const userId = (session.user as any).id;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { company_id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        company_id: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error switching company:', error);
    return NextResponse.json(
      { error: 'Failed to switch company' },
      { status: 500 }
    );
  }
}
