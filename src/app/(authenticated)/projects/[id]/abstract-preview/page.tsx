import { getServerSession, authOptions } from "@/lib/auth";
import { AbstractPreview } from "@/components/projects/AbstractPreview";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Props {
  params: Promise<{
    id: string;
  }>;
}

async function buildMaterialNameMap(
  companyId: string,
): Promise<Map<string, string>> {
  const allMaterials = await prisma.material.findMany({
    where: { company_id: companyId },
    select: { id: true, name: true },
  });
  return new Map(allMaterials.map((m) => [m.name, m.id]));
}

async function buildMaterialIdToNameMap(
  companyId: string,
): Promise<Map<string, string>> {
  const allMaterials = await prisma.material.findMany({
    where: { company_id: companyId },
    select: { id: true, name: true },
  });
  return new Map(allMaterials.map((m) => [m.id, m.name]));
}

export default async function AbstractPreviewPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  const { id } = await params;

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
    return <div className="p-8 text-center">Project not found</div>;
  }

  // Get company for Material lookup
  const company = await prisma.company.findFirst({
    where: { users: { some: { id: (session?.user as any)?.id } } },
  });
  const companyId = company?.id || "";

  const purchaseEntries = await prisma.purchaseEntry.findMany({
    where: { project_id: id },
    orderBy: { entry_date: "asc" },
    select: {
      party: {
        select: { name: true },
      },
      materials: {
        select: { material_id: true, qty: true, rate: true },
      },
    },
  });

  const qtyMap = new Map<string, number>();
  const rateMap = new Map<string, number>();
  const peDetailsMap = new Map<string, Array<{ qty: number; rate: number }>>();
  const allPurchaseEntryItems: Array<{ partyName: string; itemName: string; rate: number }> = [];
  for (const entry of purchaseEntries) {
    for (const m of entry.materials) {
      qtyMap.set(m.material_id, (qtyMap.get(m.material_id) || 0) + Number(m.qty));
      rateMap.set(m.material_id, Number(m.rate));
      const existing = peDetailsMap.get(m.material_id) || [];
      existing.push({ qty: Number(m.qty), rate: Number(m.rate) });
      peDetailsMap.set(m.material_id, existing);
      allPurchaseEntryItems.push({
        partyName: entry.party.name,
        itemName: m.material_id,
        rate: Number(m.rate),
      });
    }
  }

  // Build Material name→ID map to resolve ID mismatches
  const materialByName = await buildMaterialNameMap(companyId);
  const materialIdToName = await buildMaterialIdToNameMap(companyId);

  function resolveId(capitalSorId: string, itemName: string | undefined): string {
    if (itemName) {
      const mid = materialByName.get(itemName);
      if (mid) return mid;
    }
    return capitalSorId;
  }

  // Resolve material IDs to names for the all purchase entries list
  const resolvedAllPurchaseEntries = allPurchaseEntryItems.map((e) => ({
    partyName: e.partyName,
    itemName: materialIdToName.get(e.itemName) || e.itemName,
    rate: e.rate,
  }));

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

  // Fetch all employee attendance records for the project
  const attendanceRecords = await prisma.attendance.findMany({
    where: { project_id: id },
    orderBy: { attendance_date: "asc" },
    select: {
      id: true,
      attendance_date: true,
      worker_name: true,
      wages: true,
    },
  });
  const attendanceEmployees = Array.from(
    new Set(attendanceRecords.map((r) => r.worker_name).filter(Boolean)),
  );
  const attendanceTotal = attendanceRecords.reduce(
    (sum, r) => sum + (Number(r.wages) || 0),
    0,
  );
  const attendanceDetails = attendanceRecords.map((r) => ({
    attendance_date: r.attendance_date.toISOString(),
    worker_name: r.worker_name,
    wages: Number(r.wages) || 0,
  }));

  // Ledgers flagged to include expenses activity
  const expenseLedgers = await prisma.ledger.findMany({
    where: { company_id: companyId, include_expenses_activity: true },
    select: { code: true },
  });
  const expenseLedgerCodes = expenseLedgers.map((l) => l.code);

  let expenseActivitiesTotal = 0;
  let hasExpenseActivities = false;
  let cashExpenseActivities: Array<{
    transaction_date: string;
    party_name: string | null;
    credit_amount: number;
    debit_amount: number;
    transaction_type: string;
  }> = [];
  let bankExpenseActivities: Array<{
    transaction_date: string;
    party_name: string | null;
    credit_amount: number;
    debit_amount: number;
    transaction_type: string;
  }> = [];
  if (expenseLedgerCodes.length > 0) {
    const whereCash = {
      company_id: companyId,
      project_id: id,
      ledger: { in: expenseLedgerCodes },
      is_deleted: false,
    } as const;
    const whereBank = {
      company_id: companyId,
      project_id: id,
      ledger: { in: expenseLedgerCodes },
      is_deleted: false,
    } as const;

    const [cashExpense, bankExpense] = await Promise.all([
      prisma.cashBookTransaction.aggregate({
        where: whereCash,
        _sum: { amount: true, debit_amount: true, credit_amount: true },
        _count: { _all: true },
      }),
      prisma.bankBookTransaction.aggregate({
        where: whereBank,
        _sum: { amount: true, debit_amount: true, credit_amount: true },
        _count: { _all: true },
      }),
    ]);

    const sum = (v: any) => Number(v || 0);
    const cashTotal = sum(cashExpense._sum.debit_amount || cashExpense._sum.amount);
    const bankTotal = sum(bankExpense._sum.debit_amount || bankExpense._sum.amount);
    expenseActivitiesTotal = Math.round((cashTotal + bankTotal) * 100) / 100;

    const cashCount = cashExpense._count?._all || 0;
    const bankCount = bankExpense._count?._all || 0;
    hasExpenseActivities = cashCount > 0 || bankCount > 0;

    if (hasExpenseActivities) {
      const [cashRows, bankRows] = await Promise.all([
        prisma.cashBookTransaction.findMany({
          where: whereCash,
          orderBy: { transaction_date: "asc" },
          select: {
            transaction_date: true,
            transaction_type: true,
            credit_amount: true,
            debit_amount: true,
            party: { select: { name: true } },
          },
        }),
        prisma.bankBookTransaction.findMany({
          where: whereBank,
          orderBy: { transaction_date: "asc" },
          select: {
            transaction_date: true,
            transaction_type: true,
            credit_amount: true,
            debit_amount: true,
            party: { select: { name: true } },
          },
        }),
      ]);

      cashExpenseActivities = cashRows.map((r) => ({
        transaction_date: r.transaction_date.toISOString(),
        party_name: r.party?.name ?? null,
        credit_amount: Number(r.credit_amount) || 0,
        debit_amount: Number(r.debit_amount) || 0,
        transaction_type: r.transaction_type,
      }));
      bankExpenseActivities = bankRows.map((r) => ({
        transaction_date: r.transaction_date.toISOString(),
        party_name: r.party?.name ?? null,
        credit_amount: Number(r.credit_amount) || 0,
        debit_amount: Number(r.debit_amount) || 0,
        transaction_type: r.transaction_type,
      }));
    }
  }

  const otherItemsData = allCapitalSOR.map((cs) => {
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

  const serialized = {
    id: project.id,
    name: project.name,
    project_no: project.project_no,
    project_estimation_cost: project.project_estimation_cost
      ? Number(project.project_estimation_cost)
      : 0,
    project_approved_amount: project.project_approved_amount
      ? Number(project.project_approved_amount)
      : 0,
    tender_premium_id: project.tender_premium_id,
    tender_premium_value: project.tender_premium_value,
    tender_premium_type: project.tender_premium_type,
    negotiation_price_id: project.negotiation_price_id,
    negotiation_price_value: project.negotiation_price_value,
    negotiation_type: project.negotiation_type,
    negotiationPrice: project.negotiationPrice
      ? { id: project.negotiationPrice.id, name: project.negotiationPrice.name }
      : null,
    total_amount: project.total_amount ? Number(project.total_amount) : 0,
    items: project.items.map((item) => {
      const mid = resolveId(item.capital_sor_id, item.capitalSOR?.item_name);
      return {
        id: item.id,
        capital_sor_id: item.capital_sor_id,
        size: item.size,
        rate: rateMap.get(mid) || 0,
        is_price_tracking: item.is_price_tracking,
        purchasedQty: qtyMap.get(mid) || 0,
        purchasedRate: rateMap.get(mid) || 0,
        add1_actual1: item.add1_actual1 ? Number(item.add1_actual1) : 0,
        add2_actual1: item.add2_actual1 ? Number(item.add2_actual1) : 0,
        capitalSOR: item.capitalSOR
          ? {
              id: item.capitalSOR.id,
              item_name: item.capitalSOR.item_name,
              uom: item.capitalSOR.uom,
            }
          : null,
      };
    }),
    otherItems: otherItemsData,
    parentOtherItemIds: Object.fromEntries(parentOtherItemIds),
    allPurchaseEntries: resolvedAllPurchaseEntries,
    attendanceEmployees,
    attendanceTotal,
    attendanceDetails,
    expenseActivitiesTotal,
    hasExpenseActivities,
    cashExpenseActivities,
    bankExpenseActivities,
  };

  return <AbstractPreview project={serialized} />;
}
