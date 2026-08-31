import { NextRequest, NextResponse } from 'next/server';
import { puppeteerManager } from '@/lib/puppeteer-server';
import { prisma } from '@/lib/prisma';
import { numberToWords } from '@/lib/financial-year';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function formatCurrency(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getWorkStatus(isCompleted: boolean, status: string): string {
  if (isCompleted || status === 'COMPLETED') {
    return 'This Work Is Completed As Per Specification';
  }
  return 'This Work Is In Progress';
}

async function generateForm3APDF(project: any): Promise<Buffer> {
  const itemsTotal = (project.items || []).reduce((sum: number, item: any) => {
    return sum + (parseFloat(item.size) || 0) * (Number(item.rate) || 0);
  }, 0);

  const totalAmount = project.total_amount ? Number(project.total_amount) : itemsTotal;
  let earliestPurchaseEntryDate: string | null = null;
  try {
    const entry = await prisma.purchaseEntry.findFirst({
      where: { project_id: project.id },
      orderBy: { entry_date: 'asc' },
      select: { entry_date: true },
    });
    if (entry) {
      earliestPurchaseEntryDate = entry.entry_date.toISOString();
    }
  } catch {
    // ignore
  }
  const startDate = earliestPurchaseEntryDate || project.loa_approved_date || project.work_order_date;
  const amountInWords = numberToWords(totalAmount);
  const workStatus = getWorkStatus(project.is_completed, project.status);
  const companyName = project.company?.company_name || 'Aniraj Builders';

  let override: any = null;
  try {
    override = await prisma.form3AOverride.findUnique({ where: { project_id: project.id } });
  } catch {
    // ignore
  }

  const ov = (field: string, fallback: string): string => {
    return override && override[field] != null ? override[field] : fallback;
  };

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Form 3-A - ${project.name}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 12px; }
        @page { size: A4; margin: 10mm; }
        html, body { width: 210mm; min-height: 297mm; }
      </style>
    </head>
    <body>
      <div class="bg-white space-y-4">
        <div class="text-center px-4">
          <h1 class="text-xl font-bold uppercase tracking-wider">Form No 3-A</h1>
          <p class="text-sm text-gray-500">Referred to in Rule No. 5 B S(ii)</p>
          <p class="text-sm font-semibold mt-1">Work-Wise Details of Work Completed or In Progress By The Contractor</p>
        </div>

        <div class="rounded-md border overflow-hidden mx-4">
          <table class="w-full text-sm border-collapse">
            <tbody class="divide-y">
              <tr>
                <td class="p-3 w-[40px] text-center font-semibold bg-gray-50 align-top border-r">1.</td>
                <td class="p-3 border-r w-[380px] font-semibold bg-gray-50 align-top">Name Of Contractor</td>
                <td class="p-3">${ov('company_name', companyName)}</td>
              </tr>
              <tr>
                <td class="p-3 w-[40px] text-center font-semibold bg-gray-50 align-top border-r">2.</td>
                <td class="p-3 border-r font-semibold bg-gray-50 align-top">Name Of The Work</td>
                <td class="p-3">${ov('name_of_work', project.name + (project.project_no ? ` (${project.project_no})` : ''))}</td>
              </tr>
              <tr>
                <td class="p-3 w-[40px] text-center font-semibold bg-gray-50 align-top border-r">3.</td>
                <td class="p-3 border-r font-semibold bg-gray-50 align-top">Estimate Cost Of Work Put To Tender</td>
                <td class="p-3">${ov('estimate_cost', `₹ ${formatCurrency(Number(project.project_estimation_cost) || 0)}`)}</td>
              </tr>
              <tr>
                <td class="p-3 w-[40px] text-center font-semibold bg-gray-50 align-top border-r">4.</td>
                <td class="p-3 border-r font-semibold bg-gray-50 align-top">Tender Amount</td>
                <td class="p-3">${ov('tender_amount', `₹ ${formatCurrency(Number(project.project_approved_amount) || 0)}`)}</td>
              </tr>
              <tr>
                <td class="p-3 w-[40px] text-center font-semibold bg-gray-50 align-top border-r">5.</td>
                <td class="p-3 border-r font-semibold bg-gray-50 align-top">Date Of Starting The Work</td>
                <td class="p-3">${ov('start_date', formatDate(startDate))}</td>
              </tr>
              <tr>
                <td class="p-3 w-[40px] text-center font-semibold bg-gray-50 align-top border-r">6.</td>
                <td class="p-3 border-r font-semibold bg-gray-50 align-top">Date Of Completion Of Work As Per Contract Agreement</td>
                <td class="p-3">${ov('completion_date', formatDate(project.project_end_date))}</td>
              </tr>
              <tr>
                <td class="p-3 w-[40px] text-center font-semibold bg-gray-50 align-top border-r">7.</td>
                <td class="p-3 border-r font-semibold bg-gray-50 align-top">Actual Work Completion Date</td>
                <td class="p-3">${ov('actual_completion_date', formatDate(project.work_completion_date))}</td>
              </tr>
              <tr>
                <td class="p-3 w-[40px] text-center font-semibold bg-gray-50 align-top border-r">8.</td>
                <td class="p-3 border-r font-semibold bg-gray-50 align-top">Amount Of Work Done Up To</td>
                <td class="p-3 pt-3">
                  <div class="space-y-2">
                    <div><span class="font-semibold">In Figure: </span>${ov('work_done_figure', `₹ ${formatCurrency(totalAmount)}`)}</div>
                    <div><span class="font-semibold">In Words: </span>${ov('work_done_words', amountInWords)}</div>
                  </div>
                  <div class="mt-40 text-end pr-5">
                    <div class="border-t border-black inline-block px-10 pt-1">
                      <div class="mt-1">Contractor Signature</div>
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td class="p-3 w-[40px] text-center font-semibold bg-gray-50 align-top border-r text-sm leading-relaxed">9.</td>
                <td class="p-3 border-r font-semibold bg-gray-50 align-top text-sm leading-relaxed">
                  State Whether the details as above, given by
                  the Contractor are Correct, In not state as to
                  what is the correct information
                </td>
                <td class="p-3 align-middle font-semibold">${ov('details_correct', 'YES')}</td>
              </tr>
              <tr>
                <td class="p-3 w-[40px] text-center font-semibold bg-gray-50 align-top border-r text-sm leading-relaxed">10.</td>
                <td class="p-3 border-r font-semibold bg-gray-50 align-top text-sm leading-relaxed">
                  State Whether the Contractor has Executed
                  the &quot;Work In Progress&quot; Satisfaction / Has
                  Completed the Work Satisfactory as per
                  Specification. If Not given the Correct,
                  Position of The Work.
                </td>
                <td class="p-3 align-middle font-semibold">${ov('work_status', workStatus)}</td>
              </tr>
              <tr>
                <td class="p-3 w-[40px] text-center font-semibold bg-gray-50 align-top border-r text-sm leading-relaxed">11.</td>
                <td class="p-3 border-r font-semibold bg-gray-50 align-top text-sm leading-relaxed">
                  Any Other Remarks
                </td>
                <td class="p-3 align-top">${ov('remarks', project.remarks || '-')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="mx-4 mb-4">
          <div class="text-sm">Date: </div>
        </div>
      </div>
    </body>
    </html>
  `;

  return puppeteerManager.generatePDF(html);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const project = await prisma.project.findFirst({
      where: { id },
      include: {
        company: {
          select: { company_name: true },
        },
        items: {
          select: { size: true, rate: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
    }

    const pdfBuffer = await generateForm3APDF(project);

    return new NextResponse(pdfBuffer as unknown as Blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="form-3a-${project.name.replace(/\s+/g, '-')}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Form 3-A PDF generation error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to generate PDF' },
      { status: 500 },
    );
  }
}
