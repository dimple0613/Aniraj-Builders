"use client";

import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, Eye, Plus } from "lucide-react";
import { formatIndianCurrency } from "@/lib/tax-utils";
import axios from "axios";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface CapitalSOR {
  id: string;
  item_name: string;
  uom: string;
}

interface AbstractItem {
  id: string;
  capital_sor_id: string;
  size: string;
  rate: number;
  is_price_tracking: boolean;
  purchasedQty: number;
  purchasedRate?: number;
  capitalSOR: CapitalSOR | null;
  add1_actual1?: number;
  add2_actual1?: number;
}

interface OtherItemData {
  id: string;
  capital_sor_id: string;
  item_name: string;
  uom: string;
  other_item_ids: string | null;
  purchasedQty: number;
  purchasedRate?: number;
  totalAmount?: number;
}

interface NegotiationPrice {
  id: string;
  name: string;
}

interface MultiPartyDetail {
  partyName: string;
  itemName: string;
  rate: number;
}

interface AttendanceDetail {
  attendance_date: string;
  worker_name: string;
  wages: number;
}

interface ProjectData {
  id: string;
  name: string;
  project_no: string | null;
  project_estimation_cost: number;
  project_approved_amount: number;
  tender_premium_id: string | null;
  tender_premium_value: string | null;
  tender_premium_type: string | null;
  negotiation_price_id: string | null;
  negotiation_price_value: string | null;
  negotiation_type: string | null;
  negotiationPrice: NegotiationPrice | null;
  total_amount: number;
  items: AbstractItem[];
  otherItems: OtherItemData[];
  parentOtherItemIds: Record<string, string[]>;
  allPurchaseEntries: MultiPartyDetail[];
  attendanceEmployees: string[];
  attendanceTotal: number;
  attendanceDetails: AttendanceDetail[];
  expenseActivitiesTotal: number;
  hasExpenseActivities: boolean;
  cashExpenseActivities: Array<{
    transaction_date: string;
    party_name: string | null;
    credit_amount: number;
    debit_amount: number;
    transaction_type: string;
  }>;
  bankExpenseActivities: Array<{
    transaction_date: string;
    party_name: string | null;
    credit_amount: number;
    debit_amount: number;
    transaction_type: string;
  }>;
}

interface Props {
  project: ProjectData;
}

function getPremiumLabel(
  prefix: string,
  operation: string | null | undefined,
  value: string | null | undefined,
  type: string | null | undefined,
): string | null {
  if (!value) return null;
  if (operation === "0" || operation === "") return `${prefix} (EQUAL) 0%`;
  const num = parseFloat(value);
  if (isNaN(num) || num <= 0) return null;
  const suffix = type?.toLowerCase() === "percentage" ? "%" : "";
  if (operation === "-") return `${prefix} (BELOW -${num}${suffix})`;
  if (operation === "+") return `${prefix} (ABOVE +${num}${suffix})`;
  return null;
}

function calcPremiumAmount(
  operation: string | null | undefined,
  rawValue: string | null | undefined,
  type: string | null | undefined,
  total: number,
): number {
  if (!operation || operation === "0" || !rawValue) return 0;
  const num = parseFloat(rawValue);
  if (isNaN(num) || num <= 0) return 0;
  let effectiveValue = num;
  if (type?.toLowerCase() === "percentage") {
    effectiveValue = (total * num) / 100;
  }
  return operation === "-" ? -effectiveValue : effectiveValue;
}

const cellClass = "border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs";

