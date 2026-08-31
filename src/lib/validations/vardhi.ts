import * as Yup from 'yup';
import { VardhiFormData, VardhiItemFormData } from '@/types/vardhi';
import { normalizeSize, validateSize, calculateSizeFromString, SIZE_ERROR_MESSAGE } from '@/lib/utils/sizeFormatter';

// Vardhi form validation schema
export const vardhiValidationSchema = Yup.object().shape({
    zone_id: Yup.string()
        .required('Zone is required'),

    varshi_assign_by: Yup.string()
        .trim()
        .required('વર્ધી કેવી રીતે મળી? is required')
        .min(2, 'Must be at least 2 characters'),

    date: Yup.string()
        .required('તારીખ is required'),

    location: Yup.string()
        .trim()
        .required('સરનામું is required')
        .min(3, 'Must be at least 3 characters'),

    vardhi_start_date: Yup.string()
        .required('વર્ધી શરૂઆતની તારીખ is required'),

    vardhi_end_date: Yup.string()
        .required('વર્ધી અંતની તારીખ is required')
        .test(
            'is-after-start',
            'End date must be after start date',
            function (value) {
                const { vardhi_start_date } = this.parent;
                if (!vardhi_start_date || !value) return true;
                return new Date(value) >= new Date(vardhi_start_date);
            }
        ),

    work_type: Yup.string()
        .required('Work type is required'),

    vardhiItems: Yup.array()
        .of(
            Yup.object().shape({
                item_id: Yup.string()
                    .required('Item is required'),
                size: Yup.string()
                    .trim()
                    .required('Size is required')
                    .test(
                        'valid-size-format',
                        SIZE_ERROR_MESSAGE,
                        (value) => {
                            if (!value) return true;
                            return validateSize(value);
                        }
                    )
                    .test(
                        'positive-size',
                        'Size must be greater than 0',
                        (value) => {
                            if (!value) return true;
                            const normalized = normalizeSize(value);
                            const size = calculateSizeFromString(normalized);
                            return size > 0;
                        }
                    ),
                qty: Yup.string()
                    .when('item_id', {
                        is: (item_id: string) => item_id,
                        then: (schema) => schema.test(
                            'positive-qty',
                            'Quantity must be greater than 0',
                            (value, context) => {
                                const size = context.parent?.size;
                                if (!size) return true;
                                const calculatedQty = calculateSizeFromString(size);
                                return calculatedQty > 0;
                            }
                        ),
                        otherwise: (schema) => schema.notRequired(),
                    }),
                rate: Yup.string()
                    .test(
                        'positive-rate',
                        'Rate must be greater than 0',
                        function (value) {
                            if (!value) return true;
                            const rate = parseFloat(value);
                            return !isNaN(rate) && rate > 0;
                        }
                    ),
                amount: Yup.string(),
            })
        )
        .min(1, 'At least one item is required')
        .required('Items are required'),

    employeeIds: Yup.array()
        .of(
            Yup.object().shape({
                employee_id: Yup.string()
                    .required('Please select an employee.'),
                is_overtime: Yup.boolean(),
                overtime_hours: Yup.string()
                    .when('is_overtime', {
                        is: true,
                        then: (schema) => schema.required('Overtime hours required').max(16, 'OT Hours cannot exceed 16 hours'),
                        otherwise: (schema) => schema.notRequired(),
                    }),
            })
        )
        .min(1, 'Please add at least one employee.')
        .required('Please add at least one employee.'),

    expenses: Yup.array()
        .of(
            Yup.object().shape({
                particular: Yup.string()
                    .trim()
                    .required('Please enter a particular'),
                amount: Yup.number()
                    .typeError('Please enter a valid amount')
                    .positive('Amount must be greater than 0')
                    .required('Please enter an amount'),
            })
        )
        .min(1, 'Please add at least one expense.')
        .required('Please add at least one expense.'),

    additionalItems: Yup.array()
        .of(
            Yup.object().shape({
                item_id: Yup.string(),
                item_name: Yup.string()
                    .trim()
                    .required('Item name is required'),
                size: Yup.string()
                    .when(['item_id', 'item_name'], {
                        is: (item_id: string, item_name: string) => item_id || item_name,
                        then: (schema) => schema.required('Size is required').test(
                            'valid-size-format',
                            SIZE_ERROR_MESSAGE,
                            (value) => {
                                if (!value) return true;
                                return validateSize(value);
                            }
                        ).test(
                            'positive-size',
                            'Size must be greater than 0',
                            (value) => {
                                if (!value) return true;
                                const normalized = normalizeSize(value);
                                const size = calculateSizeFromString(normalized);
                                return size > 0;
                            }
                        ),
                        otherwise: (schema) => schema.notRequired(),
                    }),
                qty: Yup.string()
                    .when(['item_id', 'item_name'], {
                        is: (item_id: string, item_name: string) => item_id || item_name,
                        then: (schema) => schema.test(
                            'positive-qty',
                            'Quantity must be greater than 0',
                            (value, context) => {
                                const size = context.parent?.size;
                                if (!size) return true;
                                const calculatedQty = calculateSizeFromString(size);
                                return calculatedQty > 0;
                            }
                        ),
                        otherwise: (schema) => schema.notRequired(),
                    }),
                rate: Yup.string()
                    .test(
                        'positive-rate',
                        'Rate must be greater than 0',
                        function (value) {
                            if (!value) return true;
                            const rate = parseFloat(value);
                            return !isNaN(rate) && rate > 0;
                        }
                    ),
                total: Yup.string(),
            })
        )
});

