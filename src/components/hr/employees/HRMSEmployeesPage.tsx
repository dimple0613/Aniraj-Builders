'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { DataTable, Column } from '@/components/common/DataTable';
import { FormModal } from '@/components/common/FormModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Loader2, Building2, Briefcase, Eye } from 'lucide-react';
import { DepartmentModal } from './DepartmentModal';
import { DesignationModal } from './DesignationModal';
import { DocumentPreviewModal } from './DocumentPreviewModal';
import { toDateInputValue } from '@/lib/date-utils';

interface Employee {
    id: string;
    employee_code: string | null;
    first_name: string;
    last_name: string | null;
    middle_name: string | null;
    name: string;
    email: string | null;
    phone: string | null;
    alternate_phone: string | null;
    gender: string | null;
    date_of_birth: string | null;
    blood_group: string | null;
    marital_status: string | null;
    nationality: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    country: string | null;
    pincode: string | null;
    department_id: string | null;
    designation_id: string | null;
    department?: { id: string; name: string } | null;
    designation?: { id: string; name: string } | null;
    joining_date: string | null;
    confirmation_date: string | null;
    employment_type: string | null;
    shift: string | null;
    reporting_manager: string | null;
    work_location: string | null;
    aadhaar: string | null;
    pan: string | null;
    passport: string | null;
    driving_license: string | null;
    account_holder_name: string | null;
    bank_name: string | null;
    account_number: string | null;
    ifsc_code: string | null;
    branch: string | null;
    emergency_contact_name: string | null;
    emergency_contact_relation: string | null;
    emergency_contact_phone: string | null;
    status: string;
    company_id: string;
    createdAt: string;
    updatedAt: string;
}

interface PaginationInfo {
    page: number;
    pages: number;
    total: number;
    limit: number;
}

interface Department {
    id: string;
    name: string;
}

interface Designation {
    id: string;
    name: string;
}

const GENDER_OPTIONS = [
    { value: 'MALE', label: 'Male' },
    { value: 'FEMALE', label: 'Female' },
    { value: 'OTHER', label: 'Other' },
];

const EMPLOYMENT_TYPE_OPTIONS = [
    { value: 'PERMANENT', label: 'Permanent' },
    { value: 'CONTRACT', label: 'Contract' },
    { value: 'PROBATION', label: 'Probation' },
    { value: 'INTERN', label: 'Intern' },
    { value: 'TEMPORARY', label: 'Temporary' },
];

const SHIFT_OPTIONS = [
    { value: 'Day', label: 'Day' },
    { value: 'Night', label: 'Night' },
    { value: 'Rotating', label: 'Rotating' },
];

const MARITAL_STATUS_OPTIONS = [
    { value: 'SINGLE', label: 'Single' },
    { value: 'MARRIED', label: 'Married' },
    { value: 'DIVORCED', label: 'Divorced' },
    { value: 'WIDOWED', label: 'Widowed' },
];

const BLOOD_GROUP_OPTIONS = [
    'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-',
];

const IDENTITY_DOC_LABELS: Record<string, string> = {
    aadhaar: 'Aadhaar',
    pan: 'PAN',
    passport: 'Passport',
    driving_license: 'Driving License',
};

