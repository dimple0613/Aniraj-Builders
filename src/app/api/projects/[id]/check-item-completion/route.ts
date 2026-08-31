import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json(
        { success: false, message: 'Project not found' },
        { status: 404 },
      );
    }

    const items: any[] = await prisma.$queryRawUnsafe(
      `SELECT
        pi.capital_sor_id,
        pi.size AS estimated_qty,
        COALESCE(SUM(pem.qty), 0)::float AS purchased_qty
      FROM "ProjectItem" pi
      LEFT JOIN "PurchaseEntry" pe ON pe.project_id = $1
      LEFT JOIN "PurchaseEntryMaterial" pem ON pem.purchase_entry_id = pe.id AND pem.material_id = pi.capital_sor_id
      WHERE pi.project_id = $1
      GROUP BY pi.capital_sor_id, pi.size`,
      id
    );

    const allItemsCompleted = items.every((item: any) => {
      const estimated = parseFloat(item.estimated_qty) || 0;
      const purchased = parseFloat(item.purchased_qty) || 0;
      return purchased >= estimated;
    });

    const pendingItems = items.filter((item: any) => {
      const estimated = parseFloat(item.estimated_qty) || 0;
      const purchased = parseFloat(item.purchased_qty) || 0;
      return purchased < estimated;
    });

    return NextResponse.json({
      success: true,
      allItemsCompleted,
      totalItems: items.length,
      pendingItems: pendingItems.length,
    });
  } catch (error) {
    console.error('Check item completion error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to check item completion' },
      { status: 500 },
    );
  }
}
