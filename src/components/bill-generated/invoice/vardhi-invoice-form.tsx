"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useFormik } from "formik";
import * as Yup from "yup";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Loader2,
    Save,
    ArrowLeft,
    Printer,
    Check,
    Building2,
    User,
    Briefcase,
    Banknote,
    Calculator,
    Eye,
    Edit3
} from "lucide-react";
import { calculateTaxAmount, calculateNetPayable, formatIndianCurrency } from "@/lib/tax-utils";
import { createVardhiInvoice, updateVardhiInvoice, generateInvoiceNumber } from "@/app/actions/vardhi-invoice-actions";
import Link from "next/link";

interface Props {
    estimation: any;
    existingInvoice?: any;
}

const validationSchema = Yup.object({
    invoice_no: Yup.string().required("Invoice number is required"),
    invoice_date: Yup.string().required("Invoice date is required"),
    dept_name: Yup.string(),
    dept_bill_no: Yup.string(),
    dept_bill_date: Yup.string(),
    mb_no: Yup.string(),
    mb_page_no: Yup.string(),
    ra_bill_no: Yup.string(),
    remarks: Yup.string(),
    company_name: Yup.string().required("Company name is required"),
    company_address: Yup.string(),
    company_gstin: Yup.string(),
    company_state: Yup.string(),
    company_state_code: Yup.string(),
    company_contact: Yup.string(),
    buyer_name: Yup.string().required("Buyer name is required"),
    buyer_address: Yup.string(),
    buyer_gstin: Yup.string(),
    buyer_state: Yup.string(),
    buyer_state_code: Yup.string(),
    description: Yup.string().required("Description is required"),
    hsn_sac: Yup.string(),
    quantity: Yup.number().required("Quantity is required").min(1, "Quantity must be at least 1"),
    amount: Yup.number().required("Amount is required").min(0, "Amount must be positive"),
    cgst_percent: Yup.number().min(0).max(100),
    sgst_percent: Yup.number().min(0).max(100),
    it_percent: Yup.number().min(0).max(100),
    labour_cess_percent: Yup.number().min(0).max(100),
    cgst_tds_percent: Yup.number().min(0).max(100),
    sgst_tds_percent: Yup.number().min(0).max(100),
    add_deposit_percent: Yup.number().min(0).max(100),
    account_holder_name: Yup.string(),
    bank_name: Yup.string(),
    account_no: Yup.string(),
    branch_name: Yup.string(),
    ifsc_code: Yup.string(),
    swift_code: Yup.string(),
});

export default function VardhiInvoiceForm({ estimation, existingInvoice }: Props) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<"edit" | "preview">("edit");



    const formatDates = (dateValue?: string) => {
        if (!dateValue) return new Date().toISOString().split("T")[0];

        const parsed = new Date(dateValue);
        if (isNaN(parsed.getTime())) {
            return new Date().toISOString().split("T")[0];
        }

        return parsed.toISOString().split("T")[0];
    };

    const formik = useFormik({
        initialValues: {
            invoice_no: existingInvoice?.invoice_no || "",
            invoice_date: formatDates(existingInvoice?.invoice_date),
            dept_name: existingInvoice?.dept_name || "",
            dept_bill_no: existingInvoice?.dept_bill_no || "",
            dept_bill_date: formatDates(existingInvoice?.dept_bill_date),
            mb_no: existingInvoice?.mb_no || "",
            mb_page_no: existingInvoice?.mb_page_no || "",
            ra_bill_no: existingInvoice?.ra_bill_no || "",
            remarks: existingInvoice?.remarks || "",

            company_name: existingInvoice?.company_name || estimation?.company?.company_name || "",
            company_address: existingInvoice?.company_address || estimation?.company?.address || "",
            company_gstin: existingInvoice?.company_gstin || estimation?.company?.gstin_uin || "",
            company_state: existingInvoice?.company_state || estimation?.company?.state_name || "",
            company_state_code: existingInvoice?.company_state_code || estimation?.company?.state_code || "",
            company_contact: existingInvoice?.company_contact || estimation?.company?.contact || "",

            buyer_name: existingInvoice?.buyer_name || estimation?.company?.buyer_name || "",
            buyer_address: existingInvoice?.buyer_address || estimation?.company?.buyer_address || "",
            buyer_gstin: existingInvoice?.buyer_gstin || estimation?.company?.buyer_gstin_uin || "",
            buyer_state: existingInvoice?.buyer_state || estimation?.company?.buyer_state_name || "",
            buyer_state_code: existingInvoice?.company_state_code || estimation?.company?.buyer_state_code || "",

            description: existingInvoice?.description || estimation?.work_name || "",
            hsn_sac: existingInvoice?.hsn_sac || estimation?.company?.hsn_sac || "",
            quantity: existingInvoice?.quantity?.toString() || "1",
            amount: existingInvoice?.amount?.toString() || estimation?.total_amount?.toString() || "0",

            cgst_percent: existingInvoice?.cgst_percent?.toString() || estimation?.company?.cgst_rate?.toString() || "0",
            sgst_percent: existingInvoice?.sgst_percent?.toString() || estimation?.company?.sgst_rate?.toString() || "0",
            it_percent: existingInvoice?.it_percent?.toString() || estimation?.company?.income_tax_rate?.toString() || "0",
            labour_cess_percent: existingInvoice?.labour_cess_percent?.toString() || estimation?.company?.labour_cess_rate?.toString() || "0",
            cgst_tds_percent: existingInvoice?.cgst_tds_percent?.toString() || estimation?.company?.cgst_tds_rate?.toString() || "0",
            sgst_tds_percent: existingInvoice?.sgst_tds_percent?.toString() || estimation?.company?.sgst_tds_rate?.toString() || "0",
            add_deposit_percent: existingInvoice?.add_deposit_percent?.toString() || estimation?.company?.additional_deposit?.toString() || "0",

            is_cgst_enabled: existingInvoice ? existingInvoice.is_cgst_enabled : true,
            is_sgst_enabled: existingInvoice ? existingInvoice.is_sgst_enabled : true,
            is_it_enabled: existingInvoice ? existingInvoice.is_it_enabled : true,
            is_labour_cess_enabled: existingInvoice ? existingInvoice.is_labour_cess_enabled : true,
            is_cgst_tds_enabled: existingInvoice ? existingInvoice.is_cgst_tds_enabled : true,
            is_sgst_tds_enabled: existingInvoice ? existingInvoice.is_sgst_tds_enabled : true,
            is_add_deposit_enabled: existingInvoice ? existingInvoice.is_add_deposit_enabled : false,

            account_holder_name: existingInvoice?.account_holder_name || estimation?.company?.account_holder_name || "",
            bank_name: existingInvoice?.bank_name || estimation?.company?.bank_name || "",
            account_no: existingInvoice?.account_no || estimation?.company?.account_no || "",
            branch_name: existingInvoice?.branch_name || estimation?.company?.branch_name || "",
            ifsc_code: existingInvoice?.ifsc_code || estimation?.company?.ifsc_code || "",
            swift_code: existingInvoice?.swift_code || estimation?.company?.swift_code || "",
        },
        validationSchema,
        onSubmit: async (values) => {
            setLoading(true);

            const payload = {
                ...values,
                estimation_id: estimation.id,
                invoice_date: new Date(values.invoice_date),
                dept_bill_date: values.dept_bill_date ? new Date(values.dept_bill_date) : null,
                quantity: parseFloat(values.quantity),
                amount: parseFloat(values.amount),
                cgst_percent: parseFloat(values.cgst_percent),
                cgst_amount: calculations.cgst,
                sgst_percent: parseFloat(values.sgst_percent),
                sgst_amount: calculations.sgst,
                it_percent: parseFloat(values.it_percent),
                it_amount: calculations.it,
                labour_cess_percent: parseFloat(values.labour_cess_percent),
                labour_cess_amount: calculations.labourCess,
                cgst_tds_percent: parseFloat(values.cgst_tds_percent),
                cgst_tds_amount: calculations.cgstTds,
                sgst_tds_percent: parseFloat(values.sgst_tds_percent),
                sgst_tds_amount: calculations.sgstTds,
                add_deposit_percent: parseFloat(values.add_deposit_percent),
                add_deposit_amount: calculations.addDeposit,
                netPayable: calculations.netPayable,
            };

            try {
                if (existingInvoice) {
                    await updateVardhiInvoice(existingInvoice.id, payload);
                    toast.success("Invoice updated successfully");
                } else {
                    await createVardhiInvoice(payload);
                    toast.success("Invoice created successfully");
                }
                router.push("/bill-generated");
            } catch (error) {
                console.error(error);
                toast.error("Failed to save invoice");
            } finally {
                setLoading(false);
            }
        },
    });

    // Auto-generate invoice number if not existing
    useEffect(() => {
        if (!existingInvoice && !formik.values.invoice_no) {
            generateInvoiceNumber(estimation.id, estimation.estimation_no).then(no => {
                formik.setFieldValue('invoice_no', no);
            });
        }
    }, [estimation, existingInvoice, formik.values.invoice_no]);

    // Live Calculations
    const calculations = useMemo(() => {
        const amount = parseFloat(formik.values.amount) || 0;
        const qty = parseFloat(formik.values.quantity) || 1;
        const subtotal = amount * qty;

        const cgstRate = formik.values.is_cgst_enabled ? parseFloat(formik.values.cgst_percent) || 0 : 0;
        const sgstRate = formik.values.is_sgst_enabled ? parseFloat(formik.values.sgst_percent) || 0 : 0;
        const totalGstRate = cgstRate + sgstRate;

        const taxtotal = totalGstRate > 0
            ? subtotal - (100 / (100 + totalGstRate)) * subtotal
            : 0;

        const cgst = formik.values.is_cgst_enabled
            ? (formik.values.is_sgst_enabled ? taxtotal / 2 : taxtotal)
            : 0;
        const sgst = formik.values.is_sgst_enabled
            ? taxtotal - cgst
            : 0;

        const grossTotal = Number((subtotal - Number(cgst.toFixed(2)) - Number(sgst.toFixed(2))).toFixed(2));

        const it = formik.values.is_it_enabled ? calculateTaxAmount(grossTotal, parseFloat(formik.values.it_percent) || 0) : 0;
        const labourCess = formik.values.is_labour_cess_enabled ? calculateTaxAmount(grossTotal, parseFloat(formik.values.labour_cess_percent) || 0) : 0;
        const cgstTds = formik.values.is_cgst_tds_enabled ? calculateTaxAmount(grossTotal, parseFloat(formik.values.cgst_tds_percent) || 0) : 0;
        const sgstTds = formik.values.is_sgst_tds_enabled ? calculateTaxAmount(grossTotal, parseFloat(formik.values.sgst_tds_percent) || 0) : 0;
        const addDeposit = formik.values.is_add_deposit_enabled ? calculateTaxAmount(grossTotal, parseFloat(formik.values.add_deposit_percent) || 0) : 0;

        const totalDeductions = Number((it + labourCess + cgstTds + sgstTds + addDeposit).toFixed(2));
        const netPayable = Number((subtotal - totalDeductions).toFixed(2));

        return {
            subtotal,
            cgst,
            sgst,
            grossTotal,
            taxtotal,
            it,
            labourCess,
            cgstTds,
            sgstTds,
            addDeposit,
            totalDeductions,
            netPayable
        };
    }, [formik.values]);

    const handleCheckboxChange = (name: string, checked: boolean) => {
        formik.setFieldValue(name, checked);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return "";
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const numberToWords = (num: number): string => {
        const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
        const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        const n = Math.floor(num);
        if (n === 0) return "Zero";

        const convert = (n: number): string => {
            if (n < 20) return a[n];
            if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? a[n % 10] : '');
            if (n < 1000) return a[Math.floor(n / 100)] + 'Hundred ' + (n % 100 ? convert(n % 100) : '');
            if (n < 100000) return convert(Math.floor(n / 1000)) + 'Thousand ' + (n % 1000 ? convert(n % 1000) : '');
            if (n < 10000000) return convert(Math.floor(n / 100000)) + 'Lakh ' + (n % 100000 ? convert(n % 100000) : '');
            return convert(Math.floor(n / 10000000)) + 'Crore ' + (n % 10000000 ? convert(n % 10000000) : '');
        };

        const integerPart = convert(n);
        const paise = Math.round((num - n) * 100);
        const paisen = Math.floor(paise);
        const integerpaisen = convert(paisen);
        return (integerPart + (paise > 0 ? ` and ${integerpaisen} Only` : '') + ' Rupees').trim();
    };

    return (
        <form onSubmit={formik.handleSubmit} className="max-w-7xl mx-auto space-y-4 pb-20">
            {/* Header */}
            <div className=" flex flex-col gap-4 md:gap-6  w-full">
                <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap print:hidden">
                    <div className="flex flex-col gap-1">
                        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                            Tax Invoice
                        </h2>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        {viewMode === "preview" && (
                            <Button
                                type="button"
                                onClick={() => window.print()}
                                size="sm"
                                variant="outline"
                                className="gap-1.5"
                            >
                                <Printer className="h-4 w-4" />
                                Print
                            </Button>
                        )}
                        <div className="flex bg-slate-100 rounded-lg p-1">
                            <Button
                                type="button"
                                variant={viewMode === "edit" ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setViewMode("edit")}
                                className="gap-1"
                            >
                                <Edit3 className="h-3 w-3" />
                                <span className="hidden sm:inline">Edit</span>
                            </Button>
                            <Button
                                type="button"
                                variant={viewMode === "preview" ? "default" : "ghost"}
                                size="sm"
                                onClick={() => setViewMode("preview")}
                                className="gap-1"
                            >
                                <Eye className="h-3 w-3" />
                                <span className="hidden sm:inline">Preview</span>
                            </Button>
                        </div>
                        <Button type="submit" disabled={loading} size="sm" className="shadow-md">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                            {existingInvoice ? "Update" : "Save"}
                        </Button>
                    </div>
                </div>
            </div>

            {viewMode === "edit" ? (
                <EditModeView
                    formik={formik}
                    calculations={calculations}
                    handleCheckboxChange={handleCheckboxChange}
                    estimation={estimation}
                />
            ) : (
                <PreviewModeView
                    formik={formik}
                    calculations={calculations}
                    formatDate={formatDate}
                    numberToWords={numberToWords}
                    estimation={estimation}
                />
            )}
        </form>
    );
}

function EditModeView({ formik, calculations, handleCheckboxChange, estimation }: any) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Side: Basic Info & Seller/Buyer */}
            <div className="lg:col-span-2 space-y-6">
                {/* Basic Info */}
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b">
                        INVOICE DETAILS
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 relative">
                            <Label>Invoice No</Label>
                            <Input name="invoice_no" value={formik.values.invoice_no} onChange={formik.handleChange} className="font-bold bg-slate-50" readOnly />
                        </div>
                        <div className="space-y-2 relative">
                            <Label>Invoice Date</Label>
                            <Input type="date" name="invoice_date" value={formik.values.invoice_date} onChange={formik.handleChange} />
                        </div>
                        <div className="space-y-2 relative">
                            <Label>RA Bill No</Label>
                            <Input name="ra_bill_no" value={formik.values.ra_bill_no} onChange={formik.handleChange} placeholder="e.g. 1st RA Bill" />
                        </div>
                        <div className="space-y-2 relative">
                            <Label>Dept Name</Label>
                            <Input name="dept_name" value={formik.values.dept_name} onChange={formik.handleChange} placeholder="Department Name" />
                        </div>
                        <div className="space-y-2 relative">
                            <Label>Dept Bill No</Label>
                            <Input name="dept_bill_no" value={formik.values.dept_bill_no} onChange={formik.handleChange} />
                        </div>
                        <div className="space-y-2 relative">
                            <Label>Dept Bill Date</Label>
                            <Input type="date" name="dept_bill_date" value={formik.values.dept_bill_date} onChange={formik.handleChange} />
                        </div>
                        <div className="space-y-2 relative">
                            <Label>MB No</Label>
                            <Input name="mb_no" value={formik.values.mb_no} onChange={formik.handleChange} />
                        </div>
                        <div className="space-y-2 relative">
                            <Label>MB Page No</Label>
                            <Input name="mb_page_no" value={formik.values.mb_page_no} onChange={formik.handleChange} />
                        </div>
                        <div className="space-y-2 relative md:col-span-2">
                            <Label>Remarks</Label>
                            <textarea
                                name="remarks"
                                value={formik.values.remarks}
                                onChange={formik.handleChange}
                                placeholder="Enter any additional remarks..."
                                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 !text-[11px]"
                            />
                        </div>
                    </div>
                </div>

                {/* Seller & Buyer Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Seller (Company) */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b">
                            SELLER DETAILS (SNAPSHOT)
                        </h3>
                        <div className="space-y-4 text-sm">
                            <div className="grid grid-cols-1 gap-2">
                            <div className="space-y-2 relative">
                                <Label>Company Name *</Label>
                                <Input name="company_name" value={formik.values.company_name} onChange={formik.handleChange} />
                            </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                            <div className="space-y-2 relative">
                                <Label>Address</Label>
                                <textarea
                                    name="company_address"
                                    value={formik.values.company_address}
                                    onChange={formik.handleChange}
                                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 !text-[11px]"
                                />
                            </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-2 relative">
                                    <Label>GSTIN</Label>
                                    <Input name="company_gstin" value={formik.values.company_gstin} onChange={formik.handleChange} />
                                </div>
                                <div className="space-y-2 relative">
                                    <Label>Contact</Label>
                                    <Input name="company_contact" value={formik.values.company_contact} onChange={formik.handleChange} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-2 relative">
                                    <Label>State</Label>
                                    <Input name="company_state" value={formik.values.company_state} onChange={formik.handleChange} />
                                </div>
                                <div className="space-y-2 relative">
                                    <Label>State Code</Label>
                                    <Input name="company_state_code" value={formik.values.company_state_code} onChange={formik.handleChange} />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Buyer */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b">BUYER DETAILS (SNAPSHOT)</h3>

                        <div className=" space-y-4 text-sm">
                            <div className="grid grid-cols-1 gap-2">
                            <div className="space-y-2 relative">
                                <Label>Buyer Name *</Label>
                                <Input name="buyer_name" value={formik.values.buyer_name} onChange={formik.handleChange} />
                            </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                            <div className="space-y-2 relative">
                                <Label>Address</Label>
                                <textarea
                                    name="buyer_address"
                                    value={formik.values.buyer_address}
                                    onChange={formik.handleChange}
                                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 !text-[11px]"
                                />
                            </div>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                            <div className="space-y-2 relative">
                                <Label>GSTIN</Label>
                                <Input name="buyer_gstin" value={formik.values.buyer_gstin} onChange={formik.handleChange} />
                            </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-2 relative">
                                    <Label>State</Label>
                                    <Input name="buyer_state" value={formik.values.buyer_state} onChange={formik.handleChange} />
                                </div>
                                <div className="space-y-2 relative">
                                    <Label>State Code</Label>
                                    <Input name="buyer_state_code" value={formik.values.buyer_state_code} onChange={formik.handleChange} />
                                </div>
                            </div>

                        </div>
                    </div>
                </div>

                {/* Invoice Item */}
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b">INVOICE ITEM</h3>

                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse text-sm">
                            <thead>
                                <tr className="bg-slate-100/50 border-b">
                                    <th className="p-3 text-left">No</th>
                                    <th className="p-3 text-left w-1/2">Description of Services</th>
                                    <th className="p-3 text-left">HSN/SAC</th>
                                    <th className="p-3 text-right">Quantity</th>
                                    <th className="p-3 text-right">Amount</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr className="border-b hover:bg-slate-50/30 transition-colors">
                                    <td className="p-3 text-center font-medium">1</td>
                                    <td className="p-3">
                                        <textarea
                                            name="description"
                                            value={formik.values.description}
                                            onChange={formik.handleChange}
                                            className="w-full border-0 bg-transparent focus:ring-1 focus:ring-blue-100 rounded p-1"
                                            rows={2}
                                            required
                                        />
                                    </td>
                                    <td className="p-3">
                                        <Input name="hsn_sac" value={formik.values.hsn_sac} onChange={formik.handleChange} className="border-0 bg-transparent text-center focus:ring-1" />
                                    </td>
                                    <td className="p-3">
                                        <Input type="number" name="quantity" value={formik.values.quantity} onChange={formik.handleChange} className="border-0 bg-transparent text-right focus:ring-1 pr-0" />
                                    </td>
                                    <td className="p-3">
                                        <Input type="number" name="amount" value={formik.values.amount} onChange={formik.handleChange} className="border-0 bg-transparent text-right font-bold focus:ring-1 pr-0" />
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Right Side: Tax Calculations & Bank */}
            <div className="space-y-6">
                {/* Tax Summary */}
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b">
                        TAX SUMMARY
                    </h3>

                    <div className="space-y-4">
                        <div className="flex justify-between text-sm py-1">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Original Total:</span>
                            <span className="font-bold">₹{formatIndianCurrency(calculations.grossTotal)}</span>
                        </div>

                        {/* Additions */}
                        <div className="space-y-3">
                            <TaxRow
                                label="CGST"
                                name="cgst"
                                percent={formik.values.cgst_percent}
                                amount={calculations.cgst}
                                enabled={formik.values.is_cgst_enabled}
                                onChange={formik.handleChange}
                                onToggle={handleCheckboxChange}
                            />
                            <TaxRow
                                label="SGST"
                                name="sgst"
                                percent={formik.values.sgst_percent}
                                amount={calculations.sgst}
                                enabled={formik.values.is_sgst_enabled}
                                onChange={formik.handleChange}
                                onToggle={handleCheckboxChange}
                            />
                        </div>

                        <div className="bg-blue-600 text-white p-3 rounded-lg flex justify-between items-center shadow-inner">
                            <span className="text-xs font-bold uppercase tracking-wider">Gross Total:</span>
                            <span className="text-xl font-black">₹{formatIndianCurrency(calculations.subtotal)}</span>
                        </div>


                        {/* Deductions */}
                        <div className="space-y-3 pt-2">
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deductions</h4>
                            <TaxRow
                                label="Income Tax"
                                name="it"
                                percent={formik.values.it_percent}
                                amount={calculations.it}
                                enabled={formik.values.is_it_enabled}
                                onChange={formik.handleChange}
                                onToggle={handleCheckboxChange}
                                isDeduction
                            />
                            <TaxRow
                                label="Labour Cess"
                                name="labour_cess"
                                percent={formik.values.labour_cess_percent}
                                amount={calculations.labourCess}
                                enabled={formik.values.is_labour_cess_enabled}
                                onChange={formik.handleChange}
                                onToggle={handleCheckboxChange}
                                isDeduction
                            />
                            <TaxRow
                                label="CGST (TDS)"
                                name="cgst_tds"
                                percent={formik.values.cgst_tds_percent}
                                amount={calculations.cgstTds}
                                enabled={formik.values.is_cgst_tds_enabled}
                                onChange={formik.handleChange}
                                onToggle={handleCheckboxChange}
                                isDeduction
                            />
                            <TaxRow
                                label="SGST (TDS)"
                                name="sgst_tds"
                                percent={formik.values.sgst_tds_percent}
                                amount={calculations.sgstTds}
                                enabled={formik.values.is_sgst_tds_enabled}
                                onChange={formik.handleChange}
                                onToggle={handleCheckboxChange}
                                isDeduction
                            />
                            <TaxRow
                                label="Add. Deposit"
                                name="add_deposit"
                                percent={formik.values.add_deposit_percent}
                                amount={calculations.addDeposit}
                                enabled={formik.values.is_add_deposit_enabled}
                                onChange={formik.handleChange}
                                onToggle={handleCheckboxChange}
                                isDeduction
                            />
                        </div>

                        <div className="flex justify-between text-xs text-red-600 font-bold px-1">
                            <span>Total Deductions:</span>
                            <span>- ₹{formatIndianCurrency(calculations.totalDeductions)}</span>
                        </div>

                        <hr className="border-slate-300 border-dashed" />

                        <div className="bg-emerald-600 text-white p-4 rounded-xl flex justify-between items-center shadow-lg transform scale-105 origin-center my-2">
                            <div className="flex flex-col">
                                <span className="text-[10px] font-bold uppercase tracking-widest opacity-80">Net Payable</span>
                                <span className="text-2xl font-black">₹{formatIndianCurrency(calculations.netPayable)}</span>
                            </div>
                            <div className="h-10 w-10 bg-white/20 rounded-full flex items-center justify-center">
                                <Check className="h-6 w-6" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bank Details */}
                <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground pb-2 border-b">
                        BANK DETAILS (SNAPSHOT)
                    </h3>
                    <div className="space-y-4 text-sm">
                        <div className="grid grid-cols-1 gap-2">
                        <div className="space-y-2 relative">
                            <Label>Account Holder</Label>
                            <Input name="account_holder_name" value={formik.values.account_holder_name} onChange={formik.handleChange} />
                        </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                        <div className="space-y-2 relative">
                            <Label>Bank Name</Label>
                            <Input name="bank_name" value={formik.values.bank_name} onChange={formik.handleChange} />
                        </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                        <div className="space-y-2 relative">
                            <Label>Account Number</Label>
                            <Input name="account_no" value={formik.values.account_no} onChange={formik.handleChange} />
                        </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-2 relative">
                                <Label>Branch Name</Label>
                                <Input name="branch_name" value={formik.values.branch_name} onChange={formik.handleChange} />
                            </div>
                            <div className="space-y-2 relative">
                                <Label>IFSC Code</Label>
                                <Input name="ifsc_code" value={formik.values.ifsc_code} onChange={formik.handleChange} />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                        <div className="space-y-2 relative">
                            <Label>SWIFT Code</Label>
                            <Input name="swift_code" value={formik.values.swift_code} onChange={formik.handleChange} />
                        </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function PreviewModeView({ formik, calculations, formatDate, numberToWords, estimation }: any) {
    const subtotal = calculations.subtotal;
    const cgst = calculations.cgst;
    const sgst = calculations.sgst;
    const grossTotal = calculations.grossTotal;
    const taxtotal = calculations.taxtotal;
    const it = calculations.it;
    const labourCess = calculations.labourCess;
    const cgstTds = calculations.cgstTds;
    const sgstTds = calculations.sgstTds;
    const addDeposit = calculations.addDeposit;
    const totalDeductions = calculations.totalDeductions;
    const netPayable = calculations.netPayable;
    const roundedNetAmount = Math.round(netPayable);
    const incomeTax = formik.values.is_it_enabled
        ? (subtotal * Number(formik.values.it_percent || 0)) / 100
        : 0;
    return (
        <div className="invoice-wrapper">
            <table cellSpacing={0}>
                <tbody>
                    <tr className="text-[13px]  tracking-wider text-slate-700 text-left">
                        <td
                            className=" border border-slate-300"
                            style={{ verticalAlign: "baseline" }}
                            colSpan={3}
                        >
                            <div className="p-3 border-slate-300">
                                <b>{formik.values.company_name}</b>
                                <br />
                                <p style={{ width: "50%" }}>{formik.values.company_address}</p>
                                GSTIN/UIN: {formik.values.company_gstin}
                                <br />
                                State Name :  {formik.values.company_state} , Code :  {formik.values.company_state_code}
                                <br />
                                Contact :   {formik.values.company_contact}
                            </div>
                            <hr
                                style={{ marginLeft: "-1px", marginRight: "-1px", borderBottom: 1 }}
                                className="border-b border-slate-300"
                            />
                            <div className="p-3 -slate-300" >
                                Buyer (Bill to) <br />
                                <b>{formik.values.buyer_name}{" "}</b><br />
                                <span className="s2">  {formik.values.buyer_to || formik.values.buyer_name}</span>
                                <p style={{ width: "50%", whiteSpace: 'break-spaces' }}>{formik.values.buyer_address}</p>
                                GSTIN/UIN : {formik.values.buyer_gstin}
                                <br />
                                State Name : {formik.values.buyer_state}, Code : {formik.values.buyer_state_code}
                            </div>
                        </td>
                        <td className="border border-slate-300" colSpan={5}>
                            <div className="flex">
                                <div
                                    style={{ width: "50%" }}
                                    className="p-3 py-2 w-[50%] border-slate-300"
                                >
                                    Invoice No.
                                    <br />
                                    <b> {formik.values.invoice_no}</b>
                                </div>
                                <div
                                    style={{ width: "50%" }}
                                    className="p-3 py-2 w-[50%]  border-l border-slate-300"
                                >
                                    Dated
                                    <br />
                                    <b>{formatDate(formik.values.invoice_date)}</b>
                                </div>
                            </div>
                            <hr
                                style={{ marginLeft: "-1px", marginRight: "-1px", borderBottom: 1 }}
                                className="border-b border-slate-300"
                            />
                            <div className="p-3 py-2 border-slate-300">
                                Dept.Name : <b>{formik.values.dept_name} </b>
                            </div>
                            <hr
                                style={{ marginLeft: "-1px", marginRight: "-1px", borderBottom: 1 }}
                                className="border-b border-slate-300"
                            />
                            <div className="p-3 py-2  border-slate-300">
                                Dept.Bill No. : <b>{formik.values.dept_bill_no} dt {formik.values.dept_bill_date}</b>
                            </div>
                            <hr
                                style={{ marginLeft: "-1px", marginRight: "-1px", borderBottom: 1 }}
                                className="border-b border-slate-300"
                            />
                            <div className="p-3 py-2  border-slate-300">
                                MB No. : <b>{formik.values.mb_no}</b>
                            </div>
                            <hr
                                style={{ marginLeft: "-1px", marginRight: "-1px", borderBottom: 1 }}
                                className="border-b border-slate-300"
                            />
                            <div className="p-3 py-2  border-slate-300">
                                MB Page No. : <b>{formik.values.mb_page_no}</b>
                            </div>
                            <hr
                                style={{ marginLeft: "-1px", marginRight: "-1px", borderBottom: 1 }}
                                className="border-b border-slate-300"
                            />
                            <div className="p-3 py-2 border-slate-300">
                                <p className="s2">
                                    RA Bill No. : <b>{formik.values.ra_bill_no}</b>
                                </p>
                            </div>
                            <hr
                                style={{ marginLeft: "-1px", marginRight: "-1px", borderBottom: 1 }}
                                className="border-b border-slate-300"
                            />
                            <div
                                style={{ height: 100 }}
                                className="p-3 py-2  border-slate-300 h-100px"
                            >
                                <p>Remarks : <b>{formik.values.remarks}</b></p>

                            </div>
                        </td>
                    </tr>
                    <tr className="bg-slate-100 text-[13px]  tracking-wider text-slate-700 text-left">
                        <th className="p-3 border font-bold  border-slate-300 ">Sr No.</th>
                        <th colSpan={3} className="p-3 border font-bold  border-slate-300 ">
                            Description of Services
                        </th>
                        <th className="p-3 border font-bold text-center border-slate-300 ">HSN/SAC</th>
                        <th className="p-3 border font-bold text-center border-slate-300 ">Quantity</th>
                        <th className="p-3 border font-bold  border-slate-300 text-right">
                            Amount
                        </th>
                    </tr>
                    <tr className="hover:bg-blue-50 transition-colors">
                        <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground">
                            1
                        </td>
                        <td
                            className="p-3 py-2 border text-left text-[13px] text-muted-foreground"
                            colSpan={3}
                        >
                            <b>WORK CONTRACT</b> <br />
                            {formik.values.description}
                        </td>
                        <td className="p-3 py-2 border text-center text-[13px] text-muted-foreground">
                            {formik.values.hsn_sac}
                        </td>
                        <td className="p-3 py-2 border text-center text-[13px] text-muted-foreground">
                            {formik.values.quantity || '1'}
                        </td>
                        <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                            <b>
                                ₹{formatIndianCurrency(calculations.grossTotal)}
                            </b>
                        </td>
                    </tr>
                    {/* {
                        formik.values.is_cgst_enabled && (
                            <tr className="hover:bg-blue-50 transition-colors">
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td
                                    className="p-3 py-2 border text-right text-[13px] text-muted-foreground"
                                    colSpan={3}
                                >
                                    <b>
                                        CGST
                                        <div />
                                        <span />
                                    </b>
                                </td>
                                <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                                    <b>₹{formatIndianCurrency(cgst)}</b>
                                </td>
                            </tr>
                        )
                    }
                    {
                        formik.values.is_sgst_enabled && (
                            <tr className="hover:bg-blue-50 transition-colors">
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td
                                    className="p-3 py-2 border text-right text-[13px] text-muted-foreground"
                                    colSpan={3}
                                >
                                    <b>SGST</b>
                                </td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                                    <b >₹{formatIndianCurrency(sgst)}</b>
                                </td>
                            </tr>
                        )
                    }
                    {
                        formik.values.is_it_enabled && (
                            <tr className="hover:bg-blue-50 transition-colors">
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td
                                    className="p-3 py-2 border text-right text-[13px] text-muted-foreground"
                                    colSpan={3}
                                >
                                    <b>
                                        Income Tax ({formik.values.it_percent}%):
                                    </b>
                                </td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                                    <b >- ₹{formatIndianCurrency(it)}</b>
                                </td>
                            </tr>
                        )
                    }
                    {
                        formik.values.is_labour_cess_enabled && (
                            <tr className="hover:bg-blue-50 transition-colors">
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td
                                    className="p-3 py-2 border text-right text-[13px] text-muted-foreground"
                                    colSpan={3}
                                >
                                    <b>
                                        Labour Cess ({formik.values.labour_cess_percent}%):
                                    </b>
                                </td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                                    <b>- ₹{formatIndianCurrency(labourCess)}</b>
                                </td>
                            </tr>
                        )
                    }
                    {
                        formik.values.is_cgst_tds_enabled && (
                            <tr className="hover:bg-blue-50 transition-colors">
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td
                                    className="p-3 py-2 border text-right text-[13px] text-muted-foreground"
                                    colSpan={3}
                                >
                                    <b>
                                        CGST (TDS) ({formik.values.cgst_tds_percent}%):
                                    </b>
                                </td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                                    <b>- ₹{formatIndianCurrency(cgstTds)}</b>
                                </td>
                            </tr>
                        )
                    }
                    {
                        formik.values.is_sgst_tds_enabled && (
                            <tr className="hover:bg-blue-50 transition-colors">
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td
                                    className="p-3 py-2 border text-right text-[13px] text-muted-foreground"
                                    colSpan={3}
                                >
                                    <b>
                                        SGST (TDS) ({formik.values.sgst_tds_percent}%):
                                    </b>
                                </td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td
                                    className="p-3 py-2 border text-left text-[13px] text-muted-foreground"
                                    colSpan={3}
                                >
                                    &nbsp;
                                </td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground">

                                </td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                            </tr>
                        )
                    } */}
                    {/* <tr className="hover:bg-blue-50 transition-colors">
                        <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground">
                            &nbsp;
                        </td>
                        <td
                            className="p-3 py-2 border text-left text-[13px] text-muted-foreground"
                            colSpan={3}
                        ></td>
                        <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                        <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                        <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                    </tr> */}
                    {
                        formik.values.is_cgst_enabled && (
                            <tr className="hover:bg-blue-50 transition-colors">
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td
                                    className="p-3 py-2 border text-right text-[13px] text-muted-foreground"
                                    colSpan={3}
                                >
                                    <b>
                                        CGST
                                    </b>
                                </td>
                                <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                                    <b >+ ₹{formatIndianCurrency(cgst)}</b>
                                </td>
                            </tr>
                        )
                    }
                    {
                        formik.values.is_sgst_enabled && (
                            <tr className="hover:bg-blue-50 transition-colors">
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td
                                    className="p-3 py-2 border text-right text-[13px] text-muted-foreground"
                                    colSpan={3}
                                >
                                    <b>SGST</b>
                                </td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                                    <b >+ ₹{formatIndianCurrency(sgst)}</b>
                                </td>
                            </tr>
                        )
                    }
                     <tr className="hover:bg-blue-50 border bg-slate-200 transition-colors">
                        <td className="p-3 py-2 border border-r-0 border-slate-300 text-left text-[13px] text-muted-foreground">
                            <p style={{ textIndent: "0pt", textAlign: "left" }}>
                                <br />
                            </p>
                        </td>
                        <td
                            colSpan={3}
                            className="p-3 text-blue-600 py-2 border border-l-0 border-slate-300 text-right text-[13px]"
                        >
                            <b className="s4">Total</b>
                        </td>
                        <td className="p-3 py-2 border border-slate-300 border-r-0 text-left text-[13px] text-muted-foreground">
                            <p style={{ textIndent: "0pt", textAlign: "left" }}>
                                <br />
                            </p>
                        </td>
                        <td className="p-3 py-2 border border-slate-300 border-l-0 text-left border-r-0 text-[13px] text-muted-foreground">
                            <p style={{ textIndent: "0pt", textAlign: "left" }}>
                                <br />
                            </p>
                        </td>
                        <td className="p-3 py-2 text-blue-600 border border-slate-300 border-l-0 text-right text-[13px] ">
                            <b>₹{formatIndianCurrency(calculations.subtotal)}</b>
                        </td>
                    </tr>
                    <tr className=" border transition-colors">
                        <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground">
                            <p style={{ textIndent: "0pt", textAlign: "left" }}>
                                <br />
                            </p>
                        </td>
                        <td
                            colSpan={3}
                            className="p-3 text-red-600 py-2 border text-right text-[13px]"
                        >
                            <b className="s4">Deduction</b>
                        </td>
                        <td className="p-3 py-2 border  text-left text-[13px] text-muted-foreground">
                            <p style={{ textIndent: "0pt", textAlign: "left" }}>
                                <br />
                            </p>
                        </td>
                        <td className="p-3 py-2 border  text-left border-r-0 text-[13px] text-muted-foreground">
                            <p style={{ textIndent: "0pt", textAlign: "left" }}>
                                <br />
                            </p>
                        </td>
                        <td className="p-3 py-2 text-blue-600 border  text-right text-[13px] ">
                           <p style={{ textIndent: "0pt", textAlign: "left" }}>
                                <br />
                            </p>
                        </td>
                    </tr>
                    {
                        formik.values.is_it_enabled && (
                            <tr className="hover:bg-blue-50 transition-colors">
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td
                                    className="p-3 py-2 border text-right text-[13px] text-muted-foreground"
                                    colSpan={3}
                                >
                                    <b>
                                        Income Tax ({formik.values.it_percent}%):
                                    </b>
                                </td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                                    <b >- ₹{formatIndianCurrency(it)}</b>
                                </td>
                            </tr>
                        )
                    }
                    {
                        formik.values.is_labour_cess_enabled && (
                            <tr className="hover:bg-blue-50 transition-colors">
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td
                                    className="p-3 py-2 border text-right text-[13px] text-muted-foreground"
                                    colSpan={3}
                                >
                                    <b>
                                        Labour Cess ({formik.values.labour_cess_percent}%):
                                    </b>
                                </td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                                    <b>- ₹{formatIndianCurrency(labourCess)}</b>
                                </td>
                            </tr>
                        )
                    }
                    {
                        formik.values.is_cgst_tds_enabled && (
                            <tr className="hover:bg-blue-50 transition-colors">
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td
                                    className="p-3 py-2 border text-right text-[13px] text-muted-foreground"
                                    colSpan={3}
                                >
                                    <b>
                                        CGST (TDS) ({formik.values.cgst_tds_percent}%):
                                    </b>
                                </td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                                    <b>- ₹{formatIndianCurrency(cgstTds)}</b>
                                </td>
                            </tr>
                        )
                    }
                    {
                        formik.values.is_sgst_tds_enabled && (
                            <tr className="hover:bg-blue-50 transition-colors">
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td
                                    className="p-3 py-2 border text-right text-[13px] text-muted-foreground"
                                    colSpan={3}
                                >
                                    <b>
                                        SGST (TDS) ({formik.values.sgst_tds_percent}%):
                                    </b>
                                </td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                                    <b>- ₹{formatIndianCurrency(sgstTds)}</b>
                                </td>
                            </tr>
                        )
                    }
                   
                    {
                        formik.values.is_add_deposit_enabled && (
                            <tr className="hover:bg-blue-50 transition-colors">
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td
                                    className="p-3 py-2 border text-right text-[13px] text-muted-foreground"
                                    colSpan={3}
                                >
                                    <b>
                                        Additional Deposit ({formik.values.add_deposit_percent}%):
                                    </b>
                                </td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-left text-[13px] text-muted-foreground"></td>
                                <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                                    <b>- ₹{formatIndianCurrency(addDeposit)}</b>
                                </td>
                            </tr>
                        )
                    }
                    <tr className="hover:bg-blue-50 transition-colors border bg-slate-200 ">
                        <td className="p-3 py-2 border text-left text-[13px] border border-r-0 border-slate-300 text-muted-foreground">
                            <p style={{ textIndent: "0pt", textAlign: "left" }}>
                                <br />
                            </p>
                        </td>
                        <td
                            colSpan={3}
                            className="p-3 py-2 border border-l-0 border-slate-300 text-right text-[13px] text-blue-600"
                        >
                            <b className="s4">Net Amount</b>
                        </td>
                        <td className="p-3 py-2 border border-slate-300 border-r-0 text-left text-[13px] text-muted-foreground">
                            <p style={{ textIndent: "0pt", textAlign: "left" }}>
                                <br />
                            </p>
                        </td>
                        <td className="p-3 py-2 border border-l-0 border-r-0 border-slate-300 text-left text-[13px] text-muted-foreground">
                            <p style={{ textIndent: "0pt", textAlign: "left" }}>
                                <br />
                            </p>
                        </td>
                        <td className="p-3 py-2 border border-slate-300 border-l-0 text-right text-[13px] text-blue-600">
                            <b>₹{roundedNetAmount.toLocaleString('en-IN')}</b>
                        </td>
                    </tr>
                    <tr className='transition-colors"'>
                        <td
                            colSpan={7}
                            className="p-3  border text-left text-[13px] text-muted-foreground "
                        >
                            <p className="s4" style={{ display: "flex" }}>
                                Amount Chargeable (in words){" "}
                                <i style={{ marginLeft: "auto", textAlign: "right" }}>E. &amp; O.E</i>
                            </p>
                            <b className="s1">
                                {numberToWords(netPayable)}
                            </b>
                        </td>
                    </tr>
                    <tr className="bg-slate-100 text-[13px]  tracking-wider text-slate-700 text-left">
                        <td
                            className="p-3 py-2 border font-bold border-slate-300 w-[8%]"
                            rowSpan={2}
                            style={{ textAlign: "center" }}
                        >
                            <p className="s4">HSN/SAC</p>
                        </td>
                        <td
                            rowSpan={2}
                            className="p-3 py-2 border font-bold border-slate-300 w-[18%]"
                            style={{ textAlign: "center" }}
                        >
                            Taxable <br />
                            Value
                        </td>
                        <td
                            colSpan={2}
                            className="p-3 py-2 border font-bold border-slate-300 w-[18%]"
                            style={{ textAlign: "center" }}
                        >
                            <p className="s4">CGST</p>
                        </td>
                        <td
                            colSpan={2}
                            className="p-3 py-2 border font-bold border-slate-300 w-[18%]"
                            style={{ textAlign: "center" }}
                        >
                            <p className="s4">SGST/UTGST</p>
                        </td>
                        <td
                            rowSpan={2}
                            className="p-3 py-2 border font-bold border-slate-300 w-[18%]"
                            style={{ textAlign: "center" }}
                        >
                            Total <br /> Tax Amount
                            <span />
                        </td>
                    </tr>
                    <tr className="bg-slate-100 text-[13px]  tracking-wider text-slate-700 text-left">
                        <td className="p-3 py-2 border font-bold border-slate-300">
                            <p className="s3">Rate</p>
                        </td>
                        <td className="p-3 py-2 border font-bold border-slate-300">
                            <p className="s3">Amount</p>
                        </td>
                        <td className="p-3 py-2 border font-bold border-slate-300">
                            Rate
                        </td>
                        <td className="p-3 py-2 border font-bold border-slate-300">
                            Amount
                        </td>
                    </tr>
                    <tr className="hover:bg-blue-50 transition-colors">
                        <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                            {formik.values.hsn_sac}
                        </td>
                        <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                            {formatIndianCurrency(grossTotal)}
                        </td>
                        <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                            {formik.values.cgst_percent}%
                        </td>
                        <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                            {formatIndianCurrency(cgst)}
                        </td>
                        <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                            {formik.values.sgst_percent}%
                        </td>
                        <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                            {formatIndianCurrency(sgst)}
                        </td>
                        <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                            {formatIndianCurrency(taxtotal)}
                        </td>
                    </tr>
                    <tr className="hover:bg-blue-50 transition-colors">
                        <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                            <b>
                                Total
                            </b>
                        </td>
                        <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                            <b>{formatIndianCurrency(grossTotal)}</b>
                        </td>
                        <td style={{ width: "34pt", borderStyle: "solid", borderWidth: "1pt" }}>

                        </td>
                        <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                            <b>
                                {formatIndianCurrency(cgst)}
                            </b>
                        </td>
                        <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                            <p style={{ textIndent: "0pt", textAlign: "left" }}>
                                <br />
                            </p>
                        </td>
                        <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                            <b>
                                {formatIndianCurrency(sgst)}
                            </b>
                        </td>
                        <td className="p-3 py-2 border text-right text-[13px] text-muted-foreground">
                            <b>
                                {formatIndianCurrency(taxtotal)}
                            </b>
                        </td>
                    </tr>
                    <tr>
                        <td
                            colSpan={7}
                            className="p-3 py-2 border text-left text-[13px] text-muted-foreground"
                            style={{ borderBottom: 0 }}
                        >
                            Tax Amount (in words) :{" "}
                            <b className="s1">
                                {numberToWords(taxtotal)}
                            </b>
                        </td>
                    </tr>
                    <tr>
                        <td
                            colSpan={3}
                            className="p-3 py-2 border text-left text-[13px] text-muted-foreground"
                            style={{ borderTop: 0, borderRight: 0, borderBottom: 0 }}
                        />
                        <td
                            colSpan={4}
                            style={{ borderBottom: 0, borderTop: 0, borderLeft: 0 }}
                            className="p-3 border py-2 text-left text-[13px] text-muted-foreground"
                        >
                            <p className="s4">Company's Bank Details</p>
                            <p className="s4">
                                <span style={{ width: "28%", display: "inline-block" }}>
                                    A/c Holder's Name : </span><b>{formik.values.account_holder_name}</b>
                            </p>
                            <p className="s4">
                                <span style={{ width: "28%", display: "inline-block" }}>
                                    Bank Name : </span><b>{formik.values.bank_name}</b>
                            </p>
                            <p className="s4">
                                <span style={{ width: "28%", display: "inline-block" }}>
                                    A/c No. :</span><b>{formik.values.account_no}</b>
                            </p>
                            <p className="s4">
                                <span style={{ width: "28%", display: "inline-block" }}>
                                    Branch &amp; IFS Code :</span><b>{formik.values.branch_name} &amp; {formik.values.branch_name} </b>
                            </p>
                            <p className="s4"><span style={{ width: "28%", display: "inline-block" }}>
                                SWIFT Code :</span> <b>{formik.values.swift_code}</b></p>
                        </td>
                    </tr>
                    <tr className="transition-colors">
                        <td
                            colSpan={3}
                            className="p-3 py-2 border text-left text-[13px] text-muted-foreground"
                            style={{ borderTop: 0 }}
                        >
                            <p className="s14" style={{ textDecoration: "underline" }}>
                                Declaration
                            </p>
                            <p className="s4">
                                We declare that this invoice shows the actual price of the goods
                                described and that all particulars are true and correct.
                            </p>
                        </td>
                        <td
                            colSpan={4}
                            className="p-2 py-2 border text-right text-[13px] text-muted-foreground"
                        >
                            <b className="s12">for {formik.values.company_name || 'Company'}</b>
                            <p style={{ textIndent: "0pt", textAlign: "left" }}>
                                <br />
                            </p>
                            <p style={{ textIndent: "0pt", textAlign: "left" }}>
                                <br />
                            </p>
                             <p style={{ textIndent: "0pt", textAlign: "left" }}>
                                <br />
                            </p>
                            <p style={{ textIndent: "0pt", textAlign: "left" }}>
                                <br />
                            </p>
                             <p style={{ textIndent: "0pt", textAlign: "left" }}>
                                <br />
                            </p>
                            <p style={{ textIndent: "0pt", textAlign: "left" }}>
                                <br />
                            </p>
                             <p style={{ textIndent: "0pt", textAlign: "left" }}>
                                <br />
                            </p>
                            <p style={{ textIndent: "0pt", textAlign: "left" }}>
                                <br />
                            </p>
                            <p className="s4" style={{}}>
                                Authorised Signatory
                            </p>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

function TaxRow({ label, name, percent, amount, enabled, onChange, onToggle, isDeduction = false }: any) {
    return (
        <div className={`flex items-center gap-2 group p-2 rounded-lg transition-all ${enabled ? 'bg-white shadow-sm ring-1 ring-slate-200' : 'bg-slate-200/50 opacity-60'}`}>
            <Checkbox
                id={`toggle-${name}`}
                checked={enabled}
                onCheckedChange={(val) => onToggle(`is_${name}_enabled`, !!val)}
                className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
            />
            <div className="flex-1 grid grid-cols-2 gap-2 items-center">
                <span className="text-xs font-bold text-slate-700 truncate">{label}</span>
                <div className="flex items-center gap-1">
                    <div className="relative">
                        <Input
                            type="number"
                            name={`${name}_percent`}
                            value={percent}
                            onChange={onChange}
                            disabled={!enabled}
                            className="h-7 w-12 text-[10px] p-1 text-center font-bold border-slate-200 focus:ring-1 pr-3"
                        />
                        <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[8px] font-bold text-slate-400">%</span>
                    </div>
                    <div className={`text-right flex-1 text-xs font-black ${enabled ? (isDeduction ? 'text-red-500' : 'text-blue-600') : 'text-slate-400'}`}>
                        {isDeduction ? '-' : '+'} ₹{formatIndianCurrency(amount)}
                    </div>
                </div>
            </div>
        </div>
    );
}
