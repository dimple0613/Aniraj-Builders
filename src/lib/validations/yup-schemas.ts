import * as yup from 'yup';

// ==================== Common Reusable Schemas ====================

export const ItemSchema = yup.object().shape({
  id: yup.string().uuid().optional(),
  name: yup.string().required('Name is required').min(1, 'Name is required'),
  is_active: yup.boolean().default(true),
});

export const CommonIdSchema = yup.object().shape({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
});

export const CommonSearchSchema = yup.object().shape({
  search: yup.string().optional(),
  page: yup.number().min(1).default(1),
  limit: yup.number().min(1).max(100).default(10),
});

export const projectValidationSchema = yup.object({
  name: yup
    .string()
    .required('Project name is required')
    .min(2, 'Project name must be at least 2 characters')
    .max(200, 'Project name must be less than 200 characters'),
  
  work_type: yup
    .string()
    .required('Work type is required'),
  
  department: yup
    .string()
    .optional(),
  
  budget: yup
    .number()
    .min(0, 'Budget must be positive')
    .optional(),
  
  project_estimation_cost: yup
    .number()
    .min(0, 'Estimation cost must be positive')
    .optional(),
  
  project_approved_amount: yup
    .number()
    .min(0, 'Approved amount must be positive')
    .optional(),
  
  deposit_amount: yup
    .number()
    .min(0, 'Deposit amount must be positive')
    .default(0),
  
  negotiation_price_id: yup
    .string()
    .optional(),
  
  start_date: yup
    .date()
    .optional()
    .nullable(),
  
  end_date: yup
    .date()
    .optional()
    .nullable()
    .when('start_date', (startDate, schema) => {
      if (startDate) {
        return schema.min(startDate, 'End date must be after start date');
      }
      return schema;
    }),
  
  location_ids: yup
    .array()
    .of(yup.string())
    .optional(),
  
  remark: yup
    .string()
    .max(500, 'Remark must be less than 500 characters')
    .optional(),
});

export const partyValidationSchema = yup.object({
  name: yup
    .string()
    .required('Party name is required')
    .min(2, 'Party name must be at least 2 characters')
    .max(200, 'Party name must be less than 200 characters'),
  
  address: yup
    .string()
    .max(500, 'Address must be less than 500 characters')
    .optional(),
  
  mobile_no: yup
    .string()
    .matches(/^\d{10}$/, 'Mobile number must be 10 digits')
    .optional()
    .transform((value) => value?.replace(/\s/g, '')),
  
  email: yup
    .string()
    .email('Invalid email address')
    .optional(),
  
  gst_no: yup
    .string()
    .matches(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/, 'Invalid GST number format (15 characters required)')
    .optional()
    .transform((value) => value?.toUpperCase()),
  
  type: yup
    .string()
    .required('Party type is required')
    .oneOf(['GENERAL', 'BUYER', 'SELLER', 'EMPLOYEE', 'SUBCONTRACTOR'], 'Invalid party type'),
  
  linked_bank_accounts: yup
    .array()
    .of(yup.string().uuid())
    .optional(),
});

export const bankAccountValidationSchema = yup.object({
  account_name: yup
    .string()
    .required('Account name is required')
    .min(2, 'Account name must be at least 2 characters')
    .max(200, 'Account name must be less than 200 characters'),
  
  account_number: yup
    .string()
    .required('Account number is required')
    .matches(/^[\d\s-]{9,18}$/, 'Account number must be 9-18 digits'),
  
  bank_name: yup
    .string()
    .required('Bank name is required')
    .min(2, 'Bank name must be at least 2 characters')
    .max(200, 'Bank name must be less than 200 characters'),
  
  ifsc_code: yup
    .string()
    .matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format (e.g., SBIN0001234)')
    .optional()
    .transform((value) => value?.toUpperCase()),
  
  opening_balance: yup
    .number()
    .min(0, 'Opening balance must be positive')
    .default(0),
  
  is_active: yup
    .boolean()
    .default(true),
});

export const bankTransactionValidationSchema = yup.object({
  account_id: yup
    .string()
    .required('Bank account is required')
    .test('is-valid-uuid', 'Please select a valid account', (value) => {
      if (!value) return false;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    }),
  
  transaction_date: yup
    .string()
    .required('Transaction date is required'),
  
  transaction_type: yup
    .string()
    .required('Transaction type is required')
    .oneOf(['DEBIT', 'CREDIT'], 'Invalid transaction type'),
  
  ledger: yup
    .string()
    .required('Ledger is required')
    .min(1, 'Ledger name is required')
    .max(200, 'Ledger name must be less than 200 characters'),
  
  project_id: yup
    .string()
    .test('is-valid-uuid', 'Invalid project ID', (value) => {
      if (!value || value === '') return true;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    })
    .nullable()
    .transform((value) => value === '' ? null : value),
  
  party_id: yup
    .string()
    .test('is-valid-uuid', 'Invalid party ID', (value) => {
      if (!value || value === '') return true;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    })
    .nullable()
    .transform((value) => value === '' ? null : value),
  
  against_reference: yup
    .string()
    .max(200, 'Reference must be less than 200 characters')
    .nullable()
    .transform((value) => value === '' ? null : value),
  
  credit_amount: yup
    .number()
    .min(0, 'Amount must be positive')
    .nullable()
    .transform((value) => value === '' || isNaN(value) ? 0 : value),
  
  debit_amount: yup
    .number()
    .min(0, 'Amount must be positive')
    .nullable()
    .transform((value) => value === '' || isNaN(value) ? 0 : value),
}).test(
  'amount-required',
  'Either credit or debit amount is required',
  (values) => {
    const credit = values.credit_amount || 0;
    const debit = values.debit_amount || 0;
    return credit > 0 || debit > 0;
  }
);

export const cashTransactionValidationSchema = yup.object({
  transaction_date: yup
    .string()
    .required('Transaction date is required'),
  
  transaction_type: yup
    .string()
    .required('Transaction type is required')
    .oneOf(['DEBIT', 'CREDIT'], 'Invalid transaction type'),
  
  ledger: yup
    .string()
    .required('Ledger is required')
    .min(1, 'Ledger name is required')
    .max(200, 'Ledger name must be less than 200 characters'),
  
  project_id: yup
    .string()
    .test('is-valid-uuid', 'Invalid project ID', (value) => {
      if (!value || value === '') return true;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    })
    .nullable()
    .transform((value) => value === '' ? null : value),
  
  party_id: yup
    .string()
    .test('is-valid-uuid', 'Invalid party ID', (value) => {
      if (!value || value === '') return true;
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    })
    .nullable()
    .transform((value) => value === '' ? null : value),
  
  credit_amount: yup
    .number()
    .min(0, 'Amount must be positive')
    .nullable()
    .transform((value) => value === '' || isNaN(value) ? 0 : value),
  
  debit_amount: yup
    .number()
    .min(0, 'Amount must be positive')
    .nullable()
    .transform((value) => value === '' || isNaN(value) ? 0 : value),
}).test(
  'amount-required',
  'Either credit or debit amount is required',
  (values) => {
    const credit = values.credit_amount || 0;
    const debit = values.debit_amount || 0;
    return credit > 0 || debit > 0;
  }
);

export const attendanceValidationSchema = yup.object({
  attendance_date: yup
    .date()
    .required('Attendance date is required'),
  
  worker_name: yup
    .string()
    .required('Worker name is required')
    .min(2, 'Worker name must be at least 2 characters'),
  
  project_id: yup
    .string()
    .uuid('Invalid project ID')
    .optional()
    .nullable(),
  
  location_id: yup
    .string()
    .uuid('Invalid location ID')
    .optional()
    .nullable(),
  
  status: yup
    .string()
    .required('Status is required')
    .oneOf(['PRESENT', 'ABSENT', 'LEAVE'], 'Invalid status'),
  
  in_time: yup
    .string()
    .optional(),
  
  out_time: yup
    .string()
    .optional(),
  
  overtime_hours: yup
    .number()
    .min(0, 'Overtime hours must be positive')
    .optional(),
  
  wages: yup
    .number()
    .min(0, 'Wages must be positive')
    .optional(),
  
  remarks: yup
    .string()
    .max(500, 'Remarks must be less than 500 characters')
    .optional(),
});

export const belongingsTransferValidationSchema = yup.object({
  from_project_id: yup
    .string()
    .required('From project is required')
    .uuid('Invalid from project ID'),
  
  to_project_id: yup
    .string()
    .required('To project is required')
    .uuid('Invalid to project ID')
    .test(
      'different-projects',
      'From and To projects must be different',
      (value, context) => value !== context.parent.from_project_id
    ),
  
  transfer_date: yup
    .date()
    .required('Transfer date is required'),
  
  description: yup
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional(),
});

export type ProjectValidationData = yup.InferType<typeof projectValidationSchema>;
export type PartyValidationData = yup.InferType<typeof partyValidationSchema>;
export type BankAccountValidationData = yup.InferType<typeof bankAccountValidationSchema>;
export type BankTransactionValidationData = yup.InferType<typeof bankTransactionValidationSchema>;
export type CashTransactionValidationData = yup.InferType<typeof cashTransactionValidationSchema>;
export type AttendanceValidationData = yup.InferType<typeof attendanceValidationSchema>;
export type BelongingsTransferValidationData = yup.InferType<typeof belongingsTransferValidationSchema>;

// ==================== Project Schemas ====================

export const locationValidationSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  name: yup.string().required('Location name is required').min(1, 'Location name is required'),
  address: yup.string().optional(),
});

export const projectWorkTypeValidationSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  title: yup.string().required('Work type title is required').min(1, 'Work type title is required'),
});

export const projectLocationValidationSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  project_id: yup.string().uuid().required('Project is required'),
  location_id: yup.string().uuid().required('Location is required'),
});

export const projectDocumentValidationSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  project_id: yup.string().uuid().required('Project is required'),
  document_type: yup.string().required('Document type is required').oneOf(['TENDER_NIT', 'ESTIMATE', 'AGREEMENT', 'LOA', 'OTHER'], 'Invalid document type'),
  file_url: yup.string().optional(),
  file_name: yup.string().optional(),
  uploaded_at: yup.date().optional(),
});

export const projectDepositValidationSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  project_id: yup.string().uuid().required('Project is required'),
  deposit_amount: yup.number().required('Deposit amount is required').min(0, 'Deposit amount must be positive'),
  deposit_date: yup.date().required('Deposit date is required'),
  notes: yup.string().optional(),
});

export const projectStatusTrackingValidationSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  project_id: yup.string().uuid().required('Project is required'),
  status: yup.string().required('Status is required').min(1, 'Status is required'),
  remarks: yup.string().optional(),
});

export const projectSearchValidationSchema = yup.object({
  search: yup.string().optional(),
  status: yup.string().oneOf(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']).optional(),
  page: yup.number().min(1).default(1),
  limit: yup.number().min(1).max(100).default(10),
});

// ==================== Bank & Cash Schemas ====================

export const chequePrintValidationSchema = yup.object({
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

export const bankSearchValidationSchema = yup.object({
  search: yup.string().optional(),
  account_id: yup.string().uuid().optional(),
  start_date: yup.date().optional(),
  end_date: yup.date().optional(),
  project_id: yup.string().uuid().optional(),
  party_id: yup.string().uuid().optional(),
  page: yup.number().min(1).default(1),
  limit: yup.number().min(1).max(100).default(10),
});

export const cashSearchValidationSchema = yup.object({
  search: yup.string().optional(),
  start_date: yup.date().optional(),
  end_date: yup.date().optional(),
  project_id: yup.string().uuid().optional(),
  party_id: yup.string().uuid().optional(),
  page: yup.number().min(1).default(1),
  limit: yup.number().min(1).max(100).default(10),
});

// ==================== Party Schemas ====================

export const partyBankAccountValidationSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  party_id: yup.string().uuid().required('Party is required'),
  ref_no: yup.string().optional(),
  account_no: yup.string().required('Account number is required').min(1, 'Account number is required'),
  amount: yup.number().min(0).default(0),
  description: yup.string().optional(),
  ifsc_code: yup.string().optional(),
  bank_name: yup.string().optional(),
});

export const partySearchValidationSchema = yup.object({
  search: yup.string().optional(),
  party_type: yup.string().oneOf(['CUSTOMER', 'VENDOR', 'CONTRACTOR', 'GENERAL']).optional(),
  type: yup.string().oneOf(['BUYER', 'SELLER', 'EMPLOYEE', 'SUBCONTRACTOR', 'GENERAL']).optional(),
  page: yup.number().min(1).default(1),
  limit: yup.number().min(1).max(100).default(10),
});

// ==================== Purchase Schemas ====================

export const purchaseEntryValidationSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  entry_date: yup.date().required('Entry date is required'),
  voucher_type: yup.string().oneOf(['PURCHASE', 'RETURN', 'JOURNAL']).default('PURCHASE'),
  account_type: yup.string().oneOf(['DEBIT', 'CREDIT']).default('DEBIT'),
  transaction_type: yup.string().oneOf(['LOCAL', 'INTER_STATE']).default('LOCAL'),
  project_id: yup.string().uuid().optional(),
  party_id: yup.string().uuid().required('Party is required'),
  instrument_no: yup.string().optional(),
  gst_percent: yup.number().min(0).max(100).default(0),
  gst_total: yup.number().min(0).default(0),
  received_by: yup.string().uuid().optional(),
  remark: yup.string().optional(),
  action_entry: yup.string().optional(),
});

export const purchaseEntryMaterialValidationSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  purchase_entry_id: yup.string().uuid().required('Purchase entry is required'),
  material_id: yup.string().uuid().required('Material is required'),
  qty: yup.number().required('Quantity is required').min(0, 'Quantity must be positive'),
  rate: yup.number().required('Rate is required').min(0, 'Rate must be positive'),
  total: yup.number().min(0),
});

export const purchaseEntryLocationValidationSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  purchase_entry_id: yup.string().uuid().required('Purchase entry is required'),
  location_id: yup.string().uuid().required('Location is required'),
});

export const purchaseEntryFullValidationSchema = purchaseEntryValidationSchema.concat(
  yup.object({
    materials: yup.array(purchaseEntryMaterialValidationSchema.concat(
      yup.object({
        material_name: yup.string().optional(),
      })
    )).min(1, 'At least one material is required').required('Materials are required'),
    location_ids: yup.array(yup.string().uuid()).optional(),
  })
);

export const purchaseSearchValidationSchema = yup.object({
  search: yup.string().optional(),
  voucher_type: yup.string().oneOf(['PURCHASE', 'RETURN', 'JOURNAL']).optional(),
  project_id: yup.string().uuid().optional(),
  party_id: yup.string().uuid().optional(),
  start_date: yup.date().optional(),
  end_date: yup.date().optional(),
  page: yup.number().min(1).default(1),
  limit: yup.number().min(1).max(100).default(10),
});

// ==================== Task Schemas ====================

export const taskValidationSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid(),
  task_type: yup.string().oneOf(['GENERAL', 'PAYMENT', 'PURCHASE', 'FOLLOWUP']).default('GENERAL'),
  title: yup.string().required('Task title is required').min(1, 'Task title is required'),
  reference_id: yup.string().uuid().optional(),
  amount: yup.number().min(0).default(0),
  status: yup.string().oneOf(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('PENDING'),
  due_date: yup.date().optional(),
});

export const taskSearchValidationSchema = yup.object({
  search: yup.string().optional(),
  task_type: yup.string().oneOf(['GENERAL', 'PAYMENT', 'PURCHASE', 'FOLLOWUP']).optional(),
  status: yup.string().oneOf(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  start_date: yup.date().optional(),
  end_date: yup.date().optional(),
  page: yup.number().min(1).default(1),
  limit: yup.number().min(1).max(100).default(10),
});

// ==================== Type Exports ====================

export type LocationValidationData = yup.InferType<typeof locationValidationSchema>;
export type ProjectWorkTypeValidationData = yup.InferType<typeof projectWorkTypeValidationSchema>;
export type ProjectLocationValidationData = yup.InferType<typeof projectLocationValidationSchema>;
export type ProjectDocumentValidationData = yup.InferType<typeof projectDocumentValidationSchema>;
export type ProjectDepositValidationData = yup.InferType<typeof projectDepositValidationSchema>;
export type ProjectStatusTrackingValidationData = yup.InferType<typeof projectStatusTrackingValidationSchema>;
export type ProjectSearchValidationData = yup.InferType<typeof projectSearchValidationSchema>;
export type ChequePrintValidationData = yup.InferType<typeof chequePrintValidationSchema>;
export type BankSearchValidationData = yup.InferType<typeof bankSearchValidationSchema>;
export type CashSearchValidationData = yup.InferType<typeof cashSearchValidationSchema>;
export type PartyBankAccountValidationData = yup.InferType<typeof partyBankAccountValidationSchema>;
export type PartySearchValidationData = yup.InferType<typeof partySearchValidationSchema>;
export type PurchaseEntryValidationData = yup.InferType<typeof purchaseEntryValidationSchema>;
export type PurchaseEntryMaterialValidationData = yup.InferType<typeof purchaseEntryMaterialValidationSchema>;
export type PurchaseEntryLocationValidationData = yup.InferType<typeof purchaseEntryLocationValidationSchema>;
export type PurchaseEntryFullValidationData = yup.InferType<typeof purchaseEntryFullValidationSchema>;
export type PurchaseSearchValidationData = yup.InferType<typeof purchaseSearchValidationSchema>;
export type TaskValidationData = yup.InferType<typeof taskValidationSchema>;
export type TaskSearchValidationData = yup.InferType<typeof taskSearchValidationSchema>;