// Vardhi item validation schema (for FieldArray items)
export const vardhiItemValidationSchema = Yup.object().shape({
    item_id: Yup.string()
        .required('Item is required'),
    size: Yup.string()
        .trim()
        .required('Size is required'),
});

// Filter validation schema
export const vardhiFilterValidationSchema = Yup.object().shape({
    zone_id: Yup.array().of(Yup.string()),
    item_id: Yup.array().of(Yup.string()),
    date_from: Yup.date().nullable(),
    date_to: Yup.date()
        .nullable()
        .test(
            'is-after-date-from',
            'End date must be after start date',
            function (value) {
                const { date_from } = this.parent;
                if (!date_from || !value) return true;
                return new Date(value) >= new Date(date_from);
            }
        ),
    start_date_from: Yup.date().nullable(),
    start_date_to: Yup.date()
        .nullable()
        .test(
            'is-after-start-date-from',
            'End date must be after start date',
            function (value) {
                const { start_date_from } = this.parent;
                if (!start_date_from || !value) return true;
                return new Date(value) >= new Date(start_date_from);
            }
        ),
    end_date_from: Yup.date().nullable(),
    end_date_to: Yup.date()
        .nullable()
        .test(
            'is-after-end-date-from',
            'End date must be after start date',
            function (value) {
                const { end_date_from } = this.parent;
                if (!end_date_from || !value) return true;
                return new Date(value) >= new Date(end_date_from);
            }
        ),
    search: Yup.string().trim(),
});

// Initial values for the form
export const vardhiInitialValues = {
    zone_id: '',
    varshi_assign_by: '',
    date: new Date().toISOString().split('T')[0],
    location: '',
    vardhi_start_date: new Date().toISOString().split('T')[0],
    vardhi_end_date: new Date().toISOString().split('T')[0],
    work_type: '',
    vardhiItems: [
        {
            item_id: '',
            item_name: '',
            size: '',
            qty: '',
            rate: '',
            amount: '',
        }
    ],
    employeeIds: [],
    expenses: [],
    additionalItems: [],
    existing_items_total: 0,
    employees_total: 0,
    expenses_total: 0,
    additional_items_total: 0,
    grand_total: 0,
};

// Initial values for filter form
export const vardhiFilterInitialValues = {
    zone_id: [],
    item_id: [],
    date_from: '',
    date_to: '',
    start_date_from: '',
    start_date_to: '',
    end_date_from: '',
    end_date_to: '',
    search: '',
};