"use client";

import { useMemo } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  X,
  Calendar,
  Clock,
  MapPin,
  FileText,
  Download,
  User,
  FileCheck,
  Building2,
  Ruler,
  HardHat,
  IndianRupee,
  CheckCircle2,
  Circle,
  ChevronRight,
  MessagesSquare,
  FilePen,
} from "lucide-react";
import { formatDate, formatIndianCurrency } from "@/lib/financial-year";
import { cn } from "@/lib/utils";
import { useSession } from "next-auth/react";

interface Location {
  id: string;
  location_id: string;
  location?: { id: string; name: string };
}

interface Document {
  id: string;
  document_type: string;
  file_url: string;
  file_name: string;
  file_size?: number | null;
  uploaded_at?: string;
}

interface ProjectItem {
  id: string;
  capital_sor_id: string;
  size: string;
  rate: string | number;
  is_price_tracking?: boolean;
  capitalSOR?: {
    id: string;
    item_name: string;
    uom: string;
    currentPrice: string;
  } | null;
}

interface ProjectData {
  id: string;
  name: string;
  unique_name: string | null;
  project_no: string | null;
  year: string | null;
  tender_notice_no: string | null;
  status: string;
  department: string | null;
  department_name?: string | null;
  sor_id: string | null;
  sor_name?: string | null;
  work_type: string | null;
  work_type_name?: string | null;
  start_date: string | null;
  end_date: string | null;
  project_end_date: string | null;
  project_estimation_cost: number | null;
  project_approved_amount: number | null;
  tender_premium_value: string | null;
  tender_premium_type: string | null;
  tender_premium_id: string | null;
  negotiation_price_id: string | null;
  negotiation_price_value: string | null;
  negotiation_type: string | null;
  negotiationPrice?: { id: string; name: string } | null;
  sd_amount: number | null;
  sd_no: string | null;
  sd_start_date: string | null;
  sd_end_date: string | null;
  purchaseEntryCount?: number;
  company_name?: string | null;
  is_completed?: boolean;
  work_completion_date?: string | null;
  retention_money_details: string | null;
  retention_money_details_no: string | null;
  retention_money_details_start_date: string | null;
  retention_money_details_end_date: string | null;
  loa_approved_no: string | null;
  loa_approved_date: string | null;
  work_order_date: string | null;
  agreement_no: string | null;
  agreement_date?: string | null;
  supervisor: string | null;
  officer: string | null;
  remarks: string | null;
  location: string | null;
  area: string | null;
  place_of_work: string | null;
  time_limit: string | null;
  time_limit_unit: string | null;
  total_amount: number | null;
  sqm: number | null;
  brs: number | null;
  main_item_execution_qty: string | null;
  time_period: string | null;
  description: string | null;
  createdAt?: string;
  tender_number?: string | null;
  tender_date?: string | null;
  contractor_name?: string | null;
  contractor_contact?: string | null;
  contractor_address?: string | null;
  locations?: Location[];
  documents?: Document[];
  items?: ProjectItem[];
  progress?: {
    percentage: number;
    totalQty: number;
    purchasedQty: number;
    totalAmount: number;
    progressiveAmount: number;
    itemName: string;
    uom: string;
  } | null;
  projectArea?: { id: string; title: string } | null;
}

interface ProjectDetailsModalProps {
  open: boolean;
  onClose: () => void;
  project: ProjectData | null;
}

