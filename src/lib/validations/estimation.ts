import * as Yup from 'yup';
import { VardhiDailyReportItemFormData, VardhiDailyReportFormData } from '@/types/vardhi-daily-report';

export const estimationItemValidationSchema = Yup.object().shape({
    vardhi_id: Yup.string().nullable(),
    item_id: Yup.string().nullable(),
    custom_name: Yup.string().nullable(),
    size: Yup.string().nullable(),
    multiplier: Yup.string().nullable(),
    rate: Yup.number().required('Rate is required').min(0, 'Rate must be positive'),
    unit_id: Yup.string().required('Unit is required'),
    ay_id: Yup.string().nullable(),
    quantity: Yup.number().required('Quantity is required').min(0, 'Quantity must be positive'),
    amount: Yup.number().required('Amount is required'),
});

export const estimationValidationSchema = Yup.object().shape({
    contractor: Yup.string().required('Contractor is required').min(2, 'Contractor name must be at least 2 characters'),
    work_name: Yup.string().required('Work Name is required').min(2, 'Work name must be at least 2 characters'),
    file_no: Yup.string().nullable(),
    zone_no: Yup.string().nullable(),
    month_year: Yup.string().nullable(),
    vardhi_ids: Yup.array().of(Yup.string()).min(1, 'At least one Vardhi is required'),
    items: Yup.array().of(estimationItemValidationSchema).min(1, 'At least one item is required'),
});

export const estimationInitialValues: VardhiDailyReportFormData = {
    contractor: '',
    work_name: '',
    file_no: '',
    zone_no: '',
    month_year: '',
    vardhi_ids: [],
    items: [],
};

export const manjuriValidationSchema = Yup.object().shape({
    contractor: Yup.string().required('Contractor is required'),
    work_name: Yup.string().required('Work Name is required'),
    file_no: Yup.string().nullable(),
    zone_no: Yup.string().nullable(),
    month_year: Yup.string().nullable(),
    vardhi_ids: Yup.array().of(Yup.string()).min(1, 'At least one Vardhi is required'),
    items: Yup.array().of(estimationItemValidationSchema).min(1, 'At least one item is required'),
});

export const manjuriInitialValues: VardhiDailyReportFormData = {
    contractor: '',
    work_name: '',
    file_no: '',
    zone_no: '',
    month_year: '',
    vardhi_ids: [],
    items: [],
};
