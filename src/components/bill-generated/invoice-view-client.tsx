"use client";

import React, { useState } from "react";
import VardhiInvoiceForm from "./invoice/vardhi-invoice-form";

interface InvoiceData {
    id: string;
    invoice_no: string;
    invoice_date: Date | string;
    dept_name: string | null;
    dept_bill_no: string | null;
    dept_bill_date: Date | string | null;
    mb_no: string | null;
    mb_page_no: string | null;
    ra_bill_no: string | null;
    remarks: string | null;
    company_name: string;
    company_address: string | null;
    company_gstin: string | null;
    company_state: string | null;
    company_state_code: string | null;
    company_contact: string | null;
    buyer_name: string;
    buyer_address: string | null;
    buyer_gstin: string | null;
    buyer_state: string | null;
    buyer_state_code: string | null;
    description: string;
    hsn_sac: string | null;
    quantity: number | string;
    amount: number | string;
    total_amount: number | null;
    cgst_percent: number | null;
    cgst_amount: number | null;
    sgst_percent: number | null;
    sgst_amount: number | null;
    it_percent: number | null;
    it_amount: number | null;
    labour_cess_percent: number | null;
    labour_cess_amount: number | null;
    cgst_tds_percent: number | null;
    cgst_tds_amount: number | null;
    sgst_tds_percent: number | null;
    sgst_tds_amount: number | null;
    add_deposit_percent: number | null;
    add_deposit_amount: number | null;
    is_cgst_enabled: boolean;
    is_sgst_enabled: boolean;
    is_it_enabled: boolean;
    is_labour_cess_enabled: boolean;
    is_cgst_tds_enabled: boolean;
    is_sgst_tds_enabled: boolean;
    is_add_deposit_enabled: boolean;
    account_holder_name: string | null;
    bank_name: string | null;
    account_no: string | null;
    branch_name: string | null;
    ifsc_code: string | null;
    swift_code: string | null;
}

interface Props {
    invoice?: InvoiceData | null;
    estimation?: any;
}

export default function InvoiceViewClient({ invoice, estimation }: Props) {
    const [isCreating, setIsCreating] = useState(true);
    

    
    if (!invoice && !isCreating) {
        return (
            <div className="flex flex-col gap-4">
                <div className="flex justify-center">
                    <button
                        onClick={() => setIsCreating(true)}
                        className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
                    >
                        Create Invoice
                    </button>
                </div>
            </div>
        );
    }

    if (!invoice && isCreating && estimation) {
        return (
            <VardhiInvoiceForm
                estimation={estimation}
                existingInvoice={undefined}
            />
        );
    }

    if (invoice && estimation) {
        return (
            <VardhiInvoiceForm
                estimation={estimation}
                existingInvoice={invoice}
            />
        );
    }

    return (
        <div className="flex flex-col gap-4">
            <div className="rounded-md border overflow-hidden p-8 text-center text-muted-foreground">
                <p>Unable to load invoice form. Please try again.</p>
            </div>
        </div>
    );
}
