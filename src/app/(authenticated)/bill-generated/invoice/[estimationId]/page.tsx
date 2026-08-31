import { getVardhiEstimationForInvoice, getInvoiceByEstimation } from "@/app/actions/vardhi-invoice-actions";
import VardhiInvoiceForm from "@/components/bill-generated/invoice/vardhi-invoice-form";
import { notFound } from "next/navigation";

interface Props {
    params: Promise<{
        estimationId: string;
    }>;
}

export default async function VardhiInvoicePage({ params }: Props) {
    const { estimationId } = await params;
    // Fetch estimation data
    const estimation = await getVardhiEstimationForInvoice(estimationId);
    if (!estimation) {
        return notFound();
    }

    // Check if invoice already exists for this estimation
    const existingInvoice = await getInvoiceByEstimation(estimationId);

    return (
        <VardhiInvoiceForm
            estimation={JSON.parse(JSON.stringify(estimation))}
            existingInvoice={existingInvoice ? JSON.parse(JSON.stringify(existingInvoice)) : undefined}
        />
    );
}
