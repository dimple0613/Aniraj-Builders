'use client';

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Card } from '@/components/ui/card';
import { formatIndianCurrency } from '@/lib/financial-year';

interface StageSummaryProps {
    refreshKey?: number;
}

interface StageSummaryItem {
    key: string;
    label: string;
    amount: number;
    count: number;
}

interface GrandTotalData {
    grandTotal: number;
    count: number;
}

const stageIcons: Record<string, React.ReactNode> = {
    file_submitted: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
            <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <path d="M14 2v4a2 2 0 0 0 2 2h4" />
        </svg>
    ),
    store_report: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-indigo-500">
            <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
            <path d="M2 7h20" />
            <path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63" />
        </svg>
    ),
    submitted_for_approved: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500">
            <rect width="8" height="4" x="8" y="2" rx="1" ry="1" />
            <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        </svg>
    ),
    approved: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500">
            <path d="M20 6 9 17l-5-5" />
        </svg>
    ),
    bill_prepaid: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500">
            <path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z" />
            <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
            <path d="M12 17.5v-11" />
        </svg>
    ),
    bill_audit: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-yellow-500">
            <path d="M3 3v18h18" />
            <path d="m19 9-5 5-4-4-3 3" />
        </svg>
    ),
    bill_account: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-cyan-500">
            <path d="M12 20V10" />
            <path d="M18 20V4" />
            <path d="M6 20v-4" />
        </svg>
    ),
    payment_received: (
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500">
            <path d="M12 2v20" />
            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
    ),
};

export default function BillTrackingStageSummary({ refreshKey = 0 }: StageSummaryProps) {
    const [stageData, setStageData] = useState<StageSummaryItem[]>([]);
    const [grandTotalData, setGrandTotalData] = useState<GrandTotalData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [stageResponse, grandTotalResponse] = await Promise.all([
                    axios.get('/api/bill-generated/stage-summary'),
                    axios.get('/api/bill-generated/grand-total'),
                ]);
                setStageData(stageResponse.data?.data || []);
                setGrandTotalData(grandTotalResponse.data?.data || null);
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [refreshKey]);

    const formattedGrandTotal = useMemo(() => {
        if (!grandTotalData?.grandTotal) return '₹ 0';
        return `₹ ${formatIndianCurrency(grandTotalData.grandTotal)}`;
    }, [grandTotalData]);

    if (loading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 md:grid-cols-8">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <Card key={i} className="h-20 animate-pulse bg-muted" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Bill Tracking</h2>
                </div>
                <div className="flex items-center gap-2">
                    {grandTotalData && (
                        formattedGrandTotal
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {stageData.map((stage) => (
                    <Card
                        key={stage.key}
                        className="flex flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground truncate pr-1">{stage.label}</span>
                            {stageIcons[stage.key]}
                        </div>
                        <div className="text-lg font-bold tabular-nums">
                            ₹ {formatIndianCurrency(stage.amount)}
                        </div>
                        <div className="text-[10px] text-muted-foreground">
                            {stage.count} {stage.count === 1 ? 'entry' : 'entries'}
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}
