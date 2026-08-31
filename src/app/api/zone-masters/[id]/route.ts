import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createNotification } from '@/lib/notification-service';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const zoneMaster = await (prisma as any).zoneMaster.findUnique({
      where: { id },
      include: {
        officers: true
      }
    });

    if (!zoneMaster) {
      return NextResponse.json(
        { error: 'Zone master not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(zoneMaster);
  } catch (error) {
    console.error('Error fetching zone master:', error);
    return NextResponse.json(
      { error: 'Failed to fetch zone master' },
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

    const body = await request.json();
    const { name, officers } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'Name is required' },
        { status: 400 }
      );
    }

    const zoneMaster = await prisma.$transaction(async (tx: any) => {
      const zone = await tx.zoneMaster.update({
        where: { id },
        data: {
          name,
        },
      });

      if (officers) {
        await tx.zoneOfficer.deleteMany({
          where: { zone_id: id }
        });

        for (const officer of officers) {
          if (officer.status === 'CURRENT') {
            await tx.zoneOfficer.updateMany({
              where: { zone_id: id, status: 'CURRENT' },
              data: { status: 'PAST' }
            });
          }
          
          await tx.zoneOfficer.create({
            data: {
              zone_id: id,
              officer_name: officer.officer_name,
              contact_no: officer.contact_no,
              status: officer.status
            }
          });
        }
      }

      return zone;
    });

    // Create notification for Zone Master
    const session = await getServerSession(authOptions);
    await createNotification({
        action: 'Updated',
        entity: 'Zone Master',
        entityId: id,
        entityName: zoneMaster.name,
        userId: (session?.user as any)?.id,
        link: `/zone-masters`,
    });

    return NextResponse.json(zoneMaster);
   } catch (error) {
     console.error('Error updating zone master:', error);
    return NextResponse.json(
      { error: 'Failed to update zone master' },
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

    if (!id) {
      return NextResponse.json(
        { error: 'ID is required' },
        { status: 400 }
      );
    }

    await (prisma as any).zoneMaster.delete({
      where: { id },
    });

    // Create notification for Zone Master
    const session = await getServerSession(authOptions);
    await createNotification({
        action: 'Deleted',
        entity: 'Zone Master',
        entityId: id,
        userId: (session?.user as any)?.id,
        link: `/zone-masters`,
    });

    return NextResponse.json({
      message: 'Zone master deleted successfully',
    });
   } catch (error) {
     console.error('Error deleting zone master:', error);
    return NextResponse.json(
      { error: 'Failed to delete zone master' },
      { status: 500 }
    );
  }
}
