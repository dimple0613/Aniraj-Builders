"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import axios from "axios";
import { useRouter } from "next/navigation";
import { DataTable, Column } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, MoreHorizontal, Eye, RotateCcw } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DropdownMenuSeparator } from "@radix-ui/react-dropdown-menu";
import { VardhiDailyReport, ApprovedByRange } from "@/types/bill-generated";
import { STAGES, StageConfig, StageData } from "@/lib/constants/stage-constants";
import StageChangePopup from "./stage-change-popup";
import BillTrackingStageSummary from "./bill-tracking-stage-summary";

export function VardhiDailyReportClient() {
    const [data, setData] = useState<VardhiDailyReport[]>([]);
    const [loading, setLoading] = useState(false);
    const [deleteItem, setDeleteItem] = useState<VardhiDailyReport | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [returnToSummaryItem, setReturnToSummaryItem] = useState<VardhiDailyReport | null>(null);
    const [returnToSummaryLoading, setReturnToSummaryLoading] = useState(false);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
    const [approvedByRanges, setApprovedByRanges] = useState<ApprovedByRange[]>([]);
    const [search, setSearch] = useState("");
    const [monthFilter, setMonthFilter] = useState<string>("");
    const [stagePopup, setStagePopup] = useState<{
        open: boolean;
        estimationId: string;
        currentStage: StageConfig;
        stageData: StageData;
        isViewOnly: boolean;
    }>({
        open: false,
        estimationId: "",
        currentStage: STAGES[0],
        stageData: {},
        isViewOnly: false,
    });
    const [stageSummaryKey, setStageSummaryKey] = useState(0);
    const router = useRouter();

    const fetchData = useCallback(
        async (page = 1, searchVal = search, monthVal = monthFilter) => {
            try {
                setLoading(true);
                const params = new URLSearchParams({
                    page: page.toString(),
                    limit: "10",
                    ...(searchVal && { search: searchVal }),
                    ...(monthVal && { month: monthVal }),
                });
                const response = await axios.get(`/api/bill-generated?${params}`);
                setData(response.data?.data || response.data || []);
                if (response.data?.pagination) {
                    setPagination({
                        page: response.data.pagination.page,
                        totalPages: response.data.pagination.pages,
                    });
                }
                setApprovedByRanges(response.data?.pagination?.approved_by_ranges || []);
            } catch {
                toast.error("Failed to fetch bill tracking");
            } finally {
                setLoading(false);
            }
        },
        [search, monthFilter]
    );

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const grandTotal = useMemo(() => {
        if (!data || data.length === 0) return 0;
        return data.reduce((sum, bill) => {
            const amount = Number(bill.total_amount) || 0;
            return sum + amount;
        }, 0);
    }, [data]);

    const totalCount = useMemo(() => {
        return data.length;
    }, [data]);

    const confirmDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            await axios.delete(`/api/bill-generated/${deleteItem.id}`);
            toast.success("Bill Tracking deleted successfully");
            fetchData(pagination.page, search, monthFilter);
            setDeleteItem(null);
        } catch (e: any) {
            toast.error(e.response?.data?.error || "Failed to delete estimation");
        } finally {
            setDeleteLoading(false);
        }
    };

    const confirmReturnToSummary = async () => {
        if (!returnToSummaryItem) return;
        try {
            setReturnToSummaryLoading(true);
            await axios.post(`/api/bill-generated/${returnToSummaryItem.id}/stage/reset`);
            toast.success("Removed from Vardhi estimation");
            fetchData(pagination.page, search, monthFilter);
            setStageSummaryKey(prev => prev + 1);
            setReturnToSummaryItem(null);
        } catch (e: any) {
            toast.error(e.response?.data?.error || "Failed to return to summary");
        } finally {
            setReturnToSummaryLoading(false);
        }
    };

    const getStageByKey = (key: string | null | undefined): StageConfig => {
        if (key) {
            const found = STAGES.find(s => s.key === key);
            if (found) return found;
        }
        return STAGES[0];
    };

    const getCurrentStage = (item: VardhiDailyReport): StageConfig => {
        return getStageByKey(item.current_stage);
    };

    const getNextStage = (item: VardhiDailyReport): StageConfig => {
        const currentStage = getCurrentStage(item);
        const currentIndex = STAGES.findIndex(s => s.key === currentStage.key);

        if (currentIndex === -1 || currentIndex >= STAGES.length - 1) {
            return STAGES[STAGES.length - 1];
        }

        return STAGES[currentIndex + 1];
    };

    const getStageData = (item: VardhiDailyReport): StageData => {
        return {
            file_submitted_date: item.file_submitted_date,
            store_report_date: item.store_report_date,
            submitted_for_approved_date: item.submitted_for_approved_date,
            approved_date: item.approved_date,
            approved_no: item.approved_no,
            bill_prepaid_date: item.bill_prepaid_date,
            bill_audit_date: item.bill_audit_date,
            bill_account_date: item.bill_account_date,
            payment_received_date: item.payment_received_date,
        };
    };

    const handleOpenStagePopup = async (item: VardhiDailyReport) => {
        try {
            // Always fetch fresh data from server
            const response = await axios.get(`/api/bill-generated/${item.id}/stage`);
            const freshData: any = response.data?.data || {};

            // Get current_stage from DB (the NEXT stage to complete)
            const dbCurrentStage = freshData.current_stage || 'file_submitted';

            // Find the index of the current stage in our STAGES array
            const currentStageIndex = STAGES.findIndex(s => s.key === dbCurrentStage);

            let stageToUpdate: StageConfig;
            let isViewOnly = false;

            if (currentStageIndex === -1) {
                // Stage not found, default to first stage
                stageToUpdate = STAGES[0];
            } else if (currentStageIndex >= STAGES.length - 1) {
                // At final stage - ONLY mark as view-only if payment_received_date is filled
                stageToUpdate = STAGES[STAGES.length - 1];
                isViewOnly = !!freshData.payment_received_date;
            } else {
                // Show current stage (which is the next to complete)
                stageToUpdate = STAGES[currentStageIndex];
            }

            setStagePopup({
                open: true,
                estimationId: item.id,
                currentStage: stageToUpdate,
                stageData: freshData as StageData,
                isViewOnly,
            });
        } catch (error) {
            toast.error("Failed to fetch stage data");
        }
    };

    const columns: Column<VardhiDailyReport>[] = [
        {
            header: "Zone",
            accessorKey: "zone",
            cell: (item) => <span className="">{item.zone_no || "—"}</span>,
        },
        {
            header: "Bill Tracking No",
            accessorKey: "estimation_no",
            cell: (item) => (
                <Badge variant="outline" className="font-mono  px-1.5 py-0">
                    {item.estimation_no}
                </Badge>
            ),
        },
        {
            header: "Contractor",
            accessorKey: "contractor",
            cell: (item) => <span className="">{item.contractor}</span>
        },
        {
            header: "Work Name",
            accessorKey: "work_name",
            cell: (item) => (
                <span className="max-w-[200px] block truncate font-medium" title={item.work_name}>
                    {item.work_name}
                </span>
            ),
        },
        {
            header: "Month-Year",
            accessorKey: "created_at",
            cell: (item) => {
                if (!item.created_at) return <span>—</span>;

                const date = new Date(item.created_at);

                const formatted = date
                    .toLocaleDateString("en-US", { month: "short", year: "2-digit" })
                    .toUpperCase()
                    .replace(" ", "-");

                return <span>{formatted}</span>;
            },
        },
        {
            header: "Final Total",
            accessorKey: "total_amount",
            cell: (item) => (
                <span className="font-semibold">
                    ₹ {Number(item.total_amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
            ),
        },
        {
            header: "Approved By",
            accessorKey: "approved_by",
            cell: (item) => {
                const total = Number(item.total_amount || 0);
                let approvedBy = "—";
                if (approvedByRanges && approvedByRanges.length > 0) {
                    const match = approvedByRanges.find(
                        (range) => total >= Number(range.amount_from) && total <= Number(range.amount_to)
                    );
                    if (match) {
                        approvedBy = match.name;
                    }
                }
                return <span className="font-medium">{approvedBy}</span>;
            },
        },
        {
            header: "Current Stage",
            accessorKey: "current_stage",
            cell: (item: VardhiDailyReport) => {
                // current_stage from DB is the NEXT stage to complete
                const dbStage = item.current_stage || 'file_submitted';
                const stage = getStageByKey(dbStage);
                const currentIndex = STAGES.findIndex(s => s.key === dbStage);
                const isFinalStage = currentIndex >= STAGES.length - 1;
                // Only show "View" if final stage AND payment_received_date is filled
                const isViewOnly = isFinalStage && !!item.payment_received_date;

                return (
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">{stage.label}</span>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="!p-2 !text-blue-500 hover:!text-blue-700 hover:!bg-blue-50 rounded-full transition-all  rounded-md transition-all !bg-blue-50 !text-blue-700 "
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenStagePopup(item);
                                }}
                            >
                                {isViewOnly ? (
                                    <Eye className="w-4 h-4" />
                                ) : (
                                    <Pencil className="w-4 h-4" />
                                )}
                            </Button>

                        </div>
                        {
                            item?.approved_no ?
                                <span className="text-xs text-muted-foreground">
                                    No: {item?.approved_no || '-'} | Date: {item.approved_date ? new Date(item.approved_date).toLocaleDateString("en-GB", {
                                        day: "numeric",
                                        month: "long",
                                        year: "numeric",
                                    }) : '-'}
                                </span>
                                : null
                        }
                    </div>
                );
            },
        },
        {
            header: "Actions",
            accessorKey: "actions",
            cell: (item) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                        align="end"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <DropdownMenuItem
                            onClick={() => router.push(`/bill-generated/${item.id}`)}
                        >
                            <Eye className="mr-2 h-4 w-4" />
                            View
                        </DropdownMenuItem>

                        <DropdownMenuItem
                            onClick={() => setReturnToSummaryItem(item)}
                        >
                            <RotateCcw className="mr-2 h-4 w-4" />
                            Return to Summary
                        </DropdownMenuItem>

                        {/* <DropdownMenuItem
                            onClick={() => router.push(`/bill-generated/edit/${item.id}`)}
                        >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem> */}

                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteItem(item)}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    return (
        <div className="flex-1 flex flex-col gap-6">


            <BillTrackingStageSummary refreshKey={stageSummaryKey} />

            <div className="flex flex-col lg:flex-row gap-6">
                <div className="flex-1 min-w-0">
                    <DataTable
                        data={data}
                        columns={columns}
                        loading={loading}
                        pagination={pagination}
                        onPageChange={(page) => fetchData(page, search, monthFilter)}
                        onSearch={(val) => {
                            setSearch(val);
                            fetchData(1, val, monthFilter);
                        }}
                    />
                </div>

                {/* <div className="w-full lg:w-72 shrink-0">
                    <div className="sticky top-20 bg-muted/30 rounded-lg border p-4 space-y-4">
                        <h3 className="text-sm font-semibold text-foreground">Bill Summary</h3>
                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <span className="text-sm text-muted-foreground">Total Bills</span>
                                <span className="text-sm font-medium">{totalCount}</span>
                            </div>
                            <div className="border-t pt-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">Grand Total</span>
                                    <span className="text-lg font-bold text-primary">
                                        ₹ {grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div> */}
            </div>

            <Dialog
                open={!!deleteItem}
                onOpenChange={(open) => {
                    if (!open) setDeleteItem(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Bill Tracking</DialogTitle>
                    </DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to delete estimation{" "}
                        <strong>{deleteItem?.estimation_no}</strong>?{" "}
                        This will remove all items. This action cannot be undone.
                    </DialogDescription>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteItem(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDelete}
                            disabled={deleteLoading}
                        >
                            {deleteLoading ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!returnToSummaryItem}
                onOpenChange={(open) => {
                    if (!open) setReturnToSummaryItem(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Return to Summary</DialogTitle>
                    </DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to return this bill to summary?
                    </DialogDescription>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setReturnToSummaryItem(null)}>
                            Cancel
                        </Button>
                        <Button
                            onClick={confirmReturnToSummary}
                            disabled={returnToSummaryLoading}
                        >
                            {returnToSummaryLoading ? "Processing..." : "Return to Summary"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <StageChangePopup
                open={stagePopup.open}
                onOpenChange={(open) => setStagePopup((prev) => ({ ...prev, open }))}
                estimationId={stagePopup.estimationId}
                currentStage={stagePopup.currentStage}
                stageData={stagePopup.stageData}
                isViewOnly={stagePopup.isViewOnly}
                onSuccess={() => {
                    fetchData(pagination.page, search, monthFilter);
                    setStageSummaryKey(prev => prev + 1);
                }}
            />
        </div>
    );
}
