export const PARTY_TYPES = [
  { label: 'Buyer', value: 'BUYER' },
  { label: 'Seller', value: 'SELLER' },
];

export const PARTY_TYPE_LABELS: Record<string, string> = {
  BUYER: 'Buyer',
  SELLER: 'Seller',
};

export const PARTY_TYPES_LIST = PARTY_TYPES.map(p => p.value);

export type PartyType = typeof PARTY_TYPES_LIST[number];

export const VOUCHER_TYPES = [
  { label: 'Purchase Voucher', value: 'PURCHASE_VOUCHER' },
  { label: 'Return', value: 'RETURN' },
  { label: 'Journal', value: 'JOURNAL' },
];

export const VOUCHER_TYPE_LABELS: Record<string, string> = {
  'PURCHASE_VOUCHER': 'Purchase Voucher',
  RETURN: 'Return',
  JOURNAL: 'Journal',
};

export const ACCOUNT_TYPES = [
  { label: 'Debit', value: 'DEBIT' },
  { label: 'Credit', value: 'CREDIT' },
];

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  DEBIT: 'Debit',
  CREDIT: 'Credit',
};

export const TRANSACTION_TYPES = [
  { label: 'Local', value: 'LOCAL' },
  { label: 'Inter State', value: 'INTER_STATE' },
];

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  PAYABLE: 'Payable',
  LOCAL: 'Local',
  INTER_STATE: 'Inter State',
};


export const STATUS_OPTIONS = [
  { label: 'Not Started', value: 'NOT_STARTED' },
  // { label: 'Planning', value: 'PLANNING' },
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Completed', value: 'COMPLETED' },
  // { label: 'On Hold', value: 'ON_HOLD' },
  // { label: 'Cancelled', value: 'CANCELLED' },
];

export const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

// =====================================================
// BANK BOOK / LEDGER CONSTANTS
// =====================================================

export const BANK_TRANSACTION_TYPES = [
  { label: 'Receive (Credit)', value: 'CREDIT' },
  { label: 'Pay (Debit)', value: 'DEBIT' },
];

export const BANK_TRANSACTION_TYPE_LABELS: Record<string, string> = {
  CREDIT: 'Receive (Credit)',
  DEBIT: 'Pay (Debit)',
};

export const CASH_TRANSACTION_TYPES = [
  { label: 'Receive (Credit)', value: 'CREDIT' },
  { label: 'Pay (Debit)', value: 'DEBIT' },
];

export const CASH_TRANSACTION_TYPE_LABELS: Record<string, string> = {
  CREDIT: 'Receive (Credit)',
  DEBIT: 'Pay (Debit)',
};

export const LEDGER_TYPES = [
  { label: 'Sales', value: 'SALES' },
  { label: 'Purchase', value: 'PURCHASE' },
  { label: 'Expense', value: 'EXPENSE' },
  { label: 'Income', value: 'INCOME' },
  { label: 'Tender EMD', value: 'TENDER_EMD' },
  { label: 'Tender Fee', value: 'TENDER_FEE' },
  { label: 'Bill Deduction', value: 'BILL_DEDUCTION' },
  { label: 'Receivable', value: 'RECEIVABLE' },
  { label: 'Payable', value: 'PAYABLE' },
  { label: 'Bank', value: 'BANK' },
  { label: 'Cash', value: 'CASH' },
  { label: 'General', value: 'GENERAL' },
];

export const LEDGER_TYPE_LABELS: Record<string, string> = {
  SALES: 'Sales',
  PURCHASE: 'Purchase',
  EXPENSE: 'Expense',
  INCOME: 'Income',
  TENDER_EMD: 'Tender EMD',
  TENDER_FEE: 'Tender Fee',
  BILL_DEDUCTION: 'Bill Deduction',
  RECEIVABLE: 'Receivable',
  PAYABLE: 'Payable',
  BANK: 'Bank',
  CASH: 'Cash',
  GENERAL: 'General',
};

export const REFERENCE_TYPES = [
  { label: 'Invoice', value: 'INVOICE' },
  { label: 'Tender', value: 'TENDER' },
  { label: 'Manual', value: 'MANUAL' },
];

export const REFERENCE_TYPE_LABELS: Record<string, string> = {
  INVOICE: 'Invoice',
  TENDER: 'Tender',
  MANUAL: 'Manual',
};

export const TENDER_EMD_STATUS = [
  { label: 'Holding', value: 'HOLDING' },
  { label: 'Returned', value: 'RETURNED' },
  { label: 'Forfeited', value: 'FORFEITED' },
];

export const TENDER_EMD_STATUS_LABELS: Record<string, string> = {
  HOLDING: 'Holding',
  RETURNED: 'Returned',
  FORFEITED: 'Forfeited',
};

export const PARTY_LEDGER_TYPES = [
  { label: 'Receivable', value: 'RECEIVABLE' },
  { label: 'Payable', value: 'PAYABLE' },
];

export const PARTY_LEDGER_TYPE_LABELS: Record<string, string> = {
  RECEIVABLE: 'Receivable',
  PAYABLE: 'Payable',
};

export const PARTY_LEDGER_REFERENCE_TYPES = [
  { label: 'Purchase Invoice', value: 'PURCHASE_INVOICE' },
  { label: 'Sale Invoice', value: 'SALE_INVOICE' },
  { label: 'Payment', value: 'PAYMENT' },
  { label: 'Receipt', value: 'RECEIPT' },
];

export const PARTY_LEDGER_REFERENCE_TYPE_LABELS: Record<string, string> = {
  PURCHASE_INVOICE: 'Purchase Invoice',
  SALE_INVOICE: 'Sale Invoice',
  PAYMENT: 'Payment',
  RECEIPT: 'Receipt',
};

// Default ledgers for quick selection
export const DEFAULT_LEDGERS = [
  { name: 'Sales', type: 'SALES' },
  { name: 'Purchase', type: 'PURCHASE' },
  { name: 'Tender EMD', type: 'TENDER_EMD' },
  { name: 'Tender Fee', type: 'TENDER_FEE' },
  { name: 'Bill Deduction', type: 'BILL_DEDUCTION' },
  { name: 'Labour Payment', type: 'EXPENSE' },
  { name: 'Salary Payment', type: 'EXPENSE' },
  { name: 'Rent Received', type: 'INCOME' },
  { name: 'Interest Received', type: 'INCOME' },
];