export interface ZoneMaster {
    id: string;
    company_id: string;
    file_no: number;
    name: string;
    count?: number;
    amount?: string;
    createdAt: string;
    updatedAt: string;
}

export interface ItemManagement {
    id: string;
    company_id: string;
    item_name: string;
    unit_id: string;
    ay_id?: string;
    work_type: boolean;
    unit: {
        id: string;
        unit_name: string;
    };
    ay?: {
        id: string;
        ay_no: string;
    };
    workTypePrices?: {
        id: string;
        work_type_id: string;
        price: number;
    }[];
    rate?: number | null;
    createdAt: string;
    updatedAt: string;
}

export interface VardhiItem {
    id: string;
    vardhi_id: string;
    item_id: string;
    size: string;
    amount?: string;
    item?: ItemManagement;
    created_at: string;
    updated_at: string;
}

export interface VardhiEmployee {
    id: string;
    vardhi_id: string;
    employee_id: string;
    is_overtime: boolean;
    overtime_hours: string | null;
    rate: string;
    employee?: {
        id: string;
        name: string;
    };
}

export interface VardhiExpense {
    id: string;
    vardhi_id: string;
    particular: string;
    amount: string;
}

export interface VardhiAdditionalItem {
    id: string;
    vardhi_id: string;
    item_name: string;
    qty: string;
    rate: string;
    total: string;
}

export interface VardhiAttachment {
    id: string;
    type: string;
    file_path: string;
    file_name: string;
    file_size: number | null;
    mime_type: string | null;
    created_at: string;
}

export interface Vardhi {
    id: string;
    company_id: string;
    zone_id: string;
    vardhi_number: string;
    global_sequence: number;
    varshi_assign_by: string;
    date: string;
    location: string;
    vardhi_start_date: string;
    vardhi_end_date: string;
    work_type: string;
    is_in_billing: boolean;
    existing_items_total: string;
    additional_items_total: string;
    employees_total?: string;
    expenses_total?: string;
    grand_total: string;
    difference_total: string;
    report_pdf?: string | null;
    site_photography?: string | null;
    site_clear_photo?: string | null;
    other_attachment?: string | null;
    created_at: string;
    updated_at: string;
    zone?: ZoneMaster;
    vardhiItems?: VardhiItem[];
    employees?: VardhiEmployee[];
    expenses?: VardhiExpense[];
    additionalItems?: VardhiAdditionalItem[];
    attachments?: VardhiAttachment[];
    groupedAttachments?: Record<string, VardhiAttachment[]>;
    zone_sequence?: number | null;
    vardhiEmployees?: VardhiEmployee[];
    vardhiExpenses?: VardhiExpense[];
    vardhiAdditionalItems?: VardhiAdditionalItem[];
}

export interface VardhiFormData {
    id?: string;
    name?: string;
    zone_id: string;
    varshi_assign_by: string;
    date: string;
    location: string;
    vardhi_start_date: string;
    vardhi_end_date: string;
    work_type: string;
    total_labor?: string;
    vardhi_expense?: string;
    vardhiItems: VardhiItemFormData[];
    employeeIds: VardhiEmployeeFormData[];
    expenses: VardhiExpenseFormData[];
    additionalItems: VardhiAdditionalItemFormData[];
    zone_name?: string;
    vardhiItems_data?: VardhiItemFormDataWithLabel[];
    nutipole_image?: string;
    report_pdf?: VardhiAttachment[];
    site_photography?: VardhiAttachment[];
    site_clear_photo?: VardhiAttachment[];
    other_attachment?: VardhiAttachment[];
    existing_items_total?: number;
    employees_total?: number;
    expenses_total?: number;
    additional_items_total?: number;
    grand_total?: number;
}

export interface VardhiEmployeeFormData {
    employee_id: string;
    employee_name?: string;
    salary?: number;
    is_overtime: boolean;
    overtime_hours: string;
}

export interface VardhiExpenseFormData {
    particular: string;
    amount: string;
}

export interface VardhiAdditionalItemFormData {
    item_id?: string;
    item_name: string;
    unit_id?: string;
    unit_name?: string;
    size?: string;
    ety: string;
    rate: string;
    amount: string;
    total: string;
}

export interface VardhiItemFormData {
    item_id: string;
    item_name?: string;
    size: string;
    qty: string;
    rate: string;
    amount: string;
}

export interface VardhiItemFormDataWithLabel extends VardhiItemFormData {
    item_name?: string;
}

export interface VardhiFilters {
    zone_id?: string[];
    item_id?: string[];
    date_from?: string;
    date_to?: string;
    start_date_from?: string;
    start_date_to?: string;
    end_date_from?: string;
    end_date_to?: string;
    search?: string;
    month?: string;
}

export interface ApiResponse<T = any> {
    data?: T;
    error?: string;
    message?: string;
    pagination?: PaginationResponse;
}

export interface PaginationResponse {
    page: number;
    limit: number;
    total: number;
    pages: number;
}

export interface PaginatedApiResponse<T> extends ApiResponse<T[]> {
    pagination: PaginationResponse;
}

export interface DropdownOption {
    label: string;
    value: string;
    description?: string;
}

export interface SearchableDropdownProps {
    options: DropdownOption[];
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    loading?: boolean;
    onSearch?: (search: string) => void;
}

export interface VardhiListState {
    data: Vardhi[];
    loading: boolean;
    pagination: {
        page: number;
        totalPages: number;
    };
    search: string;
    sortField: string | null;
    sortOrder: 'asc' | 'desc';
    limit: number;
    filters: VardhiFilters;
}
