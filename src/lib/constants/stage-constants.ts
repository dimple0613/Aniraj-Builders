export const STAGE_FIELDS = [
    'file_submitted_date',
    'store_report_date',
    'submitted_for_approved_date',
    'approved_date',
    'bill_prepaid_date',
    'bill_audit_date',
    'bill_account_date',
    'payment_received_date',
] as const;

export const STAGE_KEYS = [
    'file_submitted',
    'store_report',
    'submitted_for_approved',
    'approved',
    'bill_prepaid',
    'bill_audit',
    'bill_account',
    'payment_received',
] as const;

export const STAGES = [
    { key: "file_submitted", label: "File Created", dateField: "file_submitted_date" },
    { key: "store_report", label: "Store Report", dateField: "store_report_date" },
    { key: "submitted_for_approved", label: "Submitted for Approved", dateField: "submitted_for_approved_date" },
    { key: "approved", label: "Approved", dateField: "approved_date", needsApprovedNo: true },
    { key: "bill_prepaid", label: "Bill Prepaid", dateField: "bill_prepaid_date" },
    { key: "bill_audit", label: "Bill Audit", dateField: "bill_audit_date" },
    { key: "bill_account", label: "Bill Account", dateField: "bill_account_date" },
    { key: "payment_received", label: "Payment Received", dateField: "payment_received_date" },
] as const;

export type StageField = typeof STAGE_FIELDS[number];
export type StageKey = typeof STAGE_KEYS[number];

export interface StageData {
    current_stage?: string | null;
    file_submitted_date?: string | null;
    store_report_date?: string | null;
    submitted_for_approved_date?: string | null;
    approved_date?: string | null;
    approved_no?: string | null;
    bill_prepaid_date?: string | null;
    bill_audit_date?: string | null;
    bill_account_date?: string | null;
    payment_received_date?: string | null;
}

export interface StageConfig {
    key: string;
    label: string;
    dateField: keyof StageData;
    needsApprovedNo?: boolean;
}
