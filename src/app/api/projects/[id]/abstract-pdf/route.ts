import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, authOptions } from '@/lib/auth';
import { puppeteerManager } from '@/lib/puppeteer-server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function formatCurrency(n: number): string {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getPremiumLabel(
  prefix: string,
  operation: string | null | undefined,
  value: string | null | undefined,
  type: string | null | undefined,
): string | null {
  if (!value) return null;
  if (operation === '0' || operation === '') return `${prefix} (EQUAL) 0%`;
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) return null;
  const suffix = type?.toLowerCase() === 'percentage' ? '%' : '';
  if (operation === '-') return `${prefix} (BELOW -${num}${suffix})`;
  if (operation === '+') return `${prefix} (ABOVE +${num}${suffix})`;
  return null;
}

function calcPremiumAmount(
  operation: string | null | undefined,
  rawValue: string | null | undefined,
  type: string | null | undefined,
  total: number,
): number {
  if (!operation || operation === '0' || !rawValue) return 0;
  const num = parseFloat(rawValue);
  if (isNaN(num) || num <= 0) return 0;
  let effectiveValue = num;
  if (type?.toLowerCase() === 'percentage') {
    effectiveValue = (total * num) / 100;
  }
  return operation === '-' ? -effectiveValue : effectiveValue;
}

const cellClass = 'border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*="size-"])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 text-xs';

const itemNameCellClass = 'border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 rounded-lg py-2 pr-2 pl-2.5 transition-colors outline-none w-full border-0 bg-transparent shadow-none focus-visible:ring-1 text-xs';

async function generateAbstractPDF(project: any): Promise<Buffer> {
  const items = project.items || [];
  const otherItems = project.otherItems || [];
  const parentOtherItemIds = project.parentOtherItemIds || {};

  const itemRows: Array<{
    srNo: number | string;
    qty: number;
    itemName: string;
    rate: number;
    uom: string;
    amount: number;
    isSubItem?: boolean;
  }> = [];

  const otherItemToParent = new Map<string, string>();
  const otherItemIdSet = new Set(otherItems.map((oi: any) => oi.id));

  for (const otherId of otherItemIdSet) {
    const parentSorIds = Object.entries(parentOtherItemIds)
      .filter(([, oIds]: [string, any]) => (oIds as string[]).includes(otherId))
      .map(([sorId]) => sorId);

    if (parentSorIds.length === 0) continue;

    const nonTrackingParents = parentSorIds.filter((sorId) => {
      const pItem = items.find((i: any) => i.capital_sor_id === sorId);
      return pItem && !pItem.is_price_tracking;
    });

    const chosenParent = nonTrackingParents.length > 0 ? nonTrackingParents[0] : parentSorIds[0];
    otherItemToParent.set(otherId, chosenParent);
  }

  const displayedOtherItems = new Set<string>();

  items.forEach((item: any, index: number) => {
    const linkedIds: string[] = parentOtherItemIds[item.capital_sor_id] || [];
    const subItemsData: Array<{
      qty: number;
      itemName: string;
      rate: number;
      uom: string;
      amount: number;
    }> = [];

    // Collect displayed sub-items first
    for (const oiId of linkedIds) {
      if (displayedOtherItems.has(oiId)) continue;
      if (otherItemToParent.get(oiId) !== item.capital_sor_id) continue;

      displayedOtherItems.add(oiId);
      const otherItem = otherItems.find((oi: any) => oi.id === oiId);
      if (otherItem && (otherItem.purchasedQty || 0) > 0) {
        const oQty = otherItem.purchasedQty || 0;
        const oRate = otherItem.purchasedRate || 0;
        const oAmount = otherItem.totalAmount ?? (oQty * oRate);
        subItemsData.push({
          qty: oQty,
          itemName: `↳ ${otherItem.item_name}`,
          rate: oRate,
          uom: otherItem.uom || '-',
          amount: oAmount,
        });
      }
    }

    // Push parent row with aggregated or original values
    const hasSubItems = subItemsData.length > 0;
    const parentOwnQty = item.purchasedQty || 0;
    const parentOwnRate = item.purchasedRate || Number(item.rate) || 0;
    const parentOwnAmount = parentOwnQty * parentOwnRate;
    const parentQty = hasSubItems
      ? parentOwnQty + subItemsData.reduce((s: number, si: any) => s + si.qty, 0)
      : parentOwnQty;
    const parentRate = hasSubItems
      ? parentOwnRate + subItemsData.reduce((s: number, si: any) => s + si.rate, 0)
      : parentOwnRate;
    const parentAmount = hasSubItems
      ? parentOwnAmount + subItemsData.reduce((s: number, si: any) => s + si.amount, 0)
      : parentOwnAmount;

    itemRows.push({
      srNo: index + 1,
      qty: parentQty,
      itemName: item.capitalSOR?.item_name || '-',
      rate: parentRate,
      uom: item.capitalSOR?.uom || '-',
      amount: parentAmount,
    });

    // Push child rows directly below their parent (name only, no price)
    for (const si of subItemsData) {
      itemRows.push({
        srNo: '',
        qty: 0,
        itemName: si.itemName,
        rate: 0,
        uom: '',
        amount: 0,
        isSubItem: true,
      });
    }
  });

  const unlinkedOtherItems = otherItems.filter(
    (oi: any) => (oi.purchasedQty || 0) > 0 && !displayedOtherItems.has(oi.id)
  );
  for (const oi of unlinkedOtherItems) {
    const oQty = oi.purchasedQty || 0;
    const oRate = oi.purchasedRate || 0;
    const oAmount = oi.totalAmount ?? (oQty * oRate);
    itemRows.push({
      srNo: itemRows.filter((r: any) => !r.isSubItem).length + 1,
      qty: oQty,
      itemName: oi.item_name,
      rate: oRate,
      uom: oi.uom || '-',
      amount: oAmount,
    });
  }

  const totalAmount = itemRows.filter((r: any) => !r.isSubItem).reduce((sum: number, row: any) => sum + row.amount, 0);

  const baseAmount = Number(project.project_estimation_cost) || 0;

  const npName = project.negotiationPrice?.name;
  const npValue = project.negotiation_price_value;
  let hasNegotiationPrice = false;
  if (npValue && npName) {
    if (npName === '0') {
      hasNegotiationPrice = true;
    } else {
      hasNegotiationPrice = npValue !== '0';
    }
  }

  const tpEffect = calcPremiumAmount(
    project.tender_premium_id,
    project.tender_premium_value,
    project.tender_premium_type,
    baseAmount,
  );

  const npEffect = calcPremiumAmount(
    project.negotiation_price_id,
    project.negotiation_price_value,
    project.negotiation_type,
    baseAmount,
  );

  const tenderPremiumAmount = hasNegotiationPrice ? npEffect : tpEffect;
  const netAmount = Math.round(totalAmount + tenderPremiumAmount);

  const premiumLabel = hasNegotiationPrice
    ? getPremiumLabel('TENDER PREMIUM', project.negotiationPrice?.name, project.negotiation_price_value, project.negotiation_type)
    : getPremiumLabel('TENDER PREMIUM', project.tender_premium_id, project.tender_premium_value, project.tender_premium_type);

  const itemsHtml = itemRows.map((row: any) => `
    <tr class="${row.isSubItem ? 'bg-slate-50/50' : 'hover:bg-blue-50 transition-colors'}">
      <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground">
        <span class="${cellClass}">${row.isSubItem ? '' : row.srNo}</span>
      </td>
      <td class="p-1 border-r">
        <span class="${cellClass}${row.isSubItem ? ' text-muted-foreground text-xs' : ''}">${row.isSubItem ? '' : row.qty.toFixed(2)}</span>
      </td>
      <td class="p-1 border-r">
        <span class="${itemNameCellClass}${row.isSubItem ? ' pl-6 text-muted-foreground text-xs' : ''}" style="white-space: normal; word-break: break-word; overflow-wrap: break-word; display: block; min-height: 2rem;">${row.itemName}</span>
      </td>
      <td class="p-1 border-r text-right">
        <span class="${cellClass} justify-start${row.isSubItem ? ' text-muted-foreground text-xs' : ''}">${row.isSubItem ? '' : formatCurrency(row.rate)}</span>
      </td>
      <td class="p-1 border-r text-right">
        <span class="${cellClass} justify-start${row.isSubItem ? ' text-muted-foreground text-xs' : ''}">${row.isSubItem ? '' : row.uom}</span>
      </td>
      <td class="p-1 text-right" style="text-align: right !important;">
        <span class="${cellClass}${row.isSubItem ? ' text-muted-foreground text-xs' : ''}" style="justify-content: flex-end; text-align: right;">${row.isSubItem ? '' : '₹ ' + formatCurrency(row.amount)}</span>
      </td>
    </tr>
  `).join('');

  const premiumRowHtml = premiumLabel
    ? `<tr class="font-bold">
        <td colspan="5" class="p-2 py-1 text-end text-md border-r">
          <span class="${cellClass} justify-end text-md">${premiumLabel} :</span>
        </td>
        <td class="p-1 py-2 text-end text-md tabular-nums font-mono">
          <span class="${cellClass} text-md" style="justify-content: flex-end; text-align: right;">
            ${tenderPremiumAmount >= 0 ? '+ ' : '- '}₹ ${formatCurrency(Math.abs(tenderPremiumAmount))}
          </span>
        </td>
      </tr>`
    : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>ABSTRACT - ${project.name}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 14px; }
        @page { size: A4; margin: 10mm; }
        @media print {
          body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          table td:last-child { text-align: right !important; }
        }
      </style>
    </head>
    <body>
      <div class="bg-white space-y-4">
        <div class="flex items-center justify-center relative px-4 md:px-6">
          <h1 class="text-xl font-bold uppercase tracking-wider">ABSTRACT</h1>
        </div>

        <div class="rounded-md border overflow-hidden mx-4 md:mx-6">
          <table class="w-full text-sm border-collapse">
            <thead class="bg-slate-100">
              <tr class="text-[11px] uppercase tracking-wider text-slate-700 border-b-2 border-slate-300 text-left">
                <th class="p-3 border-r font-bold border-slate-300 p-2">નં</th>
                <th class="p-3 border-r font-bold border-slate-300 p-2">માપ</th>
                <th class="p-3 border-r font-bold border-slate-300 p-2">આઇટમ</th>
                <th class="p-3 border-r font-bold border-slate-300 p-2">ભાવ</th>
                <th class="p-3 border-r font-bold border-slate-300 p-2">દર</th>
                <th class="p-3 font-bold border-slate-300 p-2 text-right">આકાર</th>
              </tr>
            </thead>
            <tbody class="divide-y">
              ${itemsHtml}
            </tbody>
            <tfoot class="divide-y">
              <tr class="font-bold border-t-2">
                <td colspan="5" class="p-2 py-1 text-end text-md border-r">
                  <span class="${cellClass} justify-end text-md">TOTAL :</span>
                </td>
                <td class="p-1 py-2 text-end text-md tabular-nums font-mono">
                  <span class="${cellClass} text-md" style="justify-content: flex-end; text-align: right;">₹ ${formatCurrency(totalAmount)}</span>
                </td>
              </tr>
              ${premiumRowHtml}
              <tr class="font-bold border-t-2 bg-slate-50">
                <td colspan="5" class="p-2 py-1 text-end text-md border-r">
                  <span class="${cellClass} justify-end text-md">NET :</span>
                </td>
                <td class="p-1 py-2 text-end text-md tabular-nums font-mono">
                  <span class="${cellClass} text-md" style="justify-content: flex-end; text-align: right;">₹ ${formatCurrency(netAmount)}</span>
                </td>
              </tr>
              <tr class="font-bold">
                <td colspan="5" class="p-1 text-end text-md border-r">
                  <span class="${cellClass} justify-end text-md">SAY :</span>
                </td>
                <td class="p-1 py-2 text-end text-md tabular-nums font-mono">
                  <span class="${cellClass} text-md" style="justify-content: flex-end; text-align: right;">₹ ${formatCurrency(Math.round(netAmount))}</span>
                </td>
              </tr>
            </tfoot>
          </table>
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

    const session = await getServerSession(authOptions);

    const project = await prisma.project.findFirst({
      where: { id },
      include: {
        items: {
          include: {
            capitalSOR: {
              select: {
                id: true,
                item_name: true,
                uom: true,
                other_item_ids: true,
              },
            },
          },
        },
        negotiationPrice: {
          select: { id: true, name: true },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ success: false, message: 'Project not found' }, { status: 404 });
    }

    const purchaseEntries = await prisma.purchaseEntry.findMany({
      where: { project_id: id },
      orderBy: { entry_date: 'asc' },
      select: {
        materials: {
          select: { material_id: true, qty: true, rate: true },
        },
      },
    });
    const qtyMap = new Map<string, number>();
    const rateMap = new Map<string, number>();
    const peDetailsMap = new Map<string, Array<{ qty: number; rate: number }>>();
    for (const entry of purchaseEntries) {
      for (const m of entry.materials) {
        qtyMap.set(m.material_id, (qtyMap.get(m.material_id) || 0) + Number(m.qty));
        rateMap.set(m.material_id, Number(m.rate));
        const existing = peDetailsMap.get(m.material_id) || [];
        existing.push({ qty: Number(m.qty), rate: Number(m.rate) });
        peDetailsMap.set(m.material_id, existing);
      }
    }

    // Build Material name→ID map to resolve ID mismatches
    const company = await prisma.company.findFirst({
      where: { users: { some: { id: (session?.user as any)?.id } } },
    });
    const companyId = company?.id || '';
    const allMaterials = await prisma.material.findMany({
      where: { company_id: companyId },
      select: { id: true, name: true },
    });
    const materialByName = new Map(allMaterials.map((m: { id: string; name: string }) => [m.name, m.id]));

    function resolveId(capitalSorId: string, itemName: string | undefined): string {
      if (itemName) {
        const mid = materialByName.get(itemName);
        if (mid) return mid;
      }
      return capitalSorId;
    }

    // Fetch all Other Items (SOR="OTHER ITEM", Department="PURCHASE")
    const allCapitalSOR = await prisma.capitalSOR.findMany({
      where: {
        itemMaster: {
          sor: { name: "OTHER ITEM" },
          department: { name: "PURCHASE" },
        },
      },
      select: { id: true, item_name: true, uom: true, other_item_ids: true },
    });

    const otherItemsData = allCapitalSOR.map((cs: any) => {
      const mid = resolveId(cs.id, cs.item_name);
      const peDetails = peDetailsMap.get(mid) || [];
      return {
        id: cs.id,
        capital_sor_id: cs.id,
        item_name: cs.item_name,
        uom: cs.uom,
        other_item_ids: cs.other_item_ids || null,
        purchasedQty: peDetails.reduce((sum, pe) => sum + pe.qty, 0),
        purchasedRate: peDetails.reduce((sum, pe) => sum + pe.rate, 0),
        totalAmount: peDetails.reduce((sum, pe) => sum + pe.qty * pe.rate, 0),
      };
    });

    // Build a lookup of parent capital_sor_id → other item IDs
    const parentOtherItemIds = new Map<string, string[]>();
    for (const item of project.items) {
      if (item.capitalSOR?.other_item_ids) {
        const ids = item.capitalSOR.other_item_ids.split(",").filter(Boolean);
        parentOtherItemIds.set(item.capital_sor_id, ids);
      }
    }

    const projectWithQtys = {
      ...project,
      items: project.items.map((item) => {
        const mid = resolveId(item.capital_sor_id, item.capitalSOR?.item_name);
        return {
          ...item,
          purchasedQty: qtyMap.get(mid) || 0,
          purchasedRate: rateMap.get(mid) || 0,
        };
      }),
      otherItems: otherItemsData,
      parentOtherItemIds: Object.fromEntries(parentOtherItemIds),
    };

    const pdfBuffer = await generateAbstractPDF(projectWithQtys);

    return new NextResponse(pdfBuffer as unknown as Blob, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="abstract-${project.name.replace(/\s+/g, '-')}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Billing PDF generation error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to generate PDF' },
      { status: 500 },
    );
  }
}
