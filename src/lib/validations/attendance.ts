import * as yup from 'yup';

const employeeSchema = yup.object({
  employee_id: yup.string().uuid().required('Employee is required'),
  is_overtime: yup.boolean().default(false),
  overtime_hours: yup.number().min(0).max(16).nullable().optional(),
  wages: yup.number().required('Wages is required'),
});

export const attendanceSchema = yup.object({
  id: yup.string().uuid().optional(),
  company_id: yup.string().uuid().optional(),
  sr_no: yup.number().optional(),
  attendance_date: yup.string().required('Attendance date is required').min(1, 'Attendance date is required'),
  project_id: yup.string().uuid().optional().nullable(),
  employees: yup.array().of(employeeSchema).min(1, 'At least one employee is required'),
});

export const attendanceSearchSchema = yup.object({
  search: yup.string().optional(),
  project_id: yup.string().optional(),
  worker_id: yup.string().optional(),
  start_date: yup.string().optional(),
  end_date: yup.string().optional(),
  page: yup.number().min(1).default(1),
  limit: yup.number().min(1).max(100).default(10),
});

export type AttendanceFormData = yup.InferType<typeof attendanceSchema>;
export type AttendanceSearchData = yup.InferType<typeof attendanceSearchSchema>;