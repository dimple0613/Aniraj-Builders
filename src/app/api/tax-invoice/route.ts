import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entryId = searchParams.get('entry_id');

    return await withCompany(async (company) => {
      const companyId = company?.company_id!;

      if (!entryId) {
        return NextResponse.json(
          { success: false, message: 'Entry ID is required' },
          { status: 400 }
        );
      }

      const entry: any = await prisma.purchaseEntry.findFirst({
        where: {
          id: entryId,
          company_id: companyId,
        },
        include: {
          party: true,
          project: true,
          materials: {
            include: {
              capitalSOR: true,
            },
          },
        },
      });

      if (!entry) {
        return NextResponse.json(
          { success: false, message: 'Purchase entry not found' },
          { status: 404 }
        );
      }

      const companyDetails = await prisma.company.findFirst({
        where: { id: companyId },
      });

      const inclusivePrice = entry.materials.reduce((sum: number, m: any) => sum + m.total.toNumber(), 0);
      const gstRate = Number(entry.gst_percent) || 0;
      const roundTo2 = (n: number) => Math.round(n * 100) / 100;

      let grossTotal = inclusivePrice;
      let totalGst = 0;
      let cgst = 0;
      let sgst = 0;

      if (gstRate > 0) {
        grossTotal = roundTo2((100 / (100 + gstRate)) * inclusivePrice);
        totalGst = roundTo2(inclusivePrice - grossTotal);
        cgst = roundTo2(totalGst / 2);
        sgst = roundTo2(totalGst / 2);
      }

      return NextResponse.json({
        success: true,
        data: {
          invoice: {
            id: entry.id,
            sr_no: entry.sr_no,
            entry_date: entry.entry_date,
            voucher_type: entry.voucher_type,
          },
          company: companyDetails ? {
            name: companyDetails.company_name,
            address: companyDetails.address,
            gstin: companyDetails.gstin_uin,
            state: companyDetails.state_name,
          } : null,
          party: {
            name: entry.party?.name || '',
            address: entry.party?.address || '',
            gstin: entry.party?.gst_no || '',
          },
          project: entry.project ? {
            name: entry.project.name,
          } : null,
          items: entry.materials.map((m: any) => ({
            name: m.capitalSOR?.name || m.capitalSOR?.item_name || '',
            qty: m.qty,
            rate: m.rate.toNumber(),
            total: m.total.toNumber(),
          })),
          subtotal: inclusivePrice,
          gst_percent: gstRate,
          gross_total: grossTotal,
          cgst,
          sgst,
          total_gst: totalGst,
          grand_total: inclusivePrice,
          instrument_no: entry.instrument_no,
          remark: entry.remark,
        },
      });
    });
  } catch (error) {
    console.error('Error fetching tax invoice:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to fetch tax invoice' },
      { status: 500 }
    );
  }
}