const employeeValidationSchema = Yup.object({
    employee_code: Yup.string().nullable(),
    first_name: Yup.string().trim().required('First name is required'),
    middle_name: Yup.string().nullable(),
    last_name: Yup.string().nullable(),
    email: Yup.string().nullable().email('Invalid email format'),
    phone: Yup.string().nullable(),
    alternate_phone: Yup.string().nullable(),
    gender: Yup.string().nullable().oneOf(['MALE', 'FEMALE', 'OTHER']),
    date_of_birth: Yup.string().nullable(),
    blood_group: Yup.string().nullable(),
    marital_status: Yup.string().nullable().oneOf(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED']),
    nationality: Yup.string().nullable(),
    address: Yup.string().nullable(),
    city: Yup.string().nullable(),
    state: Yup.string().nullable(),
    country: Yup.string().nullable(),
    pincode: Yup.string().nullable(),
    department_id: Yup.string().nullable(),
    designation_id: Yup.string().nullable(),
    joining_date: Yup.string().nullable(),
    confirmation_date: Yup.string().nullable(),
    employment_type: Yup.string().nullable().oneOf(['PERMANENT', 'CONTRACT', 'PROBATION', 'INTERN', 'TEMPORARY']),
    shift: Yup.string().nullable(),
    reporting_manager: Yup.string().nullable(),
    work_location: Yup.string().nullable(),
    aadhaar: Yup.string().nullable(),
    pan: Yup.string().nullable(),
    passport: Yup.string().nullable(),
    driving_license: Yup.string().nullable(),
    account_holder_name: Yup.string().nullable(),
    bank_name: Yup.string().nullable(),
    account_number: Yup.string().nullable(),
    ifsc_code: Yup.string().nullable(),
    branch: Yup.string().nullable(),
    emergency_contact_name: Yup.string().nullable(),
    emergency_contact_relation: Yup.string().nullable(),
    emergency_contact_phone: Yup.string().nullable(),
});

interface HRMSEmployeesPageProps {
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
}

export function HRMSEmployeesPage({ canCreate = true, canEdit = true, canDelete = true }: HRMSEmployeesPageProps) {
    const [data, setData] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Employee | null>(null);
    const [deleteItem, setDeleteItem] = useState<Employee | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [designations, setDesignations] = useState<Designation[]>([]);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1,
        pages: 1,
        total: 0,
        limit: 10,
    });
    const [deptModalOpen, setDeptModalOpen] = useState(false);
    const [desigModalOpen, setDesigModalOpen] = useState(false);

    // Identity document upload state
    const [identityDocFiles, setIdentityDocFiles] = useState<Record<string, { url: string; name: string }>>({});
    const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
    const savedDocTypes = useRef<Set<string>>(new Set());

    // Document preview state
    const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string } | null>(null);

    const uploadIdentityDoc = async (docType: string, file: File) => {
        try {
            setUploadingDoc(docType);
            const formData = new FormData();
            formData.append('file', file);
            const res = await axios.post('/api/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setIdentityDocFiles((prev) => ({ ...prev, [docType]: { url: res.data.url, name: file.name } }));
            toast.success(`${file.name} uploaded`);
        } catch {
            toast.error('Failed to upload file');
        } finally {
            setUploadingDoc(null);
        }
    };

    const saveIdentityDocuments = useCallback(async (employeeId: string) => {
        const entries = Object.entries(identityDocFiles).filter(([docType]) => !savedDocTypes.current.has(docType));
        if (entries.length === 0) return;

        const existingNames = new Set<string>();
        try {
            const res = await axios.get('/api/hr/documents', { params: { employee_id: employeeId, limit: 100 } });
            (res.data.data || []).forEach((d: { document_name: string }) => existingNames.add(d.document_name));
        } catch {
            // ignore - proceed to create
        }

        for (const [docType, file] of entries) {
            const name = IDENTITY_DOC_LABELS[docType];
            if (!name) continue;
            if (existingNames.has(name)) {
                savedDocTypes.current.add(docType);
                continue;
            }
            try {
                await axios.post('/api/hr/documents', {
                    employee_id: employeeId,
                    document_name: name,
                    file: file.url,
                    expiry_date: null,
                });
                savedDocTypes.current.add(docType);
            } catch {
                // ignore individual failures
            }
        }
    }, [identityDocFiles]);

    const fetchDepartments = useCallback(async () => {
        try {
            const response = await axios.get('/api/departments?limit=100');
            setDepartments(response.data.data || []);
        } catch {
            toast.error('Failed to fetch departments');
        }
    }, []);

    const fetchDesignations = useCallback(async () => {
        try {
            const response = await axios.get('/api/hr/designations?limit=100');
            setDesignations(response.data.data || []);
        } catch {
            toast.error('Failed to fetch designations');
        }
    }, []);

    useEffect(() => {
        fetchDepartments();
        fetchDesignations();
    }, [fetchDepartments, fetchDesignations]);

    const formik = useFormik({
        initialValues: {
            employee_code: '',
            first_name: '',
            middle_name: '',
            last_name: '',
            email: '',
            phone: '',
            alternate_phone: '',
            gender: '',
            date_of_birth: '',
            blood_group: '',
            marital_status: '',
            nationality: '',
            address: '',
            city: '',
            state: '',
            country: '',
            pincode: '',
            department_id: '',
            designation_id: '',
            joining_date: '',
            confirmation_date: '',
            employment_type: '',
            shift: '',
            reporting_manager: '',
            work_location: '',
            aadhaar: '',
            pan: '',
            passport: '',
            driving_license: '',
            account_holder_name: '',
            bank_name: '',
            account_number: '',
            ifsc_code: '',
            branch: '',
            emergency_contact_name: '',
            emergency_contact_relation: '',
            emergency_contact_phone: '',
        },
        validationSchema: employeeValidationSchema,
        validateOnChange: true,
        validateOnBlur: true,
        enableReinitialize: false,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            try {
                const payload = {
                    ...values,
                    first_name: values.first_name.trim(),
                    middle_name: values.middle_name?.trim() || null,
                    last_name: values.last_name?.trim() || null,
                    email: values.email?.trim() || null,
                    phone: values.phone?.trim() || null,
                    alternate_phone: values.alternate_phone?.trim() || null,
                    employee_code: values.employee_code?.trim() || null,
                    aadhaar: values.aadhaar?.trim() || null,
                    pan: values.pan?.trim() || null,
                    passport: values.passport?.trim() || null,
                    driving_license: values.driving_license?.trim() || null,
                    account_holder_name: values.account_holder_name?.trim() || null,
                    bank_name: values.bank_name?.trim() || null,
                    account_number: values.account_number?.trim() || null,
                    ifsc_code: values.ifsc_code?.trim() || null,
                    branch: values.branch?.trim() || null,
                    emergency_contact_name: values.emergency_contact_name?.trim() || null,
                    emergency_contact_relation: values.emergency_contact_relation?.trim() || null,
                    emergency_contact_phone: values.emergency_contact_phone?.trim() || null,
                    address: values.address?.trim() || null,
                    city: values.city?.trim() || null,
                    state: values.state?.trim() || null,
                    country: values.country?.trim() || null,
                    pincode: values.pincode?.trim() || null,
                    nationality: values.nationality?.trim() || null,
                    reporting_manager: values.reporting_manager?.trim() || null,
                    work_location: values.work_location?.trim() || null,
                    gender: values.gender || null,
                    blood_group: values.blood_group || null,
                    marital_status: values.marital_status || null,
                    department_id: values.department_id || null,
                    designation_id: values.designation_id || null,
                    joining_date: values.joining_date || null,
                    confirmation_date: values.confirmation_date || null,
                    employment_type: values.employment_type || null,
                    shift: values.shift || null,
                };

                let employeeId: string | undefined;
                if (editingItem) {
                    await axios.put(`/api/hr/employees/${editingItem.id}`, payload);
                    employeeId = editingItem.id;
                    toast.success('Employee updated successfully');
                } else {
                    const res = await axios.post('/api/hr/employees', payload);
                    employeeId = res.data?.data?.id;
                    toast.success('Employee created successfully');
                }
                if (employeeId) {
                    await saveIdentityDocuments(employeeId);
                }
                setModalOpen(false);
                setEditingItem(null);
                resetForm();
                fetchData(pagination.page);
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save employee');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const fetchData = useCallback(async (page = 1, searchValue = search, pageLimit = limit) => {
        try {
            setLoading(true);
            const response = await axios.get('/api/hr/employees', {
                params: {
                    page,
                    limit: pageLimit,
                    search: searchValue,
                },
            });
            setData(response.data.data);
            setPagination(response.data.pagination);
        } catch {
            toast.error('Failed to fetch employees');
        } finally {
            setLoading(false);
        }
    }, [search, limit]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData(1, search, limit);
        }, 300);
        return () => clearTimeout(timer);
    }, [search, limit, fetchData]);

    const handleEdit = (item: Employee) => {
        if (!canEdit) return;
        setEditingItem(item);
        formik.resetForm({
            values: {
                employee_code: item.employee_code || '',
                first_name: item.first_name || item.name || '',
                middle_name: item.middle_name || '',
                last_name: item.last_name || '',
                email: item.email || '',
                phone: item.phone || '',
                alternate_phone: item.alternate_phone || '',
                gender: item.gender || '',
                date_of_birth: toDateInputValue(item.date_of_birth),
                blood_group: item.blood_group || '',
                marital_status: item.marital_status || '',
                nationality: item.nationality || '',
                address: item.address || '',
                city: item.city || '',
                state: item.state || '',
                country: item.country || '',
                pincode: item.pincode || '',
                department_id: item.department_id || '',
                designation_id: item.designation_id || '',
                joining_date: toDateInputValue(item.joining_date),
                confirmation_date: toDateInputValue(item.confirmation_date),
                employment_type: item.employment_type || '',
                shift: item.shift || '',
                reporting_manager: item.reporting_manager || '',
                work_location: item.work_location || '',
                aadhaar: item.aadhaar || '',
                pan: item.pan || '',
                passport: item.passport || '',
                driving_license: item.driving_license || '',
                account_holder_name: item.account_holder_name || '',
                bank_name: item.bank_name || '',
                account_number: item.account_number || '',
                ifsc_code: item.ifsc_code || '',
                branch: item.branch || '',
                emergency_contact_name: item.emergency_contact_name || '',
                emergency_contact_relation: item.emergency_contact_relation || '',
                emergency_contact_phone: item.emergency_contact_phone || '',
            },
        });
        setModalOpen(true);

        setIdentityDocFiles({});
        savedDocTypes.current.clear();
        axios.get('/api/hr/documents', { params: { employee_id: item.id, limit: 100 } })
            .then((res) => {
                const map: Record<string, { url: string; name: string }> = {};
                (res.data.data || []).forEach((d: { document_name: string; file: string | null }) => {
                    const key = Object.keys(IDENTITY_DOC_LABELS).find((k) => IDENTITY_DOC_LABELS[k] === d.document_name);
                    if (key && d.file) {
                        map[key] = { url: d.file, name: d.document_name };
                        savedDocTypes.current.add(key);
                    }
                });
                setIdentityDocFiles(map);
            })
            .catch(() => { /* ignore */ });
    };

    const handleDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            const response = await axios.delete(`/api/hr/employees/${deleteItem.id}`);
            toast.success(response.data.message || 'Employee deleted successfully');
            setDeleteItem(null);
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete employee');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleAdd = () => {
        if (!canCreate) return;
        setEditingItem(null);
        formik.resetForm({
            values: {
                employee_code: '',
                first_name: '',
                middle_name: '',
                last_name: '',
                email: '',
                phone: '',
                alternate_phone: '',
                gender: '',
                date_of_birth: '',
                blood_group: '',
                marital_status: '',
                nationality: '',
                address: '',
                city: '',
                state: '',
                country: '',
                pincode: '',
                department_id: '',
                designation_id: '',
                joining_date: '',
                confirmation_date: '',
                employment_type: '',
                shift: '',
                reporting_manager: '',
                work_location: '',
                aadhaar: '',
                pan: '',
                passport: '',
                driving_license: '',
                account_holder_name: '',
                bank_name: '',
                account_number: '',
                ifsc_code: '',
                branch: '',
                emergency_contact_name: '',
                emergency_contact_relation: '',
                emergency_contact_phone: '',
            },
        });
        setModalOpen(true);
        setIdentityDocFiles({});
        savedDocTypes.current.clear();
    };

    const columns: Column<Employee>[] = [
        {
            header: 'Employee Code',
            accessorKey: 'employee_code',
            sortable: true,
            cell: (item) => item.employee_code || '-',
        },
        {
            header: 'Name',
            accessorKey: 'name',
            sortable: true,
            cell: (item) => (
                <span className="font-medium">{item.name || [item.first_name, item.last_name].filter(Boolean).join(' ')}</span>
            ),
        },
        {
            header: 'Department',
            accessorKey: 'department_id',
            cell: (item) => item.department?.name || '-',
        },
        {
            header: 'Designation',
            accessorKey: 'designation_id',
            cell: (item) => item.designation?.name || '-',
        },
        {
            header: 'Email',
            accessorKey: 'email',
            cell: (item) => item.email || '-',
        },
        {
            header: 'Phone',
            accessorKey: 'phone',
            cell: (item) => item.phone || '-',
        },
        {
            header: 'Status',
            accessorKey: 'status',
            sortable: true,
            cell: (item) => (
                <Badge variant={item.status === 'ACTIVE' ? 'default' : 'destructive'} className={item.status === 'ACTIVE' ? 'bg-green-600 hover:bg-green-700' : ''}>
                    {item.status}
                </Badge>
            ),
        },
    ];

    const progress = (() => {
        const values = formik.values;
        let filled = 0;
        let total = 0;
        const requiredFields = ['first_name'];
        const optionalFields = [
            'employee_code', 'last_name', 'middle_name', 'email', 'phone', 'alternate_phone',
            'gender', 'date_of_birth', 'blood_group', 'marital_status', 'nationality',
            'address', 'city', 'state', 'country', 'pincode',
            'department_id', 'designation_id', 'joining_date', 'confirmation_date',
            'employment_type', 'shift', 'reporting_manager', 'work_location',
            'aadhaar', 'pan', 'passport', 'driving_license',
            'account_holder_name', 'bank_name', 'account_number', 'ifsc_code', 'branch',
            'emergency_contact_name', 'emergency_contact_relation', 'emergency_contact_phone',
        ];
        requiredFields.forEach(f => { total++; if ((values as any)[f]?.trim()) filled++; });
        optionalFields.forEach(f => { total++; if ((values as any)[f]) filled++; });
        return total > 0 ? Math.round((filled / total) * 100) : 0;
    })();

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
            <div className="shrink-0 flex items-center justify-between">
                <div>
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Employees</h2>
                    <p className="text-muted-foreground text-sm">Manage employee records</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDeptModalOpen(true)} className="h-8 border-dashed">
                        <Building2 className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">Departments</span>
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setDesigModalOpen(true)} className="h-8 border-dashed">
                        <Briefcase className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">Designations</span>
                    </Button>
                </div>
            </div>

            <DataTable
                data={data}
                columns={columns}
                loading={loading}
                pagination={{
                    page: pagination.page,
                    totalPages: pagination.pages,
                    total: pagination.total,
                    limit: pagination.limit,
                }}
                onPageChange={(page) => fetchData(page, search, limit)}
                onSearch={(value) => setSearch(value)}
                onLimitChange={(newLimit) => {
                    setLimit(newLimit);
                    fetchData(1, search, newLimit);
                }}
                onAdd={canCreate ? handleAdd : undefined}
                onEdit={canEdit ? handleEdit : undefined}
                onDelete={canDelete ? (item) => setDeleteItem(item) : undefined}
                searchPlaceholder="Search by name, code, email..."
                addLabel="Add Employee"
            />

            <FormModal
                title={editingItem ? 'Edit Employee' : 'Add Employee'}
                isOpen={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setEditingItem(null);
                    formik.resetForm();
                    setIdentityDocFiles({});
                    savedDocTypes.current.clear();
                }}
                onSubmit={() => formik.handleSubmit()}
                loading={formik.isSubmitting}
                submitLabel={editingItem ? 'Update' : 'Create'}
                size="xl"
                progress={progress}
            >
                <form onSubmit={formik.handleSubmit} className="space-y-6">
                    {/* Personal Information */}
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Personal Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2 relative">
                                <Label htmlFor="first_name">First Name *</Label>
                                <Input id="first_name" {...formik.getFieldProps('first_name')} placeholder="First name" />
                                {formik.touched.first_name && formik.errors.first_name && (
                                    <p className="text-sm text-destructive">{formik.errors.first_name}</p>
                                )}
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="middle_name">Middle Name</Label>
                                <Input id="middle_name" {...formik.getFieldProps('middle_name')} placeholder="Middle name" />
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="last_name">Last Name</Label>
                                <Input id="last_name" {...formik.getFieldProps('last_name')} placeholder="Last name" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <div className="space-y-2 relative">
                                <Label htmlFor="gender">Gender</Label>
                                <Select
                                    value={formik.values.gender || undefined}
                                    onValueChange={(value) => formik.setFieldValue('gender', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select gender" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {GENDER_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="date_of_birth">Date of Birth</Label>
                                <Input id="date_of_birth" type="date" {...formik.getFieldProps('date_of_birth')} />
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="blood_group">Blood Group</Label>
                                <Select
                                    value={formik.values.blood_group || undefined}
                                    onValueChange={(value) => formik.setFieldValue('blood_group', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select blood group" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {BLOOD_GROUP_OPTIONS.map((opt) => (
                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="space-y-2 relative">
                                <Label htmlFor="marital_status">Marital Status</Label>
                                <Select
                                    value={formik.values.marital_status || undefined}
                                    onValueChange={(value) => formik.setFieldValue('marital_status', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select marital status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MARITAL_STATUS_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="nationality">Nationality</Label>
                                <Input id="nationality" {...formik.getFieldProps('nationality')} placeholder="Nationality" />
                            </div>
                        </div>
                    </div>

                    <hr className="border-t" />

                    {/* Contact Information */}
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Contact Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2 relative">
                                <Label htmlFor="email">Email</Label>
                                <Input id="email" type="email" {...formik.getFieldProps('email')} placeholder="email@example.com" />
                                {formik.touched.email && formik.errors.email && (
                                    <p className="text-sm text-destructive">{formik.errors.email}</p>
                                )}
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="phone">Phone</Label>
                                <Input id="phone" {...formik.getFieldProps('phone')} placeholder="Phone number" />
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="alternate_phone">Alternate Phone</Label>
                                <Input id="alternate_phone" {...formik.getFieldProps('alternate_phone')} placeholder="Alternate phone" />
                            </div>
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-1 gap-4 mt-4">
                        <div className="space-y-2 mt-4 relative">
                            <Label htmlFor="address">Address</Label>
                            <Textarea id="address" {...formik.getFieldProps('address')} placeholder="Full address" rows={2} />
                        </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
                            <div className="space-y-2 relative">
                                <Label htmlFor="city">City</Label>
                                <Input id="city" {...formik.getFieldProps('city')} placeholder="City" />
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="state">State</Label>
                                <Input id="state" {...formik.getFieldProps('state')} placeholder="State" />
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="country">Country</Label>
                                <Input id="country" {...formik.getFieldProps('country')} placeholder="Country" />
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="pincode">Pincode</Label>
                                <Input id="pincode" {...formik.getFieldProps('pincode')} placeholder="Pincode" />
                            </div>
                        </div>
                    </div>

                    <hr className="border-t" />

                    {/* Employment Information */}
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Employment Information</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2 relative">
                                <Label htmlFor="employee_code">Employee Code</Label>
                                <Input id="employee_code" {...formik.getFieldProps('employee_code')} placeholder="Employee code" />
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="department_id">Department</Label>
                                <Select
                                    value={formik.values.department_id || undefined}
                                    onValueChange={(value) => formik.setFieldValue('department_id', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select department" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(() => {
                                            const deptList = [...departments];
                                            if (editingItem?.department && editingItem.department_id && !deptList.some(d => d.id === editingItem.department_id)) {
                                                deptList.unshift(editingItem.department as Department);
                                            }
                                            return deptList.map((dept) => (
                                                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                                            ));
                                        })()}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="designation_id">Designation</Label>
                                <Select
                                    value={formik.values.designation_id || undefined}
                                    onValueChange={(value) => formik.setFieldValue('designation_id', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select designation" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {(() => {
                                            const desigList = [...designations];
                                            if (editingItem?.designation && editingItem.designation_id && !desigList.some(d => d.id === editingItem.designation_id)) {
                                                desigList.unshift(editingItem.designation as Designation);
                                            }
                                            return desigList.map((desig) => (
                                                <SelectItem key={desig.id} value={desig.id}>{desig.name}</SelectItem>
                                            ));
                                        })()}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <div className="space-y-2 relative">
                                <Label htmlFor="joining_date">Joining Date</Label>
                                <Input id="joining_date" type="date" {...formik.getFieldProps('joining_date')} />
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="confirmation_date">Confirmation Date</Label>
                                <Input id="confirmation_date" type="date" {...formik.getFieldProps('confirmation_date')} />
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="employment_type">Employment Type</Label>
                                <Select
                                    value={formik.values.employment_type || undefined}
                                    onValueChange={(value) => formik.setFieldValue('employment_type', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {EMPLOYMENT_TYPE_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <div className="space-y-2 relative">
                                <Label htmlFor="shift">Shift</Label>
                                <Select
                                    value={formik.values.shift || undefined}
                                    onValueChange={(value) => formik.setFieldValue('shift', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select shift" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {SHIFT_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="work_location">Work Location</Label>
                                <Input id="work_location" {...formik.getFieldProps('work_location')} placeholder="Work location" />
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="reporting_manager">Reporting Manager</Label>
                                <Input id="reporting_manager" {...formik.getFieldProps('reporting_manager')} placeholder="Reporting manager" />
                            </div>
                        </div>
                    </div>

                    <hr className="border-t" />

                    {/* Identity Documents */}
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Identity Documents</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(['aadhaar', 'pan', 'passport', 'driving_license'] as const).map((docType) => {
                                const file = identityDocFiles[docType];
                                const uploading = uploadingDoc === docType;
                                return (
                                    <div className="space-y-2 relative" key={docType}>
                                        <Label htmlFor={docType}>{IDENTITY_DOC_LABELS[docType]}</Label>
                                        <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                                            <Input
                                                id={docType}
                                                {...formik.getFieldProps(docType)}
                                                placeholder={`${IDENTITY_DOC_LABELS[docType]} number`}
                                            />
                                            <label
                                                htmlFor={`${docType}_file`}
                                                title={`Upload ${IDENTITY_DOC_LABELS[docType]}`}
                                                className="inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-md border border-input bg-muted/30 text-muted-foreground transition-colors hover:border-primary hover:bg-muted hover:text-primary"
                                            >
                                                {uploading ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <Upload className="h-4 w-4" />
                                                )}
                                                <input
                                                    id={`${docType}_file`}
                                                    type="file"
                                                    accept="image/*,application/pdf"
                                                    className="hidden"
                                                    disabled={uploading}
                                                    onChange={(e) => {
                                                        const f = e.target.files?.[0];
                                                        if (f) uploadIdentityDoc(docType, f);
                                                        e.target.value = '';
                                                    }}
                                                />
                                            </label>
                                        </div>
                                        {file && (
                                            <div className="flex items-center gap-2">
                                                <p className="text-xs text-muted-foreground truncate flex-1" title={file.name}>
                                                    {IDENTITY_DOC_LABELS[docType]} attached
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => setPreviewDoc({ url: file.url, name: file.name })}
                                                    className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                                                    title={`Preview ${file.name}`}
                                                >
                                                    <Eye className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    <hr className="border-t" />

                    {/* Bank Details */}
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Bank Details</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2 relative">
                                <Label htmlFor="account_holder_name">Account Holder Name</Label>
                                <Input id="account_holder_name" {...formik.getFieldProps('account_holder_name')} placeholder="Account holder name" />
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="bank_name">Bank Name</Label>
                                <Input id="bank_name" {...formik.getFieldProps('bank_name')} placeholder="Bank name" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                            <div className="space-y-2 relative">
                                <Label htmlFor="account_number">Account Number</Label>
                                <Input id="account_number" {...formik.getFieldProps('account_number')} placeholder="Account number" />
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="ifsc_code">IFSC Code</Label>
                                <Input id="ifsc_code" {...formik.getFieldProps('ifsc_code')} placeholder="IFSC code" />
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="branch">Branch</Label>
                                <Input id="branch" {...formik.getFieldProps('branch')} placeholder="Branch" />
                            </div>
                        </div>
                    </div>

                    <hr className="border-t" />

                    {/* Emergency Contact */}
                    <div>
                        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Emergency Contact</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="space-y-2 relative">
                                <Label htmlFor="emergency_contact_name">Contact Name</Label>
                                <Input id="emergency_contact_name" {...formik.getFieldProps('emergency_contact_name')} placeholder="Emergency contact name" />
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="emergency_contact_relation">Relation</Label>
                                <Input id="emergency_contact_relation" {...formik.getFieldProps('emergency_contact_relation')} placeholder="Relation" />
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="emergency_contact_phone">Phone</Label>
                                <Input id="emergency_contact_phone" {...formik.getFieldProps('emergency_contact_phone')} placeholder="Emergency phone" />
                            </div>
                        </div>
                    </div>
                </form>
            </FormModal>

            <Dialog open={!!deleteItem} onOpenChange={(open: boolean) => !open && setDeleteItem(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Employee</DialogTitle>
                    </DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to delete <strong>{deleteItem?.name}</strong>?
                        <span className="block mt-2 text-red-500 text-sm">This action cannot be undone.</span>
                    </DialogDescription>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteItem(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
                            {deleteLoading ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DepartmentModal
                isOpen={deptModalOpen}
                onClose={() => setDeptModalOpen(false)}
                onSuccess={() => {
                    fetchData(pagination.page, search, limit);
                }}
            />
            <DesignationModal
                isOpen={desigModalOpen}
                onClose={() => setDesigModalOpen(false)}
                onSuccess={() => {
                    fetchData(pagination.page, search, limit);
                }}
            />
            <DocumentPreviewModal
                isOpen={!!previewDoc}
                onClose={() => setPreviewDoc(null)}
                fileUrl={previewDoc?.url || ''}
                fileName={previewDoc?.name || ''}
            />
        </div>
    );
}