export function AbstractPreview({ project }: Props) {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [rowClicks, setRowClicks] = useState<Record<number, number>>({});
  const [add1Actual1, setAdd1Actual1] = useState<Record<number, string>>({});
  const [add2Actual1, setAdd2Actual1] = useState<Record<number, string>>({});
  const [multiPartyPopup, setMultiPartyPopup] = useState<{ itemName: string; details: MultiPartyDetail[] } | null>(null);
  const [attendancePopupOpen, setAttendancePopupOpen] = useState(false);
  const [expensePopupOpen, setExpensePopupOpen] = useState(false);
  const items = project.items || [];

  const maxSections = useMemo(() => {
    const vals = Object.values(rowClicks);
    return vals.length === 0 ? 0 : Math.min(2, Math.max(...vals));
  }, [rowClicks]);

  const subItemNameByCapitalSorId = useMemo(() => {
    const map = new Map<string, string>();
    for (const oi of project.otherItems) {
      map.set(oi.capital_sor_id, oi.item_name);
    }
    return map;
  }, [project.otherItems]);

  const attendanceGrouped = useMemo(() => {
    const map = new Map<string, AttendanceDetail[]>();
    for (const detail of project.attendanceDetails) {
      const date = new Date(detail.attendance_date).toLocaleDateString();
      const list = map.get(date) || [];
      list.push(detail);
      map.set(date, list);
    }
    return Array.from(map.entries()).map(([date, details]) => ({
      date,
      details,
      employeeCount: details.length,
      totalSalary: details.reduce((sum, d) => sum + (d.wages || 0), 0),
    }));
  }, [project.attendanceDetails]);

  const handlePrint = async () => {
    try {
      setDownloading("pdf");
      const response = await axios.get(`/api/projects/${project.id}/abstract-pdf`, {
        responseType: "arraybuffer",
      });
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const printWindow = window.open(url, "_blank");
      if (printWindow) {
        printWindow.onload = () => {
          printWindow.focus();
          setTimeout(() => printWindow.print(), 500);
        };
      }
    } catch {
      // fallback
    } finally {
      setDownloading(null);
    }
  };

  const itemRows = useMemo(() => {
    const rows: Array<{
      srNo: number | string;
      qty: number;
      itemName: string;
      rate: number;
      uom: string;
      amount: number;
      hasSubItems?: boolean;
      capitalSorId?: string;
      itemId?: string;
    }> = [];

    const otherItemToParent = new Map<string, string>();
    const otherItemIdSet = new Set(project.otherItems.map((oi) => oi.id));

    for (const otherId of otherItemIdSet) {
      const parentSorIds = Object.entries(project.parentOtherItemIds)
        .filter(([, oIds]) => oIds.includes(otherId))
        .map(([sorId]) => sorId);

      if (parentSorIds.length === 0) continue;

      const nonTrackingParents = parentSorIds.filter((sorId) => {
        const pItem = items.find((i) => i.capital_sor_id === sorId);
        return pItem && !pItem.is_price_tracking;
      });

      const chosenParent = nonTrackingParents.length > 0 ? nonTrackingParents[0] : parentSorIds[0];
      otherItemToParent.set(otherId, chosenParent);
    }

    const linkedOtherItemIds = new Set<string>();

    items.forEach((item, index) => {
      const linkedIds = project.parentOtherItemIds[item.capital_sor_id];
      const subItemsData: Array<{
        qty: number;
        itemName: string;
        rate: number;
        uom: string;
        amount: number;
      }> = [];

      if (linkedIds && linkedIds.length > 0) {
        for (const oiId of linkedIds) {
          if (otherItemToParent.get(oiId) !== item.capital_sor_id) continue;

          const otherItem = project.otherItems.find((oi) => oi.id === oiId);
          if (otherItem && (otherItem.purchasedQty || 0) > 0) {
            linkedOtherItemIds.add(oiId);
            const oQty = otherItem.purchasedQty || 0;
            const oRate = otherItem.purchasedRate || 0;
            const oAmount = otherItem.totalAmount ?? (oQty * oRate);
            subItemsData.push({
              qty: oQty,
              itemName: `↳ ${otherItem.item_name}`,
              rate: oRate,
              uom: otherItem.uom || "-",
              amount: oAmount,
            });
          }
        }
      }

      const hasSubItems = subItemsData.length > 0;
      const parentOwnQty = item.purchasedQty || 0;
      const parentOwnRate = item.purchasedRate || item.rate || 0;
      const parentOwnAmount = parentOwnQty * parentOwnRate;
      const parentQty = hasSubItems
        ? parentOwnQty + subItemsData.reduce((s, si) => s + si.qty, 0)
        : parentOwnQty;
      const parentRate = hasSubItems
        ? parentOwnRate + subItemsData.reduce((s, si) => s + si.rate, 0)
        : parentOwnRate;
      const parentAmount = hasSubItems
        ? parentOwnAmount + subItemsData.reduce((s, si) => s + si.amount, 0)
        : parentOwnAmount;

      rows.push({
        srNo: index + 1,
        qty: parentQty,
        itemName: item.capitalSOR?.item_name || "-",
        rate: parentRate,
        uom: item.capitalSOR?.uom || "-",
        amount: parentAmount,
        hasSubItems: subItemsData.length > 0,
        capitalSorId: item.capital_sor_id,
        itemId: item.id,
      });
    });

    const unlinkedOtherItems = project.otherItems.filter(
      (oi) => (oi.purchasedQty || 0) > 0 && !linkedOtherItemIds.has(oi.id)
    );
    for (const oi of unlinkedOtherItems) {
      const oQty = oi.purchasedQty || 0;
      const oRate = oi.purchasedRate || 0;
      const oAmount = oi.totalAmount ?? (oQty * oRate);
      rows.push({
        srNo: rows.length + 1,
        qty: oQty,
        itemName: oi.item_name,
        rate: oRate,
        uom: oi.uom || "-",
        amount: oAmount,
      });
    }

    return rows;
  }, [items, project.otherItems, project.parentOtherItemIds]);

  useEffect(() => {
    const init1: Record<number, string> = {};
    const init2: Record<number, string> = {};
    const initClicks: Record<number, number> = {};
    project.items.forEach((item, i) => {
      const a1 = Number(item.add1_actual1);
      const a2 = Number(item.add2_actual1);
      if (a1) {
        init1[i] = String(a1);
        initClicks[i] = Math.max(initClicks[i] || 0, 1);
      }
      if (a2) {
        init2[i] = String(a2);
        initClicks[i] = Math.max(initClicks[i] || 0, 2);
      }
    });
    setAdd1Actual1(prev => (Object.keys(prev).length ? prev : init1));
    setAdd2Actual1(prev => (Object.keys(prev).length ? prev : init2));
    setRowClicks(prev => (Object.keys(prev).length ? prev : initClicks));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.items]);

  const saveActual1 = async (row: { itemId?: string; capitalSorId?: string }, section: 1 | 2, value: string) => {
    const numVal = parseFloat(value);
    const actual1 = isNaN(numVal) ? 0 : numVal;
    try {
      await axios.post(`/api/projects/${project.id}/abstract-comparison`, {
        itemId: row.itemId,
        capitalSorId: row.capitalSorId,
        section,
        actual1,
      });
    } catch {
      // silent - keep value in local state regardless
    }
  };

  const totalAmount = useMemo(() => {
    return itemRows.reduce((sum, row) => sum + row.amount, 0);
  }, [itemRows]);

  const hasNegotiationPrice = useMemo(() => {
    const npName = project.negotiationPrice?.name;
    const npValue = project.negotiation_price_value;
    if (!npValue || !npName) return false;
    if (npName === "0") return true;
    return npValue !== "0";
  }, [project.negotiationPrice, project.negotiation_price_value]);

  const baseAmount = project.project_estimation_cost || 0;

  const tpEffect = useMemo(() => {
    return calcPremiumAmount(
      project.tender_premium_id,
      project.tender_premium_value,
      project.tender_premium_type,
      baseAmount,
    );
  }, [project.tender_premium_id, project.tender_premium_value, project.tender_premium_type, baseAmount]);

  const npEffect = useMemo(() => {
    return calcPremiumAmount(
      project.negotiation_price_id,
      project.negotiation_price_value,
      project.negotiation_type,
      baseAmount,
    );
  }, [project.negotiation_price_id, project.negotiation_price_value, project.negotiation_type, baseAmount]);

  const tenderPremiumAmount = useMemo(() => {
    return hasNegotiationPrice ? npEffect : tpEffect;
  }, [hasNegotiationPrice, npEffect, tpEffect]);

  const netAmount = Math.round(totalAmount + tenderPremiumAmount);

  const premiumLabel = useMemo(() => {
    const data = hasNegotiationPrice
      ? { name: project.negotiationPrice?.name, value: project.negotiation_price_value, type: project.negotiation_type }
      : { name: project.tender_premium_id, value: project.tender_premium_value, type: project.tender_premium_type };
    return getPremiumLabel("TENDER PREMIUM", data.name, data.value, data.type);
  }, [hasNegotiationPrice, project.negotiationPrice?.name, project.negotiation_price_value, project.negotiation_type, project.tender_premium_id, project.tender_premium_value, project.tender_premium_type]);

  return (
    <div className="flex flex-col gap-4  pt-4 print:p-0">
      <div className="bg-white flex flex-col gap-4 md:gap-6 ">
        <div className="flex items-center justify-center relative px-4 md:px-6">
          <h1 className="text-xl font-bold uppercase tracking-wider">ABSTRACT</h1>
          <div className="absolute right-4 md:right-6 print:hidden">
            <Button onClick={handlePrint} disabled={downloading !== null} variant="outline" size="sm" className="gap-1.5">
              {downloading === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Print
            </Button>
          </div>
        </div>

        <div className="rounded-md border overflow-hidden mx-4 md:mx-6 mb-4 md:mb-6">
          <div className="overflow-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-100">
                <tr className="text-[11px] uppercase tracking-wider text-slate-700 border-b-2 border-slate-300 text-left">
                  <th className="p-3 border-r font-bold border-slate-300 p-2">નં</th>
                  <th className="p-3 border-r font-bold border-slate-300 p-2">માપ</th>
                  <th className="p-3 border-r font-bold border-slate-300 p-2">આઇટમ</th>
                  <th className="p-3 border-r font-bold border-slate-300 p-2">ભાવ</th>
                  <th className="p-3 border-r font-bold border-slate-300 p-2">દર</th>
                  <th className="p-3 font-bold border-slate-300 p-2 text-right">આકાર</th>
                  <th className="p-2 font-bold border-l border-slate-300 text-center">Action</th>
                  {maxSections >= 1 && (
                    <th colSpan={3} className="p-2 font-bold border-l border-slate-300 text-center">
                      Add 1
                    </th>
                  )}
                  {maxSections >= 2 && (
                    <th colSpan={3} className="p-2 font-bold border-l border-slate-300 text-center">
                      Add 2
                    </th>
                  )}
                </tr>
                {maxSections >= 1 && (
                  <tr className="text-[11px] uppercase tracking-wider text-slate-700 border-b border-slate-300 text-left">
                    <th className="p-2 border-r border-slate-300" />
                    <th className="p-2 border-r border-slate-300" />
                    <th className="p-2 border-r border-slate-300" />
                    <th className="p-2 border-r border-slate-300" />
                    <th className="p-2 border-r border-slate-300" />
                    <th className="p-2 border-r border-slate-300" />
                    <th className="p-2 border-r border-slate-300" />
                    <th className="p-2 font-semibold border-r border-slate-300 text-center min-w-[90px]">Actual 1</th>
                    <th className="p-2 font-semibold border-r border-slate-300 text-center min-w-[90px]">Actual 2</th>
                    <th className="p-2 font-semibold border-r border-slate-300 text-center min-w-[90px]">Difference 1</th>
                    {maxSections >= 2 && (
                      <>
                        <th className="p-2 font-semibold border-r border-slate-300 text-center min-w-[90px]">Actual 1</th>
                        <th className="p-2 font-semibold border-r border-slate-300 text-center min-w-[90px]">Actual 2</th>
                        <th className="p-2 font-semibold text-center min-w-[90px]">Difference 2</th>
                      </>
                    )}
                  </tr>
                )}
              </thead>
              <tbody className="divide-y">
                {itemRows.length === 0 ? (
                  <tr>
                    <td colSpan={6 + 1 + (maxSections >= 1 ? 3 : 0) + (maxSections >= 2 ? 3 : 0)} className="p-4 text-center text-muted-foreground">
                      No items found
                    </td>
                  </tr>
                ) : (
                  itemRows.map((row, i) => (
                    <tr key={i} className="hover:bg-blue-50 transition-colors">
                      <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground">
                        <span className={cellClass}>{row.srNo}</span>
                      </td>
                      <td className="p-1 border-r">
                        <span className={cellClass}>{row.qty.toFixed(2)}</span>
                      </td>
                      <td className="p-1 border-r">
                        <span className={`${cellClass} whitespace-normal`}>
                          {row.itemName}
                          {row.hasSubItems && (
                            <button
                              type="button"
                              onClick={() => {
                                const subItemIds = project.parentOtherItemIds[row.capitalSorId!] || [];
                                const subItemNames = new Set(
                                  subItemIds.map(id => subItemNameByCapitalSorId.get(id)).filter(Boolean)
                                );
                                setMultiPartyPopup({
                                  itemName: row.itemName,
                                  details: project.allPurchaseEntries.filter(e => subItemNames.has(e.itemName)),
                                });
                              }}
                              className="ml-1.5 inline-flex items-center justify-center h-5 w-5 rounded-md hover:bg-blue-100 text-blue-600 transition-colors cursor-pointer align-middle"
                              title="View purchase entries"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </span>
                      </td>
                      <td className="p-1 border-r text-right">
                        <span className={`${cellClass} justify-start`}>{formatIndianCurrency(row.rate)}</span>
                      </td>
                      <td className="p-1 border-r text-right">
                        <span className={`${cellClass} justify-start`}>{row.uom}</span>
                      </td>
                      <td className="p-1 text-right">
                        <span className={cellClass} style={{ justifyContent: "flex-end", textAlign: "right" }}>{`₹ ${formatIndianCurrency(row.amount)}`}</span>
                      </td>
                      <td className="p-1 border-l border-r text-center">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-6 w-6"
                          disabled={(rowClicks[i] || 0) >= 2}
                          onClick={() => setRowClicks(prev => ({ ...prev, [i]: (prev[i] || 0) + 1 }))}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                      {maxSections >= 1 && (
                        <>
                          <td className="p-1 border-r text-center min-w-[90px]">
                            {rowClicks[i] >= 1 && (
                              <input
                                type="number"
                                value={add1Actual1[i] ?? ""}
                                onChange={e => setAdd1Actual1(prev => ({ ...prev, [i]: e.target.value }))}
                                onBlur={() => saveActual1(row, 1, add1Actual1[i] ?? "")}
                                className="w-full h-7 px-2 text-xs text-right border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                                placeholder="0"
                              />
                            )}
                          </td>
                          <td className="p-1 border-r text-center min-w-[90px]">
                            {rowClicks[i] >= 1 && (() => {
                              const a1 = parseFloat(add1Actual1[i] || "0") || 0;
                              const a2 = row.rate * a1;
                              return <span className="text-xs text-right block">{formatIndianCurrency(a2)}</span>;
                            })()}
                          </td>
                          <td className="p-1 border-r text-center min-w-[90px]">
                            {rowClicks[i] >= 1 && (() => {
                              const a1 = parseFloat(add1Actual1[i] || "0") || 0;
                              const a2 = row.rate * a1;
                              const diff = a2 - row.amount;
                              return <span className="text-xs text-right block">{formatIndianCurrency(diff)}</span>;
                            })()}
                          </td>
                        </>
                      )}
                      {maxSections >= 2 && (
                        <>
                          <td className="p-1 border-r text-center min-w-[90px]">
                            {rowClicks[i] >= 2 && (
                              <input
                                type="number"
                                value={add2Actual1[i] ?? ""}
                                onChange={e => setAdd2Actual1(prev => ({ ...prev, [i]: e.target.value }))}
                                onBlur={() => saveActual1(row, 2, add2Actual1[i] ?? "")}
                                className="w-full h-7 px-2 text-xs text-right border rounded-md focus:outline-none focus:ring-1 focus:ring-ring"
                                placeholder="0"
                              />
                            )}
                          </td>
                          <td className="p-1 border-r text-center min-w-[90px]">
                            {rowClicks[i] >= 2 && (() => {
                              const a1 = parseFloat(add2Actual1[i] || "0") || 0;
                              const a2 = row.rate * a1;
                              return <span className="text-xs text-right block">{formatIndianCurrency(a2)}</span>;
                            })()}
                          </td>
                          <td className="p-1 text-center min-w-[90px]">
                            {rowClicks[i] >= 2 && (() => {
                              const a1 = parseFloat(add2Actual1[i] || "0") || 0;
                              const a2 = row.rate * a1;
                              const diff = a2 - row.amount;
                              return <span className="text-xs text-right block">{formatIndianCurrency(diff)}</span>;
                            })()}
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                )}
                <tr>
                  <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground">
                    <span className={cellClass}>{itemRows.length + 1}</span>
                  </td>
                  <td className="p-1 border-r">
                    <span className={cellClass}>{"-"}</span>
                  </td>
                  <td className="p-1 border-r">
                    <span className={`${cellClass} whitespace-normal`}>Employee Attendance</span>
                  </td>
                  <td className="p-1 border-r text-right">
                    <span className={`${cellClass} justify-start`}>{"-"}</span>
                  </td>
                  <td className="p-1 border-r text-right">
                    <span className={`${cellClass} justify-start`}>{"-"}</span>
                  </td>
                  <td className="p-1 text-right">
                    <span className={cellClass} style={{ justifyContent: "flex-end", textAlign: "right" }}>
                      ₹ {project.attendanceTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="p-1 border-l border-r text-center">
                    <button
                      type="button"
                      onClick={() => setAttendancePopupOpen(true)}
                      className="inline-flex items-center justify-center h-5 w-5 rounded-md hover:bg-blue-100 text-blue-600 transition-colors cursor-pointer align-middle"
                      title="View attendance details"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                  {maxSections >= 1 && (
                    <>
                      <td className="p-1 border-r text-center min-w-[90px]">{"-"}</td>
                      <td className="p-1 border-r text-center min-w-[90px]">{"-"}</td>
                      <td className="p-1 border-r text-center min-w-[90px]">{"-"}</td>
                    </>
                  )}
                  {maxSections >= 2 && (
                    <>
                      <td className="p-1 border-r text-center min-w-[90px]">{"-"}</td>
                      <td className="p-1 border-r text-center min-w-[90px]">{"-"}</td>
                      <td className="p-1 text-center min-w-[90px]">{"-"}</td>
                    </>
                  )}
                </tr>
                {project.hasExpenseActivities && (
                <tr>
                  <td className="p-2 py-1 border-r text-left text-xs text-muted-foreground">
                    <span className={cellClass}>{itemRows.length + 2}</span>
                  </td>
                  <td className="p-1 border-r">
                    <span className={cellClass}>{"-"}</span>
                  </td>
                  <td className="p-1 border-r">
                    <span className={`${cellClass} whitespace-normal`}>Expense Activities</span>
                  </td>
                  <td className="p-1 border-r text-right">
                    <span className={`${cellClass} justify-start`}>{"-"}</span>
                  </td>
                  <td className="p-1 border-r text-right">
                    <span className={`${cellClass} justify-start`}>{"-"}</span>
                  </td>
                  <td className="p-1 text-right">
                    <span className={cellClass} style={{ justifyContent: "flex-end", textAlign: "right" }}>
                      ₹ {project.expenseActivitiesTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="p-1 border-l border-r text-center">
                    <button
                      type="button"
                      onClick={() => setExpensePopupOpen(true)}
                      className="inline-flex items-center justify-center h-5 w-5 rounded-md hover:bg-blue-100 text-blue-600 transition-colors cursor-pointer align-middle"
                      title="View expense activities details"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  </td>
                  {maxSections >= 1 && (
                    <>
                      <td className="p-1 border-r text-center min-w-[90px]">{"-"}</td>
                      <td className="p-1 border-r text-center min-w-[90px]">{"-"}</td>
                      <td className="p-1 border-r text-center min-w-[90px]">{"-"}</td>
                    </>
                  )}
                  {maxSections >= 2 && (
                    <>
                      <td className="p-1 border-r text-center min-w-[90px]">{"-"}</td>
                      <td className="p-1 border-r text-center min-w-[90px]">{"-"}</td>
                      <td className="p-1 text-center min-w-[90px]">{"-"}</td>
                    </>
                  )}
                </tr>
                )}
              </tbody>
              <tfoot className="divide-y">
                <tr className="font-bold border-t-2">
                  <td colSpan={5} className="p-2 py-1 text-right text-md border-r">
                    <span className={`${cellClass} justify-end text-md`}>TOTAL :</span>
                  </td>
                  <td className="p-1 py-2 text-right text-md tabular-nums font-mono">
                    <span className={`${cellClass} text-md`} style={{ justifyContent: "flex-end", textAlign: "right" }}>
                      ₹ {totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td colSpan={1 + (maxSections >= 1 ? 3 : 0) + (maxSections >= 2 ? 3 : 0)} />
                </tr>
                {premiumLabel && (
                  <tr className="font-bold">
                    <td colSpan={5} className="p-2 py-1 text-right text-md border-r">
                      <span className={`${cellClass} justify-end text-md`}>{premiumLabel} :</span>
                    </td>
                    <td className="p-1 py-2 text-right text-md tabular-nums font-mono">
                      <span className={`${cellClass} text-md`} style={{ justifyContent: "flex-end", textAlign: "right" }}>
                        {tenderPremiumAmount >= 0 ? "+ " : "- "}
                        ₹ {Math.abs(tenderPremiumAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td colSpan={1 + (maxSections >= 1 ? 3 : 0) + (maxSections >= 2 ? 3 : 0)} />
                  </tr>
                )}
                <tr className="font-bold border-t-2 bg-slate-50">
                  <td colSpan={5} className="p-2 py-1 text-right text-md border-r">
                    <span className={`${cellClass} justify-end text-md`}>NET :</span>
                  </td>
                  <td className="p-1 py-2 text-right text-md tabular-nums font-mono">
                    <span className={`${cellClass} text-md`} style={{ justifyContent: "flex-end", textAlign: "right" }}>
                      ₹ {netAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td colSpan={1 + (maxSections >= 1 ? 3 : 0) + (maxSections >= 2 ? 3 : 0)} />
                </tr>
                <tr className="font-bold">
                  <td colSpan={5} className="p-1 text-right text-md border-r">
                    <span className={`${cellClass} justify-end text-md`}>SAY :</span>
                  </td>
                  <td className="p-1 py-2 text-right text-md tabular-nums font-mono">
                    <span className={`${cellClass} text-md`} style={{ justifyContent: "flex-end", textAlign: "right" }}>
                      ₹ {Math.round(netAmount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td colSpan={1 + (maxSections >= 1 ? 3 : 0) + (maxSections >= 2 ? 3 : 0)} />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>

      {multiPartyPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMultiPartyPopup(null)} />
          <div className="relative bg-white rounded-lg shadow-lg border p-6 w-full max-w-md mx-4 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800">
                Purchase Entries — {multiPartyPopup.itemName}
              </h3>
              <button
                type="button"
                onClick={() => setMultiPartyPopup(null)}
                className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 text-lg leading-none cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="border rounded-md overflow-hidden max-h-[70vh] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-100">
                  <tr className="text-left text-slate-600 uppercase tracking-wider">
                    <th className="p-2 font-semibold border-b">#</th>
                    <th className="p-2 font-semibold border-b">Party Name</th>
                    <th className="p-2 font-semibold border-b">Item Name</th>
                    <th className="p-2 font-semibold border-b text-right">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {multiPartyPopup.details.map((d, i) => (
                    <tr key={i} className="border-b last:border-b-0 hover:bg-slate-50">
                      <td className="p-2">{i + 1}</td>
                      <td className="p-2">{d.partyName}</td>
                      <td className="p-2">{d.itemName}</td>
                      <td className="p-2 text-right font-mono">{formatIndianCurrency(d.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {attendancePopupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setAttendancePopupOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-lg border p-6 w-full max-w-lg mx-4 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800">
                Employee Attendance Details — {project.name}
              </h3>
              <button
                type="button"
                onClick={() => setAttendancePopupOpen(false)}
                className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 text-lg leading-none cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="border rounded-md overflow-hidden max-h-[70vh] overflow-y-auto">
              {attendanceGrouped.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-xs">
                  No attendance records found
                </div>
              ) : (
                <Accordion type="multiple" className="w-full">
                  {attendanceGrouped.map((g) => (
                    <AccordionItem key={g.date} value={g.date} className="border-b last:border-b-0 px-3">
                      <AccordionTrigger className="text-sm font-semibold text-slate-700 no-underline hover:no-underline py-3">
                        <span className="flex items-center gap-2">
                          {g.date}
                          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                            {g.employeeCount} employee{g.employeeCount === 1 ? "" : "s"}
                          </span>
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="px-1">
                        <div className="border rounded-md overflow-hidden">
                          <table className="w-full text-xs">
                            <thead className="bg-slate-100">
                              <tr className="text-left text-slate-600 uppercase tracking-wider">
                                <th className="p-2 font-semibold border-b w-10">#</th>
                                <th className="p-2 font-semibold border-b">Employee Name</th>
                                <th className="p-2 font-semibold border-b text-right">Salary Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {g.details.map((d, i) => (
                                <tr key={i} className="border-b last:border-b-0 hover:bg-slate-50">
                                  <td className="p-2">{i + 1}</td>
                                  <td className="p-2">{d.worker_name}</td>
                                  <td className="p-2 text-right font-mono">{formatIndianCurrency(d.wages)}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot className="bg-slate-50">
                              <tr className="font-semibold">
                                <td colSpan={2} className="p-2 text-right border-t">Total Salary :</td>
                                <td className="p-2 text-right font-mono border-t">
                                  {formatIndianCurrency(g.totalSalary)}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              )}
            </div>
          </div>
        </div>
      )}

      {expensePopupOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={() => setExpensePopupOpen(false)} />
          <div className="relative bg-white rounded-lg shadow-lg border p-6 w-full max-w-2xl mx-4 z-10">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-800">
                Expense Activities Details — {project.name}
              </h3>
              <button
                type="button"
                onClick={() => setExpensePopupOpen(false)}
                className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-slate-100 text-slate-500 text-lg leading-none cursor-pointer"
              >
                ×
              </button>
            </div>
            <div className="border rounded-md overflow-hidden max-h-[70vh] overflow-y-auto">
              <Accordion type="multiple" className="w-full">
                {project.cashExpenseActivities.length > 0 && (
                  <AccordionItem value="cash" className="border-b last:border-b-0 px-3">
                    <AccordionTrigger className="text-sm font-semibold text-slate-700 no-underline hover:no-underline py-3">
                      Cash Book
                    </AccordionTrigger>
                    <AccordionContent className="px-1">
                      <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-100">
                            <tr className="text-left text-slate-600 uppercase tracking-wider">
                              <th className="p-2 font-semibold border-b">#</th>
                              <th className="p-2 font-semibold border-b">Date</th>
                              <th className="p-2 font-semibold border-b">Party Name</th>
                              <th className="p-2 font-semibold border-b text-right">Credit</th>
                              <th className="p-2 font-semibold border-b text-right">Debit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {project.cashExpenseActivities.map((t, i) => (
                              <tr key={i} className="border-b last:border-b-0 hover:bg-slate-50">
                                <td className="p-2">{i + 1}</td>
                                <td className="p-2">
                                  {new Date(t.transaction_date).toLocaleDateString()}
                                </td>
                                <td className="p-2">{t.party_name || "-"}</td>
                                <td className="p-2 text-right font-mono">
                                  {t.transaction_type === "CREDIT" ? (
                                    <span className="text-green-600">
                                      + {formatIndianCurrency(t.credit_amount)}
                                    </span>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                <td className="p-2 text-right font-mono">
                                  {t.transaction_type !== "CREDIT" ? (
                                    <span className="text-red-600">
                                      - {formatIndianCurrency(t.debit_amount)}
                                    </span>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
                {project.bankExpenseActivities.length > 0 && (
                  <AccordionItem value="bank" className="border-b last:border-b-0 px-3">
                    <AccordionTrigger className="text-sm font-semibold text-slate-700 no-underline hover:no-underline py-3">
                      Bank Book
                    </AccordionTrigger>
                    <AccordionContent className="px-1">
                      <div className="border rounded-md overflow-hidden">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-100">
                            <tr className="text-left text-slate-600 uppercase tracking-wider">
                              <th className="p-2 font-semibold border-b">#</th>
                              <th className="p-2 font-semibold border-b">Date</th>
                              <th className="p-2 font-semibold border-b">Party Name</th>
                              <th className="p-2 font-semibold border-b text-right">Credit</th>
                              <th className="p-2 font-semibold border-b text-right">Debit</th>
                            </tr>
                          </thead>
                          <tbody>
                            {project.bankExpenseActivities.map((t, i) => (
                              <tr key={i} className="border-b last:border-b-0 hover:bg-slate-50">
                                <td className="p-2">{i + 1}</td>
                                <td className="p-2">
                                  {new Date(t.transaction_date).toLocaleDateString()}
                                </td>
                                <td className="p-2">{t.party_name || "-"}</td>
                                <td className="p-2 text-right font-mono">
                                  {t.transaction_type === "CREDIT" ? (
                                    <span className="text-green-600">
                                      + {formatIndianCurrency(t.credit_amount)}
                                    </span>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                                <td className="p-2 text-right font-mono">
                                  {t.transaction_type !== "CREDIT" ? (
                                    <span className="text-red-600">
                                      - {formatIndianCurrency(t.debit_amount)}
                                    </span>
                                  ) : (
                                    "-"
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
                {project.cashExpenseActivities.length === 0 && project.bankExpenseActivities.length === 0 && (
                  <div className="p-4 text-center text-muted-foreground text-xs">
                    No expense activity transactions found
                  </div>
                )}
              </Accordion>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          @page {
            size: A4;
            margin: 10mm;
          }
          table td:last-child {
            text-align: right !important;
          }
        }
      `}</style>
    </div>
  );
}
