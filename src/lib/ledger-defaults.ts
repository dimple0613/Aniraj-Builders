export interface DefaultLedger {
  name: string;
  code: string;
  include_expenses_activity: boolean;
  show_in_cash_book: boolean;
  show_in_bank_book: boolean;
}

export const DEFAULT_LEDGERS: DefaultLedger[] = [
  // Cash Book only
  { name: 'Cash Receipt', code: 'CASH RECEIPT', include_expenses_activity: false, show_in_cash_book: true, show_in_bank_book: false },
  { name: 'Cash Expense', code: 'CASH EXP', include_expenses_activity: true, show_in_cash_book: true, show_in_bank_book: false },
  { name: 'Salary Expense', code: 'SALARY EXP', include_expenses_activity: true, show_in_cash_book: true, show_in_bank_book: false },
  { name: 'Rent Expense', code: 'RENT EXP', include_expenses_activity: true, show_in_cash_book: true, show_in_bank_book: false },
  { name: 'Diesel Expense', code: 'DIESEL EXP', include_expenses_activity: true, show_in_cash_book: true, show_in_bank_book: false },
  { name: 'Toll Expense', code: 'TOLL EXP', include_expenses_activity: true, show_in_cash_book: true, show_in_bank_book: false },
  { name: 'Purchase Expense', code: 'PURCHASE EXP', include_expenses_activity: true, show_in_cash_book: true, show_in_bank_book: false },
  { name: 'Stationery Expense', code: 'STATIONERY EXP', include_expenses_activity: true, show_in_cash_book: true, show_in_bank_book: false },
  { name: 'Misc Expense', code: 'MISC EXP', include_expenses_activity: true, show_in_cash_book: true, show_in_bank_book: false },

  // Bank Book only
  { name: 'Sales', code: 'SALES', include_expenses_activity: false, show_in_cash_book: false, show_in_bank_book: true },
  { name: 'Purchase Return', code: 'PURCHASE_RETURN', include_expenses_activity: false, show_in_cash_book: false, show_in_bank_book: true },
  { name: 'Purchase', code: 'PURCHASE', include_expenses_activity: true, show_in_cash_book: false, show_in_bank_book: true },
  { name: 'Sales Return', code: 'SALES_RETURN', include_expenses_activity: false, show_in_cash_book: false, show_in_bank_book: true },
  { name: 'Expense', code: 'EXPENSE', include_expenses_activity: true, show_in_cash_book: false, show_in_bank_book: true },
  { name: 'Tender EMD Refund', code: 'TENDER_EMD_REFUND', include_expenses_activity: false, show_in_cash_book: false, show_in_bank_book: true },
  { name: 'Tender Fee Paid', code: 'TENDER_FEE_PAID', include_expenses_activity: true, show_in_cash_book: false, show_in_bank_book: true },
  { name: 'Bill Deduction Paid', code: 'BILL_DEDUCTION_PAID', include_expenses_activity: true, show_in_cash_book: false, show_in_bank_book: true },

  // Both Cash Book & Bank Book
  { name: 'Income', code: 'INCOME', include_expenses_activity: false, show_in_cash_book: true, show_in_bank_book: true },
  { name: 'Receivable', code: 'RECEIVABLE', include_expenses_activity: false, show_in_cash_book: true, show_in_bank_book: true },
  { name: 'Payable', code: 'PAYABLE', include_expenses_activity: true, show_in_cash_book: true, show_in_bank_book: true },
  { name: 'General Receipt', code: 'GENERAL_RECEIPT', include_expenses_activity: false, show_in_cash_book: true, show_in_bank_book: true },
  { name: 'General Payment', code: 'GENERAL_PAYMENT', include_expenses_activity: true, show_in_cash_book: true, show_in_bank_book: true },
  { name: 'Tender EMD', code: 'TENDER_EMD', include_expenses_activity: false, show_in_cash_book: true, show_in_bank_book: true },
  { name: 'Tender Fee', code: 'TENDER_FEE', include_expenses_activity: false, show_in_cash_book: true, show_in_bank_book: true },
  { name: 'Bill Deduction', code: 'BILL_DEDUCTION', include_expenses_activity: false, show_in_cash_book: true, show_in_bank_book: true },
];

export function generateLedgerCode(name: string): string {
  return name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}