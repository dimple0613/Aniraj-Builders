"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Edit3, Eye, Loader2, Printer, Save, AlertTriangle } from "lucide-react";
import { SelectField } from "@/components/ui/select-field";
import { formatIndianCurrency, numberToWords } from "@/lib/financial-year";
import axios from "axios";
import { toast } from "sonner";

interface Form3AProject {
  id: string;
  name: string;
  project_no: string | null;
  project_estimation_cost: number;
  project_approved_amount: number;
  loa_approved_date: string | null;
  work_order_date: string | null;
  project_end_date: string | null;
  work_completion_date: string | null;
  is_completed: boolean;
  status: string;
  remarks: string | null;
  total_amount: number;
  company_name: string;
}

interface Props {
  project: Form3AProject;
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function getWorkStatus(project: Form3AProject): string {
  if (project.is_completed || project.status === "COMPLETED") {
    return "This Work Is Completed As Per Specification";
  }
  return "This Work Is In Progress";
}

export function Form3A({ project }: Props) {
  const isCompleted = project.status === "COMPLETED";
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [pendingSaveData, setPendingSaveData] = useState<Record<string, string> | null>(null);

  const amountInWords = numberToWords(project.total_amount);
  const workStatus = getWorkStatus(project);

  const defaultValues = useMemo(() => ({
    company_name: project.company_name,
    name_of_work: project.name + (project.project_no ? ` (${project.project_no})` : ""),
    estimate_cost: `₹ ${formatIndianCurrency(project.project_estimation_cost)}`,
    tender_amount: `₹ ${formatIndianCurrency(project.project_approved_amount)}`,
    start_date: formatDate(project.loa_approved_date || project.work_order_date),
    completion_date: formatDate(project.project_end_date),
    actual_completion_date: formatDate(project.work_completion_date),
    work_done_figure: `₹ ${formatIndianCurrency(project.total_amount)}`,
    work_done_words: amountInWords,
    details_correct: "YES",
    work_status: workStatus,
    remarks: project.remarks || "-",
  }), [project, amountInWords, workStatus]);

  const [formValues, setFormValues] = useState(defaultValues);

  useEffect(() => {
    if (isCompleted) {
      setViewMode("preview");
    }
  }, [isCompleted]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get(`/api/projects/${project.id}/form-3a-data`);
        const { earliestPurchaseEntryDate } = response.data;
        if (response.data.success && response.data.data) {
          const saved = response.data.data;
          setFormValues((prev) => ({
            ...prev,
            ...(saved.company_name != null && { company_name: saved.company_name }),
            ...(saved.name_of_work != null && { name_of_work: saved.name_of_work }),
            ...(saved.estimate_cost != null && { estimate_cost: saved.estimate_cost }),
            ...(saved.tender_amount != null && { tender_amount: saved.tender_amount }),
            ...(saved.start_date != null && { start_date: saved.start_date }),
            ...(saved.completion_date != null && { completion_date: saved.completion_date }),
            ...(saved.actual_completion_date != null && { actual_completion_date: saved.actual_completion_date }),
            ...(saved.work_done_figure != null && { work_done_figure: saved.work_done_figure }),
            ...(saved.work_done_words != null && { work_done_words: saved.work_done_words }),
            ...(saved.details_correct != null && { details_correct: saved.details_correct }),
            ...(saved.work_status != null && { work_status: saved.work_status }),
            ...(saved.remarks != null && { remarks: saved.remarks }),
          }));
        }
        if (earliestPurchaseEntryDate && !response.data.data?.start_date) {
          setFormValues((prev) => ({ ...prev, start_date: formatDate(earliestPurchaseEntryDate) }));
        }
      } catch {
        // use default values
      } finally {
        setInitialLoading(false);
      }
    };
    fetchData();
  }, [project.id]);

  const handleInputChange = (field: string, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  };

  const doSave = async (data: Record<string, string>) => {
    setLoading(true);
    try {
      const response = await axios.put(`/api/projects/${project.id}/form-3a-data`, data);
      if (response.data.success) {
        toast.success("Form 3-A saved successfully");
        setViewMode("preview");
      }
    } catch {
      toast.error("Failed to save Form 3-A");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const saveData = {
      company_name: formValues.company_name,
      name_of_work: formValues.name_of_work,
      estimate_cost: formValues.estimate_cost,
      tender_amount: formValues.tender_amount,
      start_date: formValues.start_date,
      completion_date: formValues.completion_date,
      actual_completion_date: formValues.actual_completion_date,
      work_done_figure: formValues.work_done_figure,
      work_done_words: formValues.work_done_words,
      details_correct: formValues.details_correct,
      work_status: formValues.work_status,
      remarks: formValues.remarks,
    };

    if (formValues.actual_completion_date && formValues.actual_completion_date !== "-") {
      try {
        const checkResponse = await axios.get(`/api/projects/${project.id}/check-item-completion`);
        if (checkResponse.data.success && !checkResponse.data.allItemsCompleted) {
          setPendingSaveData(saveData);
          setConfirmDialogOpen(true);
          return;
        }
      } catch {
        // If check fails, proceed with save
      }
    }

    doSave(saveData);
  };

  const handlePrint = async () => {
    try {
      setDownloading("pdf");
      const response = await axios.get(`/api/projects/${project.id}/form-3a-pdf`, {
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

  const renderCell = (field: string) => {
    const value = formValues[field as keyof typeof formValues];
    if (viewMode === "edit") {
      if (field === "start_date" || field === "completion_date" || field === "actual_completion_date") {
        const dateValue = value && value !== "-"
          ? new Date(value).toLocaleDateString("en-CA")
          : "";
        return (
          <Input
            type="date"
            value={dateValue}
            onChange={(e) => {
              if (!e.target.value) return;
              const [y, m, d] = e.target.value.split("-");
              const dt = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
              handleInputChange(field, dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }));
            }}
            className="h-7 text-sm font-normal border-gray-300"
            {...(field === "actual_completion_date" && { max: new Date().toISOString().split('T')[0] })}
          />
        );
      }
      if (field === "details_correct") {
        return (
          <SelectField
            value={value}
            onChange={(v) => handleInputChange(field, v)}
            options={[
              { label: "YES", value: "YES" },
              { label: "NO", value: "NO" },
            ]}
          />
        );
      }
      return (
        <Input
          value={value}
          onChange={(e) => handleInputChange(field, e.target.value)}
          className="h-7 text-sm font-normal border-gray-300"
        />
      );
    }
    return <span>{value}</span>;
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full overflow-hidden pt-4 print:p-0">
      <div className="bg-white flex flex-col gap-4 overflow-hidden">
        <div className="flex items-center justify-end px-4 md:px-6 pt-2 print:hidden">
          <div className="flex items-center gap-2">
            {!isCompleted && (
              <>
                <div className="flex bg-slate-100 rounded-lg p-1">
                  <Button
                    type="button"
                    variant={viewMode === "edit" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("edit")}
                    className="gap-1"
                  >
                    <Edit3 className="h-3 w-3" />
                    <span>Edit</span>
                  </Button>
                  <Button
                    type="button"
                    variant={viewMode === "preview" ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setViewMode("preview")}
                    className="gap-1"
                  >
                    <Eye className="h-3 w-3" />
                    <span>Preview</span>
                  </Button>
                </div>
                <Button onClick={handleSave} disabled={loading} size="sm" className="shadow-md">
                  {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </Button>
              </>
            )}
            <Button onClick={handlePrint} disabled={downloading !== null} variant="outline" size="sm" className="gap-1.5">
              {downloading === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              Print
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-center px-4 md:px-6">
          <div className="text-center">
            <h1 className="text-xl font-bold uppercase tracking-wider">Form No 3-A</h1>
            <p className="text-sm text-muted-foreground">Referred to in Rule No. 5 B S(ii)</p>
            <p className="text-sm font-medium mt-1">Work-Wise Details of Work Completed or In Progress By The Contractor</p>
          </div>
        </div>

        <div className="rounded-md border overflow-hidden mx-4 md:mx-6 mb-4 md:mb-6">
          <table className="w-full text-sm border-collapse">
            <tbody className="divide-y">
              <tr>
                <td className="p-3 w-[40px] text-center font-medium bg-slate-50 align-top border-r">1.</td>
                <td className="p-3 border-r w-[380px] font-medium bg-slate-50 align-top">Name Of Contractor</td>
                <td className="p-3">{renderCell("company_name")}</td>
              </tr>
              <tr>
                <td className="p-3 w-[40px] text-center font-medium bg-slate-50 align-top border-r">2.</td>
                <td className="p-3 border-r font-medium bg-slate-50 align-top">Name Of The Work</td>
                <td className="p-3">{renderCell("name_of_work")}</td>
              </tr>
              <tr>
                <td className="p-3 w-[40px] text-center font-medium bg-slate-50 align-top border-r">3.</td>
                <td className="p-3 border-r font-medium bg-slate-50 align-top">Estimate Cost Of Work Put To Tender</td>
                <td className="p-3">{renderCell("estimate_cost")}</td>
              </tr>
              <tr>
                <td className="p-3 w-[40px] text-center font-medium bg-slate-50 align-top border-r">4.</td>
                <td className="p-3 border-r font-medium bg-slate-50 align-top">Tender Amount</td>
                <td className="p-3">{renderCell("tender_amount")}</td>
              </tr>
              <tr>
                <td className="p-3 w-[40px] text-center font-medium bg-slate-50 align-top border-r">5.</td>
                <td className="p-3 border-r font-medium bg-slate-50 align-top">Date Of Starting The Work</td>
                <td className="p-3">{renderCell("start_date")}</td>
              </tr>
              <tr>
                <td className="p-3 w-[40px] text-center font-medium bg-slate-50 align-top border-r">6.</td>
                <td className="p-3 border-r font-medium bg-slate-50 align-top">Date Of Completion Of Work As Per Contract Agreement</td>
                <td className="p-3">{renderCell("completion_date")}</td>
              </tr>
              <tr>
                <td className="p-3 w-[40px] text-center font-medium bg-slate-50 align-top border-r">7.</td>
                <td className="p-3 border-r font-medium bg-slate-50 align-top">Actual Work Completion Date</td>
                <td className="p-3">{renderCell("actual_completion_date")}</td>
              </tr>
              <tr>
                <td className="p-3 w-[40px] text-center font-medium bg-slate-50 align-top border-r">8.</td>
                <td className="p-3 border-r font-medium bg-slate-50 align-top">Amount Of Work Done Up To</td>
                <td className="p-3 pt-3">
                  {viewMode === "edit" ? (
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium">In Figure: </span>
                        <Input
                          value={formValues.work_done_figure}
                          onChange={(e) => handleInputChange("work_done_figure", e.target.value)}
                          className="h-7 text-sm font-normal border-gray-300 mt-1"
                        />
                      </div>
                      <div>
                        <span className="font-medium">In Words: </span>
                        <Input
                          value={formValues.work_done_words}
                          onChange={(e) => handleInputChange("work_done_words", e.target.value)}
                          className="h-7 text-sm font-normal border-gray-300 mt-1"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div><span className="font-medium">In Figure: </span>{formValues.work_done_figure}</div>
                      <div><span className="font-medium">In Words: </span>{formValues.work_done_words}</div>
                    </div>
                  )}
                  <div className="mt-40 text-end pr-5">
                    <div className="border-t border-black inline-block px-10 pt-1">
                      <div className="mt-1">Contractor Signature</div>
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td className="p-3 w-[40px] text-center font-medium bg-slate-50 align-top border-r text-sm leading-relaxed">9.</td>
                <td className="p-3 border-r font-medium bg-slate-50 align-top text-sm leading-relaxed">
                  State Whether the details as above, given by
                  the Contractor are Correct, In not state as to
                  what is the correct information
                </td>
                <td className="p-3 align-middle font-semibold">{renderCell("details_correct")}</td>
              </tr>
              <tr>
                <td className="p-3 w-[40px] text-center font-medium bg-slate-50 align-top border-r text-sm leading-relaxed">10.</td>
                <td className="p-3 border-r font-medium bg-slate-50 align-top text-sm leading-relaxed">
                  State Whether the Contractor has Executed
                  the "Work In Progress" Satisfaction / Has
                  Completed the Work Satisfactory as per
                  Specification. If Not given the Correct,
                  Position of The Work.
                </td>
                <td className="p-3 align-middle font-semibold">{renderCell("work_status")}</td>
              </tr>
              <tr>
                <td className="p-3 w-[40px] text-center font-medium bg-slate-50 align-top border-r text-sm leading-relaxed">11.</td>
                <td className="p-3 border-r font-medium bg-slate-50 align-top text-sm leading-relaxed">
                  Any Other Remarks
                </td>
                <td className="p-3 align-top">{renderCell("remarks")}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mx-4 md:mx-6 mb-4">
          <div className="text-sm">Date: </div>
        </div>
      </div>

      <Dialog open={confirmDialogOpen} onOpenChange={(open) => { if (!open) setConfirmDialogOpen(false); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              Project Not Fully Completed
            </DialogTitle>
            <DialogDescription className="pt-2">
              Are you sure you want to mark this project as completed? Some project item quantities are still pending in Purchase Entries. The project work does not appear to be fully completed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="default"
              onClick={() => {
                setConfirmDialogOpen(false);
                if (pendingSaveData) {
                  doSave(pendingSaveData);
                }
              }}
            >
              Yes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        }
      `}</style>
    </div>
  );
}
