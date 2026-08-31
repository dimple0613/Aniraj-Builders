import * as Yup from 'yup';
import { VardhiDailyReportFormData } from '@/types/bill-generated';

export const vardhiDailyReportItemSchema = Yup.object().shape({
    vardhi_id: Yup.string().nullable(),
    item_id: Yup.string().nullable(),
    custom_name: Yup.string().nullable(),
    size: Yup.string().nullable(),
    multiplier: Yup.string().nullable(),
    rate: Yup.number().required('Rate is required').min(0),
    unit_id: Yup.string().required('Unit is required'),
    ay_id: Yup.string().nullable(),
    quantity: Yup.number().required('Quantity is required').min(0),
    amount: Yup.number().required('Amount is required'),
    link: Yup.string().nullable(),
});

export const vardhiDailyReportValidationSchema = Yup.object().shape({
    contractor: Yup.string().required('Contractor is required'),
    work_name: Yup.string().required('Work Name is required'),
    file_no: Yup.string().nullable(),
    zone_no: Yup.string().nullable(),
    month_year: Yup.string().nullable(),
    vardhi_ids: Yup.array().of(Yup.string()).min(1, 'At least one Vardhi is required'),
    items: Yup.array().of(vardhiDailyReportItemSchema).min(1, 'At least one item is required'),
});

export const vardhiDailyReportInitialValues: VardhiDailyReportFormData = {
    contractor: '',
    work_name: '',
    file_no: '',
    zone_no: '',
    month_year: '',
    vardhi_ids: [],
    items: [],
};
