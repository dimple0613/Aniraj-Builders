"use client";

import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { STAGES, StageData, StageConfig } from "@/lib/constants/stage-constants";

export type { StageData, StageConfig };
export { STAGES };

interface StageChangePopupProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    estimationId: string;
    currentStage: StageConfig;
    stageData: StageData;
    isViewOnly?: boolean;
    onSuccess: () => void;
}

export default function StageChangePopup({
    open,
    onOpenChange,
    estimationId,
    currentStage,
    stageData,
    isViewOnly = false,
    onSuccess,
}: StageChangePopupProps) {
    const [date, setDate] = useState("");
    const [approvedNo, setApprovedNo] = useState("");
    const [loading, setLoading] = useState(false);
    const [reason, setReason] = useState("");
    const [isReverting, setIsReverting] = useState(false);

    const getPreviousStage = () => {
        const currentIndex = STAGES.findIndex(s => s.key === currentStage.key);
        if (currentIndex > 0) {
            return STAGES[currentIndex - 1];
        }
        return null;
    };

    const previousStage = getPreviousStage();

    const progress = useMemo(() => {
        let filled = 0;
        const total = STAGES.length;

        STAGES.forEach(stage => {
            if (stageData[stage.dateField]) {
                filled++;
            }
        });

        return total > 0 ? Math.round((filled / total) * 100) : 0;
    }, [stageData]);

    useEffect(() => {
        if (open && currentStage) {
            const existingDate = stageData[currentStage.dateField];
            setDate(existingDate ? new Date(existingDate).toISOString().split('T')[0] : "");
            setApprovedNo(stageData.approved_no || "");
            setIsReverting(false);
            setReason("");
        }
    }, [open, currentStage, stageData]);

    useEffect(() => {
        if (isReverting && previousStage) {
            const prevDate = stageData[previousStage.dateField];
            setDate(prevDate ? new Date(prevDate).toISOString().split('T')[0] : "");
        }
    }, [isReverting, previousStage, stageData]);

    const handleSubmit = async () => {
        if (!date) {
            toast.error("Please select a date");
            return;
        }

        if (currentStage.needsApprovedNo && !approvedNo) {
            toast.error("Please enter Approved No.");
            return;
        }

        try {
            setLoading(true);
            await axios.patch(`/api/bill-generated/${estimationId}/stage`, {
                stage: currentStage.dateField,
                date,
                ...(currentStage.needsApprovedNo ? { approved_no: approvedNo } : {}),
            });
            toast.success(`${currentStage.label} updated successfully`);
            onOpenChange(false);
            onSuccess();
            setDate("");
            setApprovedNo("");
            setIsReverting(false);
            setReason("");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to update stage");
        } finally {
            setLoading(false);
        }
    };

    const handleRevert = async () => {
        if (!previousStage) return;
        if (!reason.trim()) {
            toast.error("Reason is required to move to previous stage.");
            return;
        }

        try {
            setLoading(true);
            await axios.patch(`/api/bill-generated/${estimationId}/stage/revert`, {
                stage: currentStage.dateField,
                prevStage: previousStage.dateField,
                reason: reason.trim(),
                date: date ? new Date(date).toISOString() : null,
            });
            toast.success(`Reverted to ${previousStage.label}`);
            onOpenChange(false);
            onSuccess();
            setReason("");
            setDate("");
            setApprovedNo("");
            setIsReverting(false);
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to revert stage");
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string | null | undefined) => {
        if (!dateStr) return "—";
        return new Date(dateStr).toLocaleDateString("en-GB");
    };

    const getStageStatus = (stage: StageConfig) => {
        const stageDate = stageData[stage.dateField];
        if (isReverting && previousStage && stage.key === previousStage.key) return "current";
        if (stageDate) return "completed";
        if (stage.key === currentStage.key && !isReverting) return "current";
        return "pending";
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <div className="-mx-6">
                    <div className="w-full h-1.5 bg-muted bg-red-500 rounded-full overflow-hidden -mt-[24px]">
                        <div
                            className="h-full bg-blue-600 transition-all duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
                <DialogHeader>
                    <DialogTitle>
                        {isViewOnly ? "View Stage Progress" : (isReverting && previousStage ? `Revert to ${previousStage.label}` : `Update ${currentStage.label}`)}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="text-sm text-muted-foreground mb-4">
                        <p className="font-medium text-foreground mb-2">Stage Timeline:</p>
                        <div className="space-y-1">
                            {STAGES.map((stage, index) => {
                                const status = getStageStatus(stage);
                                const stageDate = stageData[stage.dateField];

                                return (
                                    <div
                                        key={stage.key}
                                        className={`flex items-center gap-2 text-xs ${status === "current"
                                            ? isReverting
                                                ? "font-semibold text-black"
                                                : "font-semibold text-primary"
                                            : status === "completed"
                                                ? "text-green-600"
                                                : "text-muted-foreground"
                                            }`}
                                    >
                                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${status === "current"
                                            ? isReverting
                                                ? "bg-black text-white"
                                                : "bg-primary text-primary-foreground"
                                            : status === "completed"
                                                ? "bg-green-500 text-white"
                                                : "bg-gray-200 text-gray-500"
                                            }`}>
                                            {index + 1}
                                        </span>
                                        <span className="flex-1">{stage.label}</span>
                                        <span>{formatDate(stageDate as string | null | undefined)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {isReverting && previousStage ? (
                        <div className="space-y-3">
                            <div className="space-y-2">
                                <Label htmlFor="prevStageDate">
                                    {previousStage.label.replace(/([A-Z])/g, " $1").trim()} Date
                                </Label>
                                <Input
                                    id="prevStageDate"
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="revertReason">
                                    Reason for reverting this stage <span className="text-red-500">*</span>
                                </Label>
                                <Textarea
                                    id="revertReason"
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Enter reason..."
                                    className="w-full"
                                    rows={3}
                                />
                                {!reason.trim() && reason !== "" && (
                                    <p className="text-xs text-red-500">Reason is required to move to previous stage.</p>
                                )}
                            </div>
                        </div>
                    ) : !isViewOnly ? (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-medium">
                                    {currentStage.label.replace(/([A-Z])/g, " $1").trim()} Date
                                </label>
                                <Input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full"
                                />
                            </div>

                            {currentStage.needsApprovedNo && (
                                <div className="space-y-2">
                                    <label className="text-sm font-medium">Approved No.</label>
                                    <Input
                                        type="text"
                                        value={approvedNo}
                                        onChange={(e) => setApprovedNo(e.target.value)}
                                        placeholder="Enter Approved No."
                                        className="w-full"
                                    />
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-sm text-green-700 font-medium">All stages completed!</p>
                            <p className="text-xs text-green-600 mt-1">
                                Payment has been received. This is the final stage.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter className="justify-between">
                    <div className="flex justify-between w-full gap-2">
                        {!isViewOnly && previousStage && !isReverting && (
                            <Button
                                size="sm"
                                className="bg-red-500 text-white hover:bg-red-600"
                                onClick={() => {
                                    setIsReverting(true);
                                    setReason("");
                                }}
                            >
                                Previous Stage
                            </Button>
                        )}
                        {isReverting && (
                            <Button
                                variant="outline"
                                size="sm"

                                onClick={() => {
                                    setIsReverting(false);
                                    setReason("");
                                    setDate("");
                                }}
                            >
                                Back
                            </Button>
                        )}
                    </div>
                    {!isViewOnly && (
                        isReverting ? (
                            <Button
                                onClick={handleRevert}
                                disabled={loading}
                                className="bg-green-600 text-white hover:bg-green-700"
                            >
                                {loading ? "Saving..." : "Forward Stage"}
                            </Button>
                        ) : (
                            <Button onClick={handleSubmit} disabled={loading}>
                                {loading ? "Saving..." : "Save"}
                            </Button>
                        )
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}