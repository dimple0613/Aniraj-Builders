import * as yup from 'yup';

export const bankAccountSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  account_name: yup.string().required('Account name is required').min(1, 'Account name is required').max(200, 'Account name must be less than 200 characters'),
  account_number: yup.string()
    .required('Account number is required')
    .transform((val) => val?.replace(/\s/g, '').replace(/-/g, ''))
    .matches(/^\d{9,18}$/, 'Account number must be 9-18 digits'),
  bank_name: yup.string().required('Bank name is required').min(1, 'Bank name is required').max(200, 'Bank name must be less than 200 characters'),
  ifsc_code: yup.string().matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format (e.g., SBIN0001234)').optional().transform((val) => val?.toUpperCase() || ''),
  opening_balance: yup.number().min(0, 'Opening balance must be positive').default(0),
  is_active: yup.boolean().default(true),
});

export const bankTransactionSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  account_id: yup.string().uuid().optional(),
  transaction_date: yup.date().required('Transaction date is required'),
  transaction_type: yup.string().oneOf(['DEBIT', 'CREDIT']).required('Transaction type is required'),
  ledger: yup.string().required('Ledger is required').min(1, 'Ledger name is required').max(200, 'Ledger name must be less than 200 characters'),
  ledger_type: yup.string().oneOf(['RECEIVABLE', 'PAYABLE', 'SALES', 'PURCHASE', 'EXPENSE', 'INCOME', 'GENERAL']).optional(),
  project_id: yup.string().uuid().optional(),
  party_id: yup.string().uuid().required('Party is required for both payment and receipt'),
  against_reference: yup.string().max(200).optional(),
  amount: yup.number().min(0, 'Amount must be positive').optional(),
  credit_amount: yup.number().min(0, 'Credit amount must be positive').default(0),
  debit_amount: yup.number().min(0, 'Debit amount must be positive').default(0),
}).test('amount-required', 'Amount or credit/debit amount is required', (values) => {
  const amount = values.amount || 0;
  const credit = values.credit_amount || 0;
  const debit = values.debit_amount || 0;
  return amount > 0 || credit > 0 || debit > 0;
}).test('both-debit-credit', 'Cannot have both debit and credit amounts', (values) => {
  const credit = values.credit_amount || 0;
  const debit = values.debit_amount || 0;
  return !(credit > 0 && debit > 0);
});

export const tenderEMDSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  tender_id: yup.string().required('Tender ID is required'),
  tender_name: yup.string().required('Tender name is required'),
  party_id: yup.string().uuid().optional(),
  amount: yup.number().required('Amount is required').min(0, 'Amount must be positive'),
  status: yup.string().oneOf(['HOLDING', 'RETURNED', 'FORFEITED']).default('HOLDING'),
  received_date: yup.date().required('Received date is required'),
  return_date: yup.date().optional().nullable(),
  remarks: yup.string().optional(),
});

export const partyLedgerSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  party_id: yup.string().uuid().required('Party is required'),
  ledger_type: yup.string().oneOf(['RECEIVABLE', 'PAYABLE']).required('Ledger type is required'),
  reference_type: yup.string().oneOf(['PURCHASE_INVOICE', 'SALE_INVOICE', 'PAYMENT', 'RECEIPT']).optional(),
  reference_id: yup.string().uuid().optional(),
  amount: yup.number().required('Amount is required').min(0, 'Amount must be positive'),
  balance: yup.number().min(0).default(0),
  is_paid: yup.boolean().default(false),
  transaction_date: yup.date().required('Transaction date is required'),
  narration: yup.string().optional(),
});

export const cashBookSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  name: yup.string().required('Cash book name is required').min(1).max(100),
  code: yup.string().required('Code is required').min(1).max(10),
  opening_balance: yup.number().min(0).default(0),
  is_active: yup.boolean().default(true),
});

export const cashTransactionSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  cash_book_id: yup.string().uuid().optional(),
  account_id: yup.string().uuid().optional(),
  transaction_date: yup.date().required('Transaction date is required'),
  transaction_type: yup.string().oneOf(['DEBIT', 'CREDIT']).optional().default('DEBIT'),
  ledger: yup.string().required('Ledger is required').min(1, 'Ledger name is required').max(200, 'Ledger name must be less than 200 characters'),
  ledger_type: yup.string().oneOf(['RECEIVABLE', 'PAYABLE', 'SALES', 'PURCHASE', 'EXPENSE', 'INCOME', 'GENERAL']).optional(),
  project_id: yup.string().uuid().optional().nullable(),
  party_id: yup.string().uuid().required('Party is required for both payment and receipt'),
  particular: yup.string().optional().max(500),
  amount: yup.number().min(0, 'Amount must be positive').optional(),
  credit_amount: yup.number().min(0, 'Credit amount must be positive').default(0),
  debit_amount: yup.number().min(0, 'Debit amount must be positive').default(0),
}).test('amount-required', 'Amount or credit/debit amount is required', (values) => {
  const amount = values.amount || 0;
  const credit = values.credit_amount || 0;
  const debit = values.debit_amount || 0;
  return amount > 0 || credit > 0 || debit > 0;
}).test('both-debit-credit', 'Cannot have both debit and credit amounts', (values) => {
  const credit = values.credit_amount || 0;
  const debit = values.debit_amount || 0;
  return !(credit > 0 && debit > 0);
});

export const chequePrintSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  bank_account_id: yup.string().uuid().required('Bank account is required'),
  party_id: yup.string().uuid().optional(),
  cheque_no: yup.string().required('Cheque number is required').min(1, 'Cheque number is required'),
  amount: yup.number().required('Amount is required').min(0, 'Amount must be positive'),
  cheque_date: yup.date().required('Cheque date is required'),
  payee_name: yup.string().optional(),
  is_printed: yup.boolean().default(false),
});

export const bankSearchSchema = yup.object({
  search: yup.string().optional(),
  account_id: yup.string().uuid().optional(),
  start_date: yup.date().optional().nullable(),
  end_date: yup.date().optional().nullable(),
  project_id: yup.string().uuid().optional(),
  party_id: yup.string().uuid().optional(),
  page: yup.number().min(1).default(1),
  limit: yup.number().min(1).max(100).default(10),
});

export const cashSearchSchema = yup.object({
  search: yup.string().optional(),
  start_date: yup.date().optional().nullable(),
  end_date: yup.date().optional().nullable(),
  project_id: yup.string().uuid().optional(),
  party_id: yup.string().uuid().optional(),
  page: yup.number().min(1).default(1),
  limit: yup.number().min(1).max(100).default(10),
});

export type BankAccountFormData = yup.InferType<typeof bankAccountSchema>;
export type BankTransactionFormData = yup.InferType<typeof bankTransactionSchema>;
export type CashBookFormData = yup.InferType<typeof cashBookSchema>;
export type CashTransactionFormData = yup.InferType<typeof cashTransactionSchema>;
export type ChequePrintFormData = yup.InferType<typeof chequePrintSchema>;
export type BankSearchData = yup.InferType<typeof bankSearchSchema>;
export type CashSearchData = yup.InferType<typeof cashSearchSchema>;
export type TenderEMDFormData = yup.InferType<typeof tenderEMDSchema>;
export type PartyLedgerFormData = yup.InferType<typeof partyLedgerSchema>;
