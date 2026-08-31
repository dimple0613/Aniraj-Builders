// ──────────────────────────────────────────────
// Approved By configuration (per company)
// ──────────────────────────────────────────────
export interface ApprovedByRange {
    name: string;
    amount_from: number;
    amount_to: number;
    field_name?: string;
}

// ──────────────────────────────────────────────
// Vardhi (minimal shape used in estimation)
// ──────────────────────────────────────────────
export interface VardhiForDailyReport {
    id: string;
    vardhi_number: string;
    name: string;
    date: string;
    location: string;
    vardhi_start_date: string;
    vardhi_end_date: string;
    work_type: string; // work_type (string) e.g. "Maintenance"
    vardhiItems?: any[];
    additionalItems?: any[];
    zone: {
        id: string;
        name: string;
        file_no: number;
    };
    // Attachment fields for preview in estimation
    report_pdf?: string | null;
    site_photography?: string | null;
    site_clear_photo?: string | null;
    other_attachment?: string | null;
}

// ──────────────────────────────────────────────
// Item (one row in the estimation table)
// ──────────────────────────────────────────────
export interface VardhiDailyReportItem {
    id: string;
    estimation_id: string;
    vardhi_id?: string | null;
    item_id?: string | null;
    custom_name?: string | null;
    size?: string | null;
    rate: number | string;
    unit_id: string;
    ay_id?: string | null;
    quantity: number | string;
    amount: number | string;
    created_at: string;
    updated_at: string;

    // Expanded relations
    item?: {
        id: string;
        item_name: string;
        unit: { id: string; unit_name: string };
        ay?: { ay_no: string } | null;
    } | null;
    unit: { id: string; unit_name: string };
    ay?: { ay_no: string } | null;
}

// ──────────────────────────────────────────────
// DailyReport (header)
// ──────────────────────────────────────────────
export interface VardhiDailyReport {
    id: string;
    company_id: string;
    estimation_no: string;
    contractor: string;
    work_name: string;
    file_no?: string | null;
    zone_no?: string | null;
    month_year?: string | null;
    total_amount: number | string;
    status: 'DRAFT' | 'FINAL' | 'APPROVED';
    current_stage?: string | null;
    created_at: string;
    updated_at: string;

    file_submitted_date?: string | null;
    store_report_date?: string | null;
    submitted_for_approved_date?: string | null;
    approved_date?: string | null;
    approved_no?: string | null;
    bill_prepaid_date?: string | null;
    bill_audit_date?: string | null;
    bill_account_date?: string | null;
    payment_received_date?: string | null;

    vardhis: VardhiForDailyReport[];
    items: VardhiDailyReportItem[];
    _count?: { items: number };
}

// ──────────────────────────────────────────────
// Form data types
// ──────────────────────────────────────────────
export interface VardhiDailyReportItemFormData {
    vardhi_id?: string | null; // null for "Add by Own"
    item_id?: string | null;
    custom_name?: string | null;
    size: string;
    multiplier?: string; // for quantity calculation: size × multiplier
    rate: number | string;
    unit_id: string;
    unit_name: string;        // display only
    ay_id?: string | null;
    ay_no?: string | null;    // display only
    quantity: number | string;
    amount: number | string;
    item_name: string;        // display only (label)
    isCustom: boolean;        // UI flag
}

export interface VardhiDailyReportFormData {
    contractor: string;
    work_name: string;
    file_no: string;
    zone_no: string;
    month_year: string;
    vardhi_ids: string[];
    items: VardhiDailyReportItemFormData[];
}

export interface VardhiDailyReportFilters {
    status?: string;
    search?: string;
}
