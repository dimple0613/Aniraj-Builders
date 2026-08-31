import * as yup from 'yup';

export const locationSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  name: yup.string().required('Location name is required').min(1, 'Location name is required'),
  address: yup.string().optional(),
});

export const projectSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  name: yup.string().required('Project name is required').min(1, 'Project name is required'),
  unique_name: yup.string().optional(),
  budget: yup.number().min(0).default(0),
  status: yup.string().oneOf(['DRAFT', 'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']).default('NOT_STARTED'),
  year: yup.string().optional(),
  tender_notice_no: yup.string().required('Tender Notice No is required').min(1, 'Tender Notice No is required'),
  project_no: yup.string().optional(),
  work_type: yup.string().required('Work type is required').min(1, 'Work type is required'),
  sor_id: yup.string().required('SOR is required').min(1, 'SOR is required'),
  department: yup.string().required('Department is required').min(1, 'Department is required'),
  area: yup.string().optional(),
  no_of_locations: yup.number().optional(),
  location_ids: yup.array(yup.string().uuid()).optional(),
  time_limit: yup.string().optional(),
  project_estimation_cost: yup.number().min(0).optional(),
  negotiation_price_id: yup.string().optional(),
  negotiation_price_value: yup.string().optional(),
  negotiation_type: yup.string().optional(),
  tender_premium_id: yup.string().optional(),
  tender_premium_value: yup.string().optional(),
  tender_premium_type: yup.string().optional(),
  loa_approved_no: yup.string().optional(),
  loa_approved_date: yup.date().optional().nullable(),
  project_end_date: yup.date().optional().nullable(),
  time_limit_unit: yup.string().optional(),
  work_order_date: yup.date().optional().nullable(),
  project_approved_amount: yup.number().min(0).optional(),
  agreement_no: yup.string().optional(),
  sd_amount: yup.number().min(0).optional(),
  sd_no: yup.string().optional(),
  sd_start_date: yup.date().optional().nullable(),
  sd_end_date: yup.date().optional().nullable(),
  retention_money_details: yup.string().optional(),
  retention_money_details_no: yup.string().optional(),
  retention_money_details_start_date: yup.date().optional().nullable(),
  retention_money_details_end_date: yup.date().optional().nullable(),
  description: yup.string().optional(),
  location: yup.string().optional(),
  start_date: yup.date().optional().nullable(),
  end_date: yup.date().optional().nullable(),
  place_of_work: yup.string().optional(),
  estimate_amount: yup.number().optional(),
  tender_amount: yup.number().optional(),
  loa_date: yup.date().optional().nullable(),
  time_limit_end: yup.date().optional().nullable(),
  work_completion_date: yup.date().optional().nullable(),
  cost_of_completion: yup.number().optional(),
  main_item_execution_qty: yup.string().optional(),
  work_progress: yup.string().optional(),
  time_period: yup.string().optional(),
  remark: yup.string().optional(),
  is_completed: yup.boolean().optional(),
  progress_item_id: yup.string().uuid().optional().nullable(),
  temp_document_ids: yup.array(yup.string()).optional(),
  project_items: yup.array().optional(),
});

export const projectAreaSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  title: yup.string().required('Area title is required').min(1, 'Area title is required'),
});

export const projectWorkTypeSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  title: yup.string().required('Work type title is required').min(1, 'Work type title is required'),
});

export const projectLocationSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  project_id: yup.string().uuid().required('Project is required'),
  location_id: yup.string().uuid().required('Location is required'),
});

export const projectDocumentSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  project_id: yup.string().uuid().required('Project is required'),
  document_type: yup.string().required('Document type is required').oneOf(['TENDER_NIT', 'ESTIMATE', 'AGREEMENT', 'LOA', 'OTHER'], 'Invalid document type'),
  file_url: yup.string().optional(),
  file_name: yup.string().optional(),
  uploaded_at: yup.date().optional(),
});

export const projectDepositSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  project_id: yup.string().uuid().required('Project is required'),
  deposit_amount: yup.number().required('Deposit amount is required').min(0, 'Deposit amount must be positive'),
  deposit_date: yup.date().required('Deposit date is required'),
  notes: yup.string().optional(),
});

export const projectStatusTrackingSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  project_id: yup.string().uuid().required('Project is required'),
  status: yup.string().required('Status is required').min(1, 'Status is required'),
  remarks: yup.string().optional(),
});

export const projectSearchSchema = yup.object({
  search: yup.string().optional(),
  status: yup.string().oneOf(['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED']).optional(),
  page: yup.number().min(1).default(1),
  limit: yup.number().min(1).max(100).default(10),
});

export type LocationFormData = yup.InferType<typeof locationSchema>;
export type ProjectFormData = yup.InferType<typeof projectSchema>;
export type ProjectWorkTypeFormData = yup.InferType<typeof projectWorkTypeSchema>;
export type ProjectLocationFormData = yup.InferType<typeof projectLocationSchema>;
export type ProjectDocumentFormData = yup.InferType<typeof projectDocumentSchema>;
export type ProjectDepositFormData = yup.InferType<typeof projectDepositSchema>;
export type ProjectStatusTrackingFormData = yup.InferType<typeof projectStatusTrackingSchema>;
export type ProjectSearchData = yup.InferType<typeof projectSearchSchema>;
