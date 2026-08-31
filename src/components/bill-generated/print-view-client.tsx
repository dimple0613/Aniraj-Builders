"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Printer } from "lucide-react";
import { VardhiDailyReport } from "@/types/bill-generated";
import axios from "axios";
import { toast } from "sonner";
import { PDFDocument } from "pdf-lib";

interface Props {
    estimation: VardhiDailyReport & { items: any[] };
    invoice?: { id: string; invoice_no: string } | null;
    type?: any;
}

export default function PrintViewClient({ estimation, type }: Props) {
    const [downloading, setDownloading] = useState<string | null>(null);

    // Reusable PDF opener & printer
    const openAndPrint = async (url: string) => {
        try {
            const response = await axios.get(url, { responseType: "blob" });
            const blob = new Blob([response.data], { type: "application/pdf" });
            const pdfUrl = URL.createObjectURL(blob);

            const printWindow = window.open(pdfUrl, "_blank");
            if (printWindow) {
                printWindow.onload = () => {
                    printWindow.focus();
                    setTimeout(() => {
                        printWindow.print();
                    }, 500);
                };
            }
        } catch {
            toast.error("Failed to print document");
        }
    };

    // Print all PDFs in specific order
    const handlePrintAll = async () => {
        try {
            setDownloading("print-all");
            toast.info("Preparing all documents for printing...");

            let gujaratiUrl = `/api/bill-generated/${estimation.id}/gujarati-document-pdf`;
            const storedData = sessionStorage.getItem(`gujarati-doc-${estimation.id}`);
            let defaultValues: any = null;
            
            if (storedData) {
                const parsed = JSON.parse(storedData);
                defaultValues = {
                    work_summary: parsed.row1Value,
                    work_requirement: parsed.row2Value,
                    plot_ownership: parsed.row3Value,
                    work_type: parsed.row4Value,
                    is_duplicate_work: parsed.row5Value,
                    estimated_cost_details: parsed.row6Value,
                    approving_authority: parsed.row7Value,
                    cost_head: parsed.row8Value,
                    work_method: parsed.row9Value,
                    work_deadline: parsed.row10Value,
                    is_work_completed_on_time: parsed.row11Value,
                    registration_class: parsed.row12Value,
                    emd_details: parsed.row13Value,
                    bid_validity: parsed.row14Value,
                    liability_period: parsed.row15Value,
                    gfr_pwd_compliance: parsed.row16Value,
                    is_single_tender: parsed.row17Value,
                    single_tender_efforts: parsed.row18Value,
                    negotiation_feedback: parsed.row19Value,
                    work_agency: parsed.row20Value,
                    hod_certificate_no_duplicate: parsed.row21Value,
                };
            } else {
                const zoneNum = estimation.zone_no ? String(estimation.zone_no).replace(/\d/g, d => '૦૧૨૩૪૫૬૭૮૯'[parseInt(d)]) : 'zone';
                defaultValues = {
                    work_summary: `${zoneNum} માં પાણીની લાઈનના મરામત કામ`,
                    work_requirement: `વોટર ઝોન ${zoneNum} માં પાણીની લાઇનના ખુબ અગત્યના અને જરૂરી અલગ અલગ સ્થળોએ પ્રકરણે દર્શાવેલ મુજબ મરામત કામ કરાવેલ છે`,
                    plot_ownership: "ભાવનગર મહાનગરપાલિકા",
                    work_type: "મેન્ટેનન્સ કામ (વાર્ષિક ભાવથી)",
                    is_duplicate_work: "ના",
                    estimated_cost_details: `ખર્ચ પત્ર મુજબ રૂ. ${estimation.total_amount ? Number(estimation.total_amount)?.toFixed(2) : '0'}/- નો ખર્ચ થયેલ છે`,
                    approving_authority: "માન. નાયબ કમિશનર સાહેબશ્રી",
                    cost_head: "મેન્ટેનન્સ કામ",
                    work_method: "લાગુ નથી",
                    work_deadline: "લાગુ નથી",
                    is_work_completed_on_time: "લાગુ નથી",
                    registration_class: "લાગુ નથી",
                    emd_details: "લાગુ નથી",
                    bid_validity: "લાગુ નથી",
                    liability_period: "લાગુ નથી",
                    gfr_pwd_compliance: "લાગુ નથી",
                    is_single_tender: "લાગુ નથી",
                    single_tender_efforts: "લાગુ નથી",
                    negotiation_feedback: "લાગુ નથી",
                    work_agency: estimation.contractor || "શ્રી અનિરાજ બિલ્ડર્સ",
                    hod_certificate_no_duplicate: "કામનું ડુપ્લીકેશન થતું નથી",
                };
            }
            
            const encoded = encodeURIComponent(JSON.stringify(defaultValues));
            gujaratiUrl += `?defaultValues=${encoded}`;

            const documentConfig = [
                { url: gujaratiUrl, copies: 1 },
                { url: `/api/bill-generated/${estimation.id}/daily-report-pdf`, copies: 1 },
                { url: `/api/bill-generated/${estimation.id}/manjuri-pdf`, copies: 1 },
                { url: `/api/bill-generated/${estimation.id}/estimation-pdf`, copies: 2 },
                { url: `/api/bill-generated/invoice/${estimation.id}/download`, copies: 1 },
            ];

            const mergedPdf = await PDFDocument.create();
            let addedFiles = 0;

            for (const config of documentConfig) {
                try {
                    const response = await axios.get(config.url, { responseType: "arraybuffer" });
                    const pdf = await PDFDocument.load(response.data);
                    for (let i = 0; i < config.copies; i++) {
                        const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
                        pages.forEach((page) => mergedPdf.addPage(page));
                    }
                    addedFiles++;
                } catch {
                    console.error("Skipping missing PDF:", config.url);
                }
            }

            if (addedFiles === 0) {
                toast.error("No documents available for printing");
                return;
            }

            const mergedBytes: any = await mergedPdf.save();
            const blob = new Blob([mergedBytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);

            // Open the merged PDF directly instead of blank page
            const printWindow = window.open(url, "_blank");
            if (printWindow) {
                printWindow.onload = () => {
                    printWindow.focus();
                    setTimeout(() => {
                        printWindow.print();
                    }, 500);
                };
            } else {
                toast.error("Please allow popups to print");
            }

            toast.success(`${addedFiles} documents ready for printing`);
        } catch (error) {
            console.error(error);
            toast.error("Failed to prepare documents for printing");
        } finally {
            setDownloading(null);
        }
    };

    const handleDownloadInvoicePDF = async () => {
        setDownloading("download-invoice");
        await openAndPrint(`/api/bill-generated/invoice/${estimation.id}/download`);
        toast.success("Invoice PDF opened for printing");
        setDownloading(null);
    };

    const handleDownloadPDF = async () => {
        try {
            setDownloading("pdf");

            // Inform the user that the PDF is being prepared
            toast("Preparing two copies of the Estimation PDF...", {
                description: "This may take a few seconds. Please do not close the window."
            });

            // Fetch the estimation PDF
            const response = await axios.get(`/api/bill-generated/${estimation.id}/estimation-pdf`, {
                responseType: "arraybuffer",
            });

            // Load PDF and create a new document for two copies
            const pdf = await PDFDocument.load(response.data);
            const mergedPdf = await PDFDocument.create();

            // Get page indices and copy pages twice for 2 copies
            const pageIndices = pdf.getPageIndices();
            for (let copy = 0; copy < 2; copy++) {
                const pages = await mergedPdf.copyPages(pdf, pageIndices);
                pages.forEach((page) => mergedPdf.addPage(page));
            }

            // Generate blob URL for printing
            const mergedBytes: any = await mergedPdf.save();
            const blob = new Blob([mergedBytes], { type: "application/pdf" });
            const url = URL.createObjectURL(blob);

            const printWindow = window.open(url, "_blank");
            if (printWindow) {
                printWindow.onload = () => {
                    printWindow.focus();
                    setTimeout(() => {
                        printWindow.print();
                    }, 500);
                };

                toast.success("The Estimation PDF has been prepared with two copies and is ready for printing.");
            } else {
                toast.error("Unable to open print window. Please allow popups in your browser.");
            }
        } catch (error) {
            console.error(error);
            toast.error("An error occurred while preparing the Estimation PDF. Please try again.");
        } finally {
            setDownloading(null);
        }
    };

    const handleDownloadManjuri = async () => {
        setDownloading("manjuri");
        await openAndPrint(`/api/bill-generated/${estimation.id}/manjuri-pdf`);
        toast.success("Manjuri PDF opened for printing");
        setDownloading(null);
    };

    const handleDownloadDailyReport = async () => {
        setDownloading("daily-report");
        await openAndPrint(`/api/bill-generated/${estimation.id}/daily-report-pdf`);
        toast.success("Daily Report PDF opened for printing");
        setDownloading(null);
    };

    const handleDownloadGujaratiDocument = async () => {
        try {
            setDownloading("gujarati-doc");
            toast.info("Preparing Water Works Department PDF...", {
                description: "This may take a few seconds. Please do not close the window."
            });
            
            let url = `/api/bill-generated/${estimation.id}/gujarati-document-pdf`;
            const storedData = sessionStorage.getItem(`gujarati-doc-${estimation.id}`);
            let defaultValues: any = null;
            
            if (storedData) {
                const parsed = JSON.parse(storedData);
                defaultValues = {
                    work_summary: parsed.row1Value,
                    work_requirement: parsed.row2Value,
                    plot_ownership: parsed.row3Value,
                    work_type: parsed.row4Value,
                    is_duplicate_work: parsed.row5Value,
                    estimated_cost_details: parsed.row6Value,
                    approving_authority: parsed.row7Value,
                    cost_head: parsed.row8Value,
                    work_method: parsed.row9Value,
                    work_deadline: parsed.row10Value,
                    is_work_completed_on_time: parsed.row11Value,
                    registration_class: parsed.row12Value,
                    emd_details: parsed.row13Value,
                    bid_validity: parsed.row14Value,
                    liability_period: parsed.row15Value,
                    gfr_pwd_compliance: parsed.row16Value,
                    is_single_tender: parsed.row17Value,
                    single_tender_efforts: parsed.row18Value,
                    negotiation_feedback: parsed.row19Value,
                    work_agency: parsed.row20Value,
                    hod_certificate_no_duplicate: parsed.row21Value,
                };
            } else {
                const zoneNum = estimation.zone_no ? String(estimation.zone_no).replace(/\d/g, d => '૦૧૨૩૪૫૬૭૮૯'[parseInt(d)]) : 'zone';
                defaultValues = {
                    work_summary: `${zoneNum} માં પાણીની લાઈનના મરામત કામ`,
                    work_requirement: `વોટર ઝોન માં પાણીની લાઇનના ખુબ અગત્યના અને જરૂરી અલગ અલગ સ્થળોએ પ્રકરણે દર્શાવેલ મુજબ મરામત કામ કરાવેલ છે`,
                    plot_ownership: "ભાવનગર મહાનગરપાલિકા",
                    work_type: "મેન્ટેનન્સ કામ (વાર્ષિક ભાવથી)",
                    is_duplicate_work: "ના",
                    estimated_cost_details: `ખર્ચ પત્ર મુજબ રૂ. ${estimation.total_amount ? Number(estimation.total_amount)?.toFixed(2) : '0'}/- નો ખર્ચ થયેલ છે`,
                    approving_authority: "માન. નાયબ કમિશનર સાહેબશ્રી",
                    cost_head: "મેન્ટેનન્સ કામ",
                    work_method: "લાગુ નથી",
                    work_deadline: "લાગુ નથી",
                    is_work_completed_on_time: "લાગુ નથી",
                    registration_class: "લાગુ નથી",
                    emd_details: "લાગુ નથી",
                    bid_validity: "લાગુ નથી",
                    liability_period: "લાગુ નથી",
                    gfr_pwd_compliance: "લાગુ નથી",
                    is_single_tender: "લાગુ નથી",
                    single_tender_efforts: "લાગુ નથી",
                    negotiation_feedback: "લાગુ નથી",
                    work_agency: estimation.contractor || "શ્રી અનિરાજ બિલ્ડર્સ",
                    hod_certificate_no_duplicate: "કામનું ડુપ્લીકેશન થતું નથી",
                };
            }
            
            const encoded = encodeURIComponent(JSON.stringify(defaultValues));
            url += `?defaultValues=${encoded}`;
            
            await openAndPrint(url);
            toast.success("Water Works Department PDF opened for printing");
        } catch {
            toast.error("Failed to print Water Works Department");
        } finally {
            setDownloading(null);
        }
    };

    const handleDownloadVardhiDetails = async () => {
        try {
            setDownloading("vardhi-details");
            toast.info("Preparing Vardhi Details PDF...", {
                description: "This may take a few seconds. Please do not close the window."
            });
            await openAndPrint(`/api/bill-generated/${estimation.id}/vardhi-details-pdf`);
            toast.success("Vardhi Details PDF opened for printing");
        } catch {
            toast.error("Failed to print Vardhi Details");
        } finally {
            setDownloading(null);
        }
    };

    return (
        <div className="flex items-center gap-2 flex-wrap">
            {
                type == "report" ?
                    <Button
                        onClick={handleDownloadDailyReport}
                        disabled={downloading !== null}
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                    >
                        {downloading === "daily-report" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                        Print
                    </Button>
                    : null
            }
            {
                type == "estimate" ?
                    <Button
                        onClick={handleDownloadPDF}
                        disabled={downloading !== null}
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                    >
                        {downloading === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                        Print
                    </Button>
                    : null
            }
            {
                type == "manjuri" ?
                    <Button
                        onClick={handleDownloadManjuri}
                        disabled={downloading !== null}
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                    >
                        {downloading === "manjuri" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                        Print
                    </Button>
                    : null
            }
            {
                type == "invoice" ?
                    <Button
                        onClick={handleDownloadInvoicePDF}
                        disabled={downloading !== null}
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                    >
                        {downloading === "download-invoice" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                        Print
                    </Button>
                    : null
            }
            {
                type == "gujarati-doc" ?
                    <Button
                        onClick={handleDownloadGujaratiDocument}
                        disabled={downloading !== null}
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                    >
                        {downloading === "gujarati-doc" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                        Print
                    </Button>
                    : null
            }
            {
                type == "vardhi-details" ?
                    <Button
                        onClick={handleDownloadVardhiDetails}
                        disabled={downloading !== null}
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                    >
                        {downloading === "vardhi-details" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                        Print
                    </Button>
                    : null
            }
            {
                type == "all" ?

                    <Button
                        onClick={handlePrintAll}
                        disabled={downloading !== null}
                        variant="default"
                        size="sm"
                        className="gap-1.5 bg-[#38BDF8] hover:bg-[#0EA5E9]"
                    >
                        {downloading === "print-all" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                        Print All
                    </Button>
                    : null
            }
        </div>
    );
}