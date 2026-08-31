import * as yup from 'yup';

export const purchaseEntrySchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  entry_date: yup.date().required('Entry date is required'),
  voucher_type: yup.string().oneOf(['PURCHASE_VOUCHER', 'RETURN', 'JOURNAL']).default('PURCHASE_VOUCHER'),
  account_type: yup.string().oneOf(['DEBIT', 'CREDIT', 'PAYABLE']).default('DEBIT'),
  transaction_type: yup.string().oneOf(['LOCAL', 'INTER_STATE']).default('LOCAL'),
  project_id: yup.string().uuid().required('Project is required'),
  party_id: yup.string().uuid().required('Party is required'),
  instrument_no: yup.string().optional().nullable(),
  gst_percent: yup.number().min(0).max(100).default(0),
  gst_total: yup.number().min(0).default(0),
  received_by: yup.string().optional().nullable(),
  custom_name: yup.string().optional().nullable(),
  remark: yup.string().optional().nullable(),
  action_entry: yup.string().optional().nullable(),
}).noUnknown(true, 'Unknown keys in purchase entry');

export const purchaseEntryMaterialSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  purchase_entry_id: yup.string().uuid().optional().nullable(),
  material_id: yup.string().uuid().optional().nullable(),
  capital_sor_id: yup.string().uuid().optional().nullable(),
  qty: yup.number().required('Quantity is required').min(0, 'Quantity must be positive'),
  rate: yup.number().required('Rate is required').min(0, 'Rate must be positive'),
  total: yup.number().min(0),
}).test('has-material-id', 'Material is required', (value) => {
  return !!(value?.material_id || value?.capital_sor_id);
});

export const purchaseEntryLocationSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  purchase_entry_id: yup.string().uuid().required('Purchase entry is required'),
  location_id: yup.string().uuid().required('Location is required'),
});

export const purchaseEntryMaterialExtendedSchema = purchaseEntryMaterialSchema.concat(
  yup.object({
    material_name: yup.string().optional(),
    gst_percent: yup.number().min(0).max(100).optional().default(0),
  })
);

export const purchaseEntryFullSchema = purchaseEntrySchema.concat(
  yup.object({
    materials: yup.array(purchaseEntryMaterialExtendedSchema).min(1, 'At least one material is required').required('Materials are required'),
    location_ids: yup.array(yup.string().uuid()).optional().nullable(),
    update_price: yup.boolean().optional(),
  }).noUnknown(true, 'Unknown keys in purchase entry')
);

export const purchaseSearchSchema = yup.object({
  search: yup.string().optional(),
  voucher_type: yup.string().oneOf(['PURCHASE_VOUCHER', 'RETURN', 'JOURNAL']).optional(),
  project_id: yup.string().uuid().optional(),
  party_id: yup.string().uuid().optional(),
  start_date: yup.date().optional().nullable(),
  end_date: yup.date().optional().nullable(),
  page: yup.number().min(1).default(1),
  limit: yup.number().min(1).max(100).default(10),
});

export type PurchaseEntryFormData = yup.InferType<typeof purchaseEntrySchema>;
export type PurchaseEntryMaterialFormData = yup.InferType<typeof purchaseEntryMaterialSchema>;
export type PurchaseEntryLocationFormData = yup.InferType<typeof purchaseEntryLocationSchema>;
export type PurchaseEntryFullFormData = yup.InferType<typeof purchaseEntryFullSchema>;
export type PurchaseSearchData = yup.InferType<typeof purchaseSearchSchema>;