function CircularProgress({
  percentage,
  size = 100,
  children,
}: {
  percentage: number;
  size?: number;
  children?: React.ReactNode;
}) {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          className="text-gray-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-blue-600 transition-all duration-500"
        />
      </svg>
      {children ?? (
        <span className="absolute text-lg font-bold text-blue-600">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-0">
      {/* <div className="h-2 w-2 rounded-full bg-blue-600" /> */}
      <h3 className="text-sm font-semibold text-gray-800 uppercase">{children}</h3>
      {/* <div className="flex-1 h-px bg-gray-200" /> */}
    </div>
  );
}

function InfoRow({
  label,
  value,
  clasname
}: {
  label: string;
  value: string | number | null | undefined;
  clasname?: any;
}) {
  return (
    <div className={`${clasname ? clasname : ""} flex items-start justify-between gap-2 py-[5px]  border border-input border-t-0 border-l-0 border-r-0`}>
      <span className="text-xs text-gray-500 shrink-0 min-w-[100px]">
        {label}
      </span>
      <span className="text-xs font-medium text-gray-800 text-right">
        {value ?? "-"}
      </span>
    </div>
  );
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "-";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const DOCUMENT_LABELS: Record<string, string> = {
  TENDER_NIT: "Tender NIT",
  ESTIMATE: "Estimate",
  LOA: "LOA",
  AGREEMENT: "Agreement",
  WORK_ORDER: "Work Order",
  CONTRACTOR: "Contractor",
  OTHER: "Other",
};

export function ProjectDetailsModal({
  open,
  onClose,
  project,
}: ProjectDetailsModalProps) {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role;

  const progressData = useMemo(() => {
    if (!project)
      return {
        pct: 0,
        totalQty: 0,
        completedQty: 0,
        totalDays: 0,
        remainingDays: 0,
        perDayRequired: 0,
        actualPerDay: 0,
        difference: 0,
        startDate: null,
        endDate: null,
        elapsedMonths: 0,
        totalDurationMonths: 0,
        timeElapsedStr: "-",
      };

    const pct = project.progress?.percentage ?? 0;
    const totalQty =
      project.progress?.totalQty ??
      (parseFloat(project.main_item_execution_qty ?? "0") || 0);
    const completedQty = project.progress?.purchasedQty ?? 0;
    const totalDays = project.time_limit ? parseInt(project.time_limit) : 0;

    const loaStartDate = project.loa_approved_date ? new Date(project.loa_approved_date) : null;

    let elapsedMonths = 0;
    let totalDurationMonths = 0;
    let timeElapsedStr = "-";

    if (loaStartDate && project.time_limit) {
      const timeLimit = parseInt(project.time_limit);
      const unit = project.time_limit_unit?.toLowerCase();
      totalDurationMonths = unit === 'year' ? timeLimit * 12 : timeLimit;

      const now = new Date();
      elapsedMonths = (now.getFullYear() - loaStartDate.getFullYear()) * 12 +
        (now.getMonth() - loaStartDate.getMonth());

      if (now.getDate() < loaStartDate.getDate()) {
        elapsedMonths--;
      }

      elapsedMonths = Math.max(0, Math.min(elapsedMonths, totalDurationMonths));

      timeElapsedStr = `${elapsedMonths} / ${totalDurationMonths} Months`;
    }

    const remainingDays =
      totalDays > 0
        ? totalDays -
          Math.floor(
            (new Date().getTime() - (loaStartDate?.getTime() ?? Date.now())) /
              (1000 * 60 * 60 * 24),
          )
        : 0;

    const perDayRequired = totalDays > 0 ? totalQty / totalDays : 0;
    const daysElapsed = totalDays - Math.max(0, remainingDays);
    const actualPerDay = daysElapsed > 0 ? completedQty / daysElapsed : 0;
    const difference = actualPerDay - perDayRequired;

    return {
      pct,
      totalQty,
      completedQty,
      totalDays,
      remainingDays: Math.max(0, remainingDays),
      perDayRequired,
      actualPerDay,
      difference,
      loaStartDate,
      elapsedMonths,
      totalDurationMonths,
      timeElapsedStr,
    };
  }, [project]);

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      {
        label: string;
        variant: "default" | "secondary" | "destructive" | "outline";
      }
    > = {
      DRAFT: { label: "Draft", variant: "outline" },
      NOT_STARTED: { label: "Not Started", variant: "secondary" },
      IN_PROGRESS: { label: "In Progress", variant: "default" },
      COMPLETED: { label: "Completed", variant: "default" },
    };
    const config = statusConfig[status] || {
      label: status,
      variant: "outline" as const,
    };
    return (
      <Badge variant={config.variant} className="text-xs">
        {config.label}
      </Badge>
    );
  };

  const timelineEvents = useMemo(() => {
    if (!project) return [];

    return [
      {
        label: "LOA Approved",
        icon: FileCheck,
        date: project.loa_approved_date,
        completed: !!project.loa_approved_date,
      },
      {
        label: "Work Order",
        icon: FileText,
        date: project.work_order_date,
        completed: !!project.work_order_date,
      },
      {
        label: "SD Start",
        icon: Calendar,
        date: project.sd_start_date,
        completed: !!project.sd_start_date,
      },
      {
        label: "SD End",
        icon: Clock,
        date: project.sd_end_date,
        completed: !!project.sd_end_date,
      },
      {
        label: "Retention Start",
        icon: Calendar,
        date: project.retention_money_details_start_date,
        completed: !!project.retention_money_details_start_date,
      },
      {
        label: "Retention End",
        icon: Clock,
        date: project.retention_money_details_end_date,
        completed: !!project.retention_money_details_end_date,
      },
      {
        label: "Project End",
        icon: CheckCircle2,
        date: project.project_end_date,
        completed: project.is_completed || false,
      },
    ];
  }, [project]);

  if (!project) return null;

  const getDocumentByType = (type: string) => {
    return project.documents?.find((d) => d.document_type === type);
  };

  const handleDownload = async (doc: Document) => {
    if (doc.file_url) {
      window.open(doc.file_url, "_blank");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[95vw] w-full h-[95vh] !p-[10px] gap-0 flex flex-col bg-[#f9fafb] "
        hideCloseButton={true}
      >
        <div className="shrink-0">
          <div className="border rounded-lg p-3 bg-white">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                  <FileText className="h-5 w-5 text-blue-600" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-xs">
                    <span className="font-semibold text-gray-900">
                      PROJECT NO:
                    </span>
                    <span className="text-gray-700">
                      {project.project_no || "-"}
                    </span>
                    <span className="text-gray-300 mx-0.5">|</span>
                    <span className="font-semibold text-gray-900">FY:</span>
                    <span className="text-gray-700">{project.year || "-"}</span>
                    <span className="text-gray-300 mx-0.5">|</span>
                    <span className="font-semibold text-gray-900">
                      UNIQUE NAME:
                    </span>
                    <span className="text-gray-700 break-all">
                      {project.unique_name || "-"}
                    </span>
                  </div>
                  <div className="mt-1 text-xs">
                    <span className="font-semibold text-gray-900">
                      PROJECT NAME:
                    </span>
                    <span className="text-gray-700 ml-1">{project.name}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 md:gap-6 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Building2 className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                      Department
                    </p>
                    <p className="text-xs font-semibold text-gray-900">
                      {project.department_name || project.department || "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Ruler className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                      SOR
                    </p>
                    <p className="text-xs font-semibold text-gray-900">
                      {project.sor_name || project.sor_id || "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                    <HardHat className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
                      Work Type
                    </p>
                    <p className="text-xs font-semibold text-gray-900">
                      {project.work_type_name || project.work_type || "-"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 mb-1 mt-2">
              <div className="flex gap-[2px]">
                {Array.from({ length: 85 }).map((_, i) => {
                  const totalSegments = 85;
                  const filled = Math.round(
                    (Math.round(progressData.pct) / 100) * totalSegments,
                  );
                  return (
                    <div
                      key={i}
                      className={`h-3 w-3 rounded-[2px] ${i < filled ? "bg-blue-800" : "bg-blue-200"}`}
                    />
                  );
                })}
              </div>
              <span className="text-xs font-medium text-blue-600">
                {Math.round(progressData.pct)}%
              </span>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600 hidden">
              <span>
                Purchased Qty:{" "}
                <span className="font-medium text-gray-800">
                  {Math.round(progressData.completedQty).toLocaleString(
                    "en-IN",
                  )}
                </span>
              </span>
              <span>
                Total Qty:{" "}
                <span className="font-medium text-gray-800">
                  {Math.round(progressData.totalQty).toLocaleString("en-IN")}
                </span>
              </span>
              <span>
                Remaining Qty:{" "}
                <span className="font-medium text-gray-800">
                  {Math.round(
                    progressData.totalQty - progressData.completedQty,
                  ).toLocaleString("en-IN")}
                </span>
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-0 py-2 space-y-2">
          {/* Row 1: Progress Overview | Per Day Progress | Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Progress Overview Card */}
            {(() => {
              const startDate = project.loa_approved_date
                ? new Date(project.loa_approved_date)
                : null;
              const endDate = project.project_end_date
                ? new Date(project.project_end_date)
                : null;
              let elapsedMonths = 0;
              let totalDurationMonths = 0;
              let remainingMonths = 0;
              if (startDate && endDate) {
                const now = new Date();
                totalDurationMonths =
                  (endDate.getFullYear() - startDate.getFullYear()) * 12 +
                  (endDate.getMonth() - startDate.getMonth());
                if (totalDurationMonths < 1) totalDurationMonths = 1;
                const totalMs = endDate.getTime() - startDate.getTime();
                const elapsedMs = now.getTime() - startDate.getTime();
                const ratio = Math.min(1, Math.max(0, elapsedMs / totalMs));
                elapsedMonths = Math.round(ratio * totalDurationMonths);
                remainingMonths = Math.max(
                  0,
                  totalDurationMonths - elapsedMonths,
                );
              }
              return (
                <Card className="shadow-sm">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm font-semibold flex items-center gap-1.5 uppercase">
                      {/* <div className="h-2 w-2 rounded-full bg-blue-600" /> */}
                      Progress Overview
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <div className="flex flex-row items-center">
                      <div className="flex-1 flex flex-col items-center justify-center">
                        <CircularProgress
                          percentage={progressData.pct}
                          size={120}
                        >
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-xs font-bold text-[#000] !text-[19px] mb-[3px]">
                              {Math.round(progressData.pct)}%
                            </span>
                            <span className="text-[11px] text-gray-500 leading-tight text-center">
                              Overall
                              <br />
                              Completion
                            </span>
                          </div>
                        </CircularProgress>
                      </div>
                      <div className="w-px bg-gray-200 mx-0.5 self-stretch mr-[20px] ml-[20px]" />
                      <div className="flex-1 flex justify-center items-center space-y-1 ">
                        <div className="">
                          <Clock className="h-[65px] w-[65px] text-[#e5e7ec] mr-[10px] time_icon_color" />
                        </div>
                        <div className="flex-1 !mt-[0]">
                          <span className="text-[12px] text-gray-500 mb-[5px]">
                            Time Elapsed:
                          </span>
                          <div className="text-[12px] font-semibold text-gray-800">
                            <span className="text-sm font-bold text-blue-600 !text-[19px]">
                              {elapsedMonths} / {totalDurationMonths}
                            </span>{" "}
                            Months
                          </div>
                        </div>
                        {/* <div>
                          <span className="text-[10px] text-gray-500">
                            Remaining Time:
                          </span>
                          <div className="text-[11px] font-semibold text-gray-800">
                            <span className="text-sm font-bold text-blue-600">
                              {remainingMonths}
                            </span>{" "}
                            Months
                          </div>
                        </div> */}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

            {/* Financial Summary */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase">
                  {/* <div className="h-2 w-2 rounded-full bg-emerald-600" /> */}
                  Financial Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-1.5 text-xs">
                  <InfoRow
                    label="Project Estimation Cost"
                    value={
                      project.project_estimation_cost
                        ? `₹${formatIndianCurrency(project.project_estimation_cost)}`
                        : "-"
                    }
                  />
                  {(() => {
                    const formatPremium = (
                      type: string | null | undefined,
                      valueType: string | null | undefined,
                      value: string | null | undefined,
                    ) => {
                      if (!value) return null;
                      const num = parseFloat(value);
                      if (isNaN(num)) return null;
                      const isEqual = type === "0";
                      const sign = type === "-" ? "-" : type === "+" ? "+" : "";
                      const suffix =
                        valueType?.toLowerCase() === "percentage" ? "%" : "";
                      if (isEqual) return `0${suffix}`;
                      return `${sign}${num.toFixed(2)}${suffix}`;
                    };
                    const npName = project.negotiationPrice?.name;
                    const npValue = project.negotiation_price_value;
                    let hasNP = false;
                    if (npValue && npName) {
                      if (npName === "0") {
                        hasNP = true;
                      } else {
                        hasNP = npValue !== "0";
                      }
                    }
                    if (hasNP) {
                      const formatted = formatPremium(
                        npName,
                        project.negotiation_type,
                        project.negotiation_price_value,
                      );
                      if (formatted)
                        return (
                          <InfoRow
                            label="Negotiation Price"
                            value={formatted}
                          />
                        );
                    }
                    const hasTP =
                      project.tender_premium_value && project.tender_premium_id;
                    if (hasTP) {
                      const formatted = formatPremium(
                        project.tender_premium_id,
                        project.tender_premium_type,
                        project.tender_premium_value,
                      );
                      if (formatted)
                        return (
                          <InfoRow label="Tender Premium" value={formatted} />
                        );
                    }
                    return null;
                  })()}
                  <InfoRow
                    label="Project Approved Amount"
                    value={
                      project.project_approved_amount
                        ? `₹${formatIndianCurrency(project.project_approved_amount)}`
                        : "-"
                    }
                  />
                  <InfoRow
                    label="SD Amount (5%)"
                    value={
                      project.sd_amount
                        ? `₹${formatIndianCurrency(project.sd_amount)}`
                        : "-"
                    }
                  />
                  {project.project_approved_amount && project.project_approved_amount > 4000000 && project.retention_money_details ? (
                    <InfoRow
                      label="Retention Money Details Amount (2.5%)"
                      clasname={"!pb-0 border-b-0"}
                      value={`₹${formatIndianCurrency(parseFloat(project.retention_money_details))}`}
                    />
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions Card */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase">
                  {/* <div className="h-2 w-2 rounded-full bg-amber-600" /> */}
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="">
                  <Button
                    variant="outline"
                    className="w-full justify-start text-xs p-0 rounded-none border-t-0 border-l-0 border-r-0 !p-[10px] !px-0  !h-[unset] !text-[13px]"
                    onClick={() => {
                      window.open(`/projects/${project.id}/correspondence`, "_blank");
                    }}
                  >
                    <MessagesSquare strokeWidth={1.5} className="!h-[32px] !w-[32px] text-blue-600" />
                    <span className="uppercase"> Correspondence</span>
                    <ChevronRight className="h-3 w-3 ml-auto text-gray-400" />
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-xs p-0 rounded-none border-t-0 border-l-0 border-r-0 !p-[10px] !px-0 !h-[unset] !text-[13px]"
                    onClick={() => {
                      window.open(`/projects/${project.id}/abstract-preview`, "_blank");
                    }}
                  >
                    <FileText strokeWidth={1.5} className="!h-[32px] !w-[32px] text-blue-600" />
                    <span className="uppercase"> ABSTRACT</span>
                    <ChevronRight className="h-3 w-3 ml-auto text-gray-400" />
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-xs p-0 rounded-none border-t-0 border-l-0 border-r-0 !p-[10px] !px-0  !h-[unset] !text-[13px] border-b-0 !pb-0"
                    onClick={() => {
                      window.open(`/projects/${project.id}/form-3a`, "_blank");
                    }}
                  >
                    <FilePen strokeWidth={1.5} className="!h-[32px] !w-[32px] text-blue-600" />
                    <span className="uppercase"> Generate 3(A)</span>
                    <ChevronRight className="h-3 w-3 ml-auto text-gray-400" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Checked Item Summary | Financial Summary | Location */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Checked Item Summary */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase ">
                  {/* <div className="h-2 w-2 rounded-full bg-indigo-600" /> */}
                  PROJECT TRACKING ITEM
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {project.items && project.items.length > 0 ? (
                  <div className="space-y-1.5 text-xs">
                    {(() => {
                      const checkedItem = project.items?.find(
                        (item) => item.is_price_tracking
                      );
                      if (!checkedItem) {
                        return (
                          <p className="text-xs text-gray-400 py-4 text-center">
                            No items checked
                          </p>
                        );
                      }
                      const itemQty = parseFloat(checkedItem.size) || 0;
                      const sqm = itemQty;
                      const brs = sqm > 0 ? sqm / 9.29 : 0;
                      return (
                        <>
                          <InfoRow
                            label="Item Name"
                            value={checkedItem.capitalSOR?.item_name || "-"}
                          />
                          <InfoRow
                            label="SQM"
                            value={sqm ? formatIndianCurrency(sqm) : "-"}
                          />
                          <InfoRow
                            label="BRS Value"
                            value={brs ? `₹${formatIndianCurrency(brs)}` : "-"}
                            clasname="border-b-0"
                          />
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 py-4 text-center">
                    No items checked
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Per Day Progress Card */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-1.5 uppercase">
                  {/* <div className="h-2 w-2 rounded-full bg-green-600" /> */}
                  Per Day Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="mb-2.5 flex items-center justify-between">
                  <span>
                    <span className="text-sm font-bold text-gray-800">
                      {progressData.totalQty
                        ? Math.round(progressData.totalQty).toLocaleString(
                            "en-IN",
                          )
                        : 0}
                    </span>
                    <span className="text-sm text-gray-500">
                      {" "}
                      / {progressData.totalDays || 0} DAYS
                    </span>
                  </span>
                  <span className="text-sm text-gray-500">
                    Remaining Qty: <span className="font-semibold text-gray-800">{Math.round(Math.max(0, progressData.totalQty - progressData.completedQty)).toLocaleString("en-IN")}</span>
                  </span>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-gray-500">
                      PER DAY PROGRESS REQ
                    </span>
                    <span className="text-xs font-bold text-gray-800">
                      {progressData.perDayRequired
                        ? progressData.perDayRequired.toFixed(2)
                        : "0.00"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-gray-500">ACTUAL</span>
                    <span className="text-xs font-bold text-gray-800">
                      {progressData.actualPerDay
                        ? progressData.actualPerDay.toFixed(2)
                        : "0.00"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-gray-500">DIFF:</span>
                    <span
                      className={`text-xs font-bold ${(progressData.difference ?? 0) >= 0 ? "text-green-600" : "text-red-600"}`}
                    >
                      {(progressData.difference ?? 0) >= 0 ? "+" : ""}
                      {(progressData.difference ?? 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Location Information */}
            <Card className="shadow-sm">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 uppercase">
                  {/* <div className="h-2 w-2 rounded-full bg-rose-600" /> */}
                  Location Information
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="space-y-1.5 text-xs mb-3">
                  <InfoRow
                    label="Area"
                    value={project.projectArea?.title || project.area || "-"}
                  />
                  {/* <InfoRow label="Zone" value={project.place_of_work || '-'} />
                                        <InfoRow label="Ward" value={project.location || '-'} /> */}
                </div>
                <div>
                  <span className="text-xs text-gray-500 block mb-1.5">
                    Selected Locations
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {project.locations && project.locations.length > 0 ? (
                      project.locations.map((loc) => (
                        <Badge
                          key={loc.id}
                          variant="secondary"
                          className="text-xs gap-1"
                        >
                          <MapPin className="h-3 w-3" />
                          {loc.location?.name || "Unknown"}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-gray-400">
                        No locations
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Project Timeline */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4 !pb-0">
              <SectionTitle>Project Timeline</SectionTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 !pt-0">
              <div className="overflow-x-auto">
                <div className="flex items-start min-w-[900px] px-2 py-4">
                  {timelineEvents.map((event, idx) => (
                    <div
                      key={idx}
                      className="flex-1 flex flex-col items-center relative"
                    >
                      <span
                        className={cn(
                          "text-xs font-medium text-center mb-2 whitespace-nowrap",
                          event.completed ? "text-gray-800" : "text-gray-400",
                        )}
                      >
                        {event.label}
                      </span>
                      <div className="relative flex items-center justify-center w-full">
                        {idx > 0 && (
                          <div
                            className={cn(
                              "absolute right-1/2 top-1/2 -translate-y-1/2 h-0.5 w-full",
                              event.completed ? "bg-blue-600" : "bg-gray-200",
                            )}
                          />
                        )}
                        <div
                          className={cn(
                            "relative z-10 w-7 h-7 rounded-full flex items-center justify-center",
                            event.completed
                              ? "bg-blue-600 text-white"
                              : "bg-gray-100 text-gray-400 border-2 border-gray-300",
                          )}
                        >
                          {event.completed ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <Circle className="h-3.5 w-3.5" />
                          )}
                        </div>
                      </div>
                      <span
                        className={cn(
                          "text-xs text-center mt-2 whitespace-nowrap",
                          event.completed ? "text-gray-500" : "text-gray-300",
                        )}
                      >
                        {event.date ? formatDate(event.date) : "Pending"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Reference Numbers */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4 !pb-0 ">
              <SectionTitle>Reference Numbers</SectionTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 !pt-0">
              <div className="flex flex-wrap items-stretch">
                <div className="flex-1 min-w-[150px] px-3 py-1 pl-0">
                  <p className="text-xs text-gray-500 mb-1">Tender Notice No</p>
                  <p className="text-xs font-medium text-gray-800">
                    {project.tender_notice_no || "-"}
                  </p>
                </div>
                <div className="w-px bg-gray-200 self-stretch mx-1" />
                <div className="flex-1 min-w-[150px] px-3 py-1">
                  <p className="text-xs text-gray-500 mb-1">Agreement No</p>
                  <p className="text-xs font-medium text-gray-800">
                    {project.agreement_no || "-"}
                    {project.agreement_date && (
                      <span className="text-gray-500 ml-1">
                        DT: {formatDate(project.agreement_date)}
                      </span>
                    )}
                  </p>
                </div>
                <div className="w-px bg-gray-200 self-stretch mx-1" />
                <div className="flex-1 min-w-[150px] px-3 py-1">
                  <p className="text-xs text-gray-500 mb-1">LOA Approved No</p>
                  <p className="text-xs font-medium text-gray-800">
                    {project.loa_approved_no || "-"}
                    {project.loa_approved_date && (
                      <span className="text-gray-500 ml-1">
                        DT: {formatDate(project.loa_approved_date)}
                      </span>
                    )}
                  </p>
                </div>
                <div className="w-px bg-gray-200 self-stretch mx-1" />
                <div className="flex-1 min-w-[150px] px-3 py-1">
                  <p className="text-xs text-gray-500 mb-1">SD No</p>
                  <p className="text-xs font-medium text-gray-800">
                    {project.sd_no || "-"}
                  </p>
                </div>
                <div className="w-px bg-gray-200 self-stretch mx-1" />
                <div className="flex-1 min-w-[150px] px-3 py-1 pr-0">
                  <p className="text-xs text-gray-500 mb-1">
                    Retention Money Details No
                  </p>
                  <p className="text-xs font-medium text-gray-800">
                    {project.retention_money_details_no || "-"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Project Team */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <SectionTitle>Project Team</SectionTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                  <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center">
                    <User className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Supervisor</p>
                    <p className="text-sm font-medium text-gray-800">
                      {project.supervisor || "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
                  <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center">
                    <User className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Officer</p>
                    <p className="text-sm font-medium text-gray-800">
                      {project.officer || "-"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg">
                  <div className="h-9 w-9 rounded-full bg-amber-100 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Remarks</p>
                    <p className="text-sm font-medium text-gray-800">
                      {project.remarks || "-"}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Project Documents */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
              <SectionTitle>Project Documents (PDF Upload)</SectionTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <div className="flex flex-wrap gap-3">
                {[
                  "TENDER_NIT",
                  "ESTIMATE",
                  "LOA",
                  "AGREEMENT",
                  "WORK_ORDER",
                ].map((type) => {
                  const doc = getDocumentByType(type);
                  return (
                    <div
                      key={type}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border flex-1 min-w-[160px]",
                        doc
                          ? "bg-white border-gray-200"
                          : "bg-gray-50 border-dashed border-gray-200",
                      )}
                    >
                      <div
                        className={cn(
                          "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                          doc ? "bg-blue-100" : "bg-gray-100",
                        )}
                      >
                        <FileText
                          className={cn(
                            "h-4 w-4",
                            doc ? "text-blue-600" : "text-gray-400",
                          )}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className={cn(
                            "text-xs font-medium truncate",
                            doc ? "text-gray-800" : "text-gray-400",
                          )}
                        >
                          {DOCUMENT_LABELS[type] || type}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {doc ? formatFileSize(doc.file_size) : "Not uploaded"}
                        </p>
                      </div>
                      {doc && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0 text-gray-400 hover:text-blue-600"
                          onClick={() => handleDownload(doc)}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
              {project.documents &&
                project.documents.filter(
                  (d) =>
                    ![
                      "TENDER_NIT",
                      "ESTIMATE",
                      "LOA",
                      "AGREEMENT",
                      "WORK_ORDER",
                    ].includes(d.document_type),
                ).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-medium text-gray-500 mb-2">
                      Other Documents
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {project.documents
                        .filter(
                          (d) =>
                            ![
                              "TENDER_NIT",
                              "ESTIMATE",
                              "LOA",
                              "AGREEMENT",
                              "WORK_ORDER",
                            ].includes(d.document_type),
                        )
                        .map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200"
                          >
                            <FileText className="h-3.5 w-3.5 text-gray-500" />
                            <span className="text-xs text-gray-700">
                              {doc.file_name || doc.document_type}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              ({formatFileSize(doc.file_size)})
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-blue-600"
                              onClick={() => handleDownload(doc)}
                            >
                              <Download className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
            </CardContent>
          </Card>

          {/* Additional Information */}
          {/* <Card className="shadow-sm">
                            <CardHeader className="pb-2 pt-4 px-4">
                                <SectionTitle>Additional Information</SectionTitle>
                            </CardHeader>
                            <CardContent className="px-4 pb-4">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <div className="space-y-1.5 text-xs">
                                        <p className="text-xs font-semibold text-gray-600 mb-2">Tender Details</p>
                                        <InfoRow label="Tender Number" value={project.tender_notice_no || '-'} />
                                        <InfoRow label="Tender Date" value={project.createdAt ? formatDate(project.createdAt) : '-'} />
                                    </div>
                                    <div className="space-y-1.5 text-xs">
                                        <p className="text-xs font-semibold text-gray-600 mb-2">Contractor Information</p>
                                        <InfoRow label="Name" value={project.contractor_name || '-'} />
                                        <InfoRow label="Contact" value={project.contractor_contact || '-'} />
                                        <InfoRow label="Address" value={project.contractor_address || project.location || '-'} />
                                    </div>
                                    <div className="space-y-1.5 text-xs">
                                        <p className="text-xs font-semibold text-gray-600 mb-2">Project Status</p>
                                        <div className="flex items-center gap-2 pt-1">
                                            {getStatusBadge(project.status)}
                                        </div>
                                        <InfoRow label="Created" value={project.createdAt ? formatDate(project.createdAt) : '-'} />
                                        <InfoRow label="Description" value={project.description || '-'} />
                                    </div>
                                </div>
                            </CardContent>
                        </Card> */}

          {/* Bottom spacer */}
          <div className="h-2" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
