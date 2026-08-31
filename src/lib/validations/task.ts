import * as yup from 'yup';

export const taskSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().required('Company ID is required'),
  task_type: yup.string().oneOf(['GENERAL', 'PAYMENT', 'PURCHASE', 'FOLLOWUP']).default('GENERAL'),
  title: yup.string().required('Task title is required').min(1, 'Task title is required'),
  reference_id: yup.string().uuid().optional(),
  amount: yup.number().min(0).default(0),
  status: yup.string().oneOf(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('PENDING'),
  due_date: yup.date().optional().nullable(),
});

export const belongingsTransferSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().required('Company ID is required'),
  from_project_id: yup.string().uuid().required('From project is required'),
  to_project_id: yup.string().uuid().required('To project is required')
    .test('different-projects', 'From and To projects must be different', (value, context) => value !== context.parent.from_project_id),
  description: yup.string().optional(),
  transfer_date: yup.date().required('Transfer date is required'),
});

export const taskSearchSchema = yup.object({
  search: yup.string().optional(),
  task_type: yup.string().oneOf(['GENERAL', 'PAYMENT', 'PURCHASE', 'FOLLOWUP']).optional(),
  status: yup.string().oneOf(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  start_date: yup.date().optional().nullable(),
  end_date: yup.date().optional().nullable(),
  page: yup.number().min(1).default(1),
  limit: yup.number().min(1).max(100).default(10),
});

export type TaskFormData = yup.InferType<typeof taskSchema>;
export type BelongingsTransferFormData = yup.InferType<typeof belongingsTransferSchema>;
export type TaskSearchData = yup.InferType<typeof taskSearchSchema>;
