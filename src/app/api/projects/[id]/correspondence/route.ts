import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const records = await prisma.correspondence.findMany({
      where: { project_id: id },
      orderBy: { sr_no: 'desc' },
    });

    return NextResponse.json({ success: true, data: records });
  } catch (error) {
    console.error('Error fetching correspondence:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch correspondence' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = await request.json();

    return await withCompany(async (company) => {
      const company_id = company?.company_id;
      if (!company_id) {
        return NextResponse.json(
          { success: false, message: 'Unauthorized' },
          { status: 401 },
        );
      }

      const record = await prisma.$transaction(async (tx) => {
        const record = await tx.correspondence.create({
          data: {
            company_id,
            project_id: id,
            sr_no: body.sr_no,
            type: body.type || null,
            docket_no: body.docket_no || null,
            subject: body.subject || null,
            document_content: body.document_content || null,
            document_urls: body.document_urls || null,
          },
        });

        const project = await tx.project.findUnique({
          where: { id },
          select: { correspondence_global_sr_no: true },
        });

        if (project && project.correspondence_global_sr_no === null) {
          const maxResult = await tx.project.aggregate({
            _max: { correspondence_global_sr_no: true },
          });
          const nextSr = (maxResult._max.correspondence_global_sr_no ?? 0) + 1;
          await tx.project.update({
            where: { id },
            data: { correspondence_global_sr_no: nextSr },
          });
        }

        return record;
      });

      return NextResponse.json({ success: true, data: record }, { status: 201 });
    });
  } catch (error) {
    console.error('Error creating correspondence:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create correspondence' },
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

    return await withCompany(async (company) => {
      const company_id = company?.company_id;
      if (!company_id) {
        return NextResponse.json(
          { success: false, message: 'Unauthorized' },
          { status: 401 },
        );
      }

      const record = await prisma.correspondence.update({
        where: { id: body.id },
        data: {
          type: body.type ?? undefined,
          docket_no: body.docket_no ?? undefined,
          subject: body.subject ?? undefined,
          document_content: body.document_content ?? undefined,
          document_urls: body.document_urls ?? undefined,
        },
      });

      return NextResponse.json({ success: true, data: record });
    });
  } catch (error) {
    console.error('Error updating correspondence:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to update correspondence' },
      { status: 500 },
    );
  }
}
