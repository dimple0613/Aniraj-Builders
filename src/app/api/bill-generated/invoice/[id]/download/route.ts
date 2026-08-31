import { NextRequest, NextResponse } from 'next/server';
import { withCompany } from '@/lib/company-server';
import { errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { generateInvoicePDF, getInvoiceDataByEstimationId } from '@/lib/invoice-pdf-generator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Props {
    params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, { params }: Props) {
    try {
        const { id: estimationId } = await params;
        const { origin } = new URL(request.url);
        const result = await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const invoiceData = await getInvoiceDataByEstimationId(estimationId, company_id);
            const pdfBuffer = await generateInvoicePDF(invoiceData, origin);
            const filename = invoiceData.invoice_no
                ? `invoice-${invoiceData.invoice_no}.pdf`
                : `invoice-draft-${estimationId}.pdf`;

            return new NextResponse(pdfBuffer as unknown as Blob, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="${filename}"`,
                },
            });
        });

        if (result instanceof NextResponse) {
            return result;
        }

        return result;
    } catch (error) {
        console.error('PDF download error:', error);
        return NextResponse.json(
            errorResponse(error instanceof Error ? error.message : 'Failed to download PDF'),
            { status: 500 }
        );
    }
}
