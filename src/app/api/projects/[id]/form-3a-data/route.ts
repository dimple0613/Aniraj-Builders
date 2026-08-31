import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const override = await prisma.form3AOverride.findUnique({
      where: { project_id: id },
    });

    const earliestPurchaseEntry = await prisma.purchaseEntry.findFirst({
      where: { project_id: id },
      orderBy: { entry_date: 'asc' },
      select: { entry_date: true },
    });

    return NextResponse.json({
      success: true,
      data: override,
      earliestPurchaseEntryDate: earliestPurchaseEntry?.entry_date?.toISOString() ?? null,
    });
  } catch (error) {
    console.error('Form 3-A data fetch error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch Form 3-A data' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    const override = await prisma.form3AOverride.upsert({
      where: { project_id: id },
      create: {
        project_id: id,
        company_name: body.company_name ?? null,
        name_of_work: body.name_of_work ?? null,
        estimate_cost: body.estimate_cost ?? null,
        tender_amount: body.tender_amount ?? null,
        start_date: body.start_date ?? null,
        completion_date: body.completion_date ?? null,
        actual_completion_date: body.actual_completion_date ?? null,
        work_done_figure: body.work_done_figure ?? null,
        work_done_words: body.work_done_words ?? null,
        details_correct: body.details_correct ?? null,
        work_status: body.work_status ?? null,
        remarks: body.remarks ?? null,
      },
      update: {
        company_name: body.company_name ?? null,
        name_of_work: body.name_of_work ?? null,
        estimate_cost: body.estimate_cost ?? null,
        tender_amount: body.tender_amount ?? null,
        start_date: body.start_date ?? null,
        completion_date: body.completion_date ?? null,
        actual_completion_date: body.actual_completion_date ?? null,
        work_done_figure: body.work_done_figure ?? null,
        work_done_words: body.work_done_words ?? null,
        details_correct: body.details_correct ?? null,
        work_status: body.work_status ?? null,
        remarks: body.remarks ?? null,
      },
    });

    if (body.actual_completion_date) {
      const parsedDate = new Date(body.actual_completion_date);
      if (!isNaN(parsedDate.getTime())) {
        await prisma.project.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            is_completed: true,
            work_completion_date: parsedDate.toISOString(),
          },
        });
      }
    }

    return NextResponse.json({ success: true, data: override });
  } catch (error) {
    console.error('Form 3-A data save error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to save Form 3-A data' },
      { status: 500 },
    );
  }
}
