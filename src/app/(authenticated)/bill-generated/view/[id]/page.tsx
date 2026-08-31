import VardhiDailyReportForm from "@/components/bill-generated/vardhi-daily-report-form";

interface Props {
    params: Promise<{ id: string }>;
}

export default async function ViewVardhiEstimationPage({ params }: Props) {
    const resolvedParams = await params;
    return (
        <VardhiDailyReportForm estimationId={resolvedParams.id} isViewOnly={true} />
    );
}