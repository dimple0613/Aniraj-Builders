import * as yup from 'yup';

const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

export const partySchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  name: yup.string().required('Party name is required').min(1, 'Party name is required').max(200, 'Name must be less than 200 characters'),
  address: yup.string().max(500, 'Address must be less than 500 characters').optional(),
  mobile_no: yup.string().matches(/^\d{10}$/, 'Mobile number must be 10 digits').optional().transform((val) => val || ''),
  email: yup.string().email('Invalid email address').optional().transform((val) => val || ''),
  gst_no: yup.string().matches(/^\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}[Z]{1}[A-Z\d]{1}$/, 'Invalid GST number format').optional().transform((val) => val?.toUpperCase() || ''),
  party_type: yup.string().oneOf(['CUSTOMER', 'VENDOR', 'CONTRACTOR', 'GENERAL']).default('GENERAL'),
  type: yup.string().oneOf(['BUYER', 'SELLER', 'EMPLOYEE', 'SUBCONTRACTOR', 'GENERAL']).default('GENERAL'),
  hide_project_items: yup.boolean().default(false),
  
  // Bank account - optional for EMPLOYEE, required for CUSTOMER/VENDOR
  account_id: yup.string().uuid().when('type', {
    is: (val: string) => val === 'EMPLOYEE',
    then: (schema) => schema.nullable().optional(),
    otherwise: (schema) => schema.nullable(), // Required validation handled at form level based on party type
  }),
  
  // Inline bank details for party (alternative to linking account_id)
  bank_account_name: yup.string().when(['type', 'account_id'], {
    is: (type: string, accountId: string) => type !== 'EMPLOYEE' && !accountId,
    then: (schema) => schema.required('Bank account name is required for Customer/Vendor'),
    otherwise: (schema) => schema.nullable().transform((val) => val || null),
  }),
  bank_account_number: yup.string().when(['type', 'account_id'], {
    is: (type: string, accountId: string) => type !== 'EMPLOYEE' && !accountId,
    then: (schema) => schema.required('Account number is required').min(8, 'Account number must be at least 8 digits'),
    otherwise: (schema) => schema.nullable().transform((val) => val || null),
  }),
  bank_name: yup.string().when(['type', 'account_id'], {
    is: (type: string, accountId: string) => type !== 'EMPLOYEE' && !accountId,
    then: (schema) => schema.required('Bank name is required'),
    otherwise: (schema) => schema.nullable().transform((val) => val || null),
  }),
  bank_ifsc_code: yup.string().when(['type', 'account_id'], {
    is: (type: string, accountId: string) => type !== 'EMPLOYEE' && !accountId,
    then: (schema) => schema.required('IFSC code is required').matches(ifscRegex, 'Invalid IFSC code format (e.g., SBIN0001234)'),
    otherwise: (schema) => schema.nullable().transform((val) => val || null),
  }),
  bank_opening_balance: yup.number().when(['type', 'account_id'], {
    is: (type: string, accountId: string) => type !== 'EMPLOYEE' && !accountId,
    then: (schema) => schema.required('Opening balance is required').min(0, 'Opening balance must be >= 0'),
    otherwise: (schema) => schema.nullable().transform((val) => val ?? null),
  }),
});

export const partyBankAccountSchema = yup.object({
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

export const partySearchSchema = yup.object({
  search: yup.string().optional(),
  party_type: yup.string().oneOf(['CUSTOMER', 'VENDOR', 'CONTRACTOR', 'GENERAL']).optional(),
  type: yup.string().oneOf(['BUYER', 'SELLER', 'EMPLOYEE', 'SUBCONTRACTOR', 'GENERAL']).optional(),
  page: yup.number().min(1).default(1),
  limit: yup.number().min(1).max(100).default(10),
});

export type PartyFormData = yup.InferType<typeof partySchema>;
export type PartyBankAccountFormData = yup.InferType<typeof partyBankAccountSchema>;
export type PartySearchData = yup.InferType<typeof partySearchSchema>;
