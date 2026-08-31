'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { DataTable, Column } from '@/components/common/DataTable';
import { FormModal } from '@/components/common/FormModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Labels } from '@/components/ui/labels';
import { Info } from 'lucide-react';
import { toDateInputValue, formatDateDisplay } from '@/lib/date-utils';

interface Employee {
    id: string;
    name: string;
    employee_code: string;
}

interface SalaryComponent {
    id: string;
    code: string | null;
    name: string;
    type: 'EARNING' | 'DEDUCTION';
    calculation_type: 'FIXED' | 'PERCENTAGE';
    default_value: number;
    is_standard: boolean;
}

interface EmpSalaryComponent {
    id?: string;
    salary_component_id: string;
    amount: number;
    calculation_type: string;
    salaryComponent?: { id: string; name: string; type: string; code: string | null };
}

interface EmployeeSalary {
    id: string;
    employee_id: string;
    employee?: Employee;
    effective_from: string;
    effective_to?: string | null;
    gross_salary: number;
    components?: EmpSalaryComponent[];
    createdAt: string;
    updatedAt: string;
}

interface PaginationInfo {
    page: number;
    pages: number;
    total: number;
    limit: number;
}

interface FieldDef {
    code: string;
    label: string;
    required?: boolean;
    toggle?: boolean;
}

const EARNING_FIELDS: FieldDef[] = [
    { code: 'BASIC', label: 'Basic Salary', required: true },
    { code: 'HRA', label: 'HRA (House Rent Allowance)' },
    { code: 'DA', label: 'DA (Dearness Allowance)' },
    { code: 'MEDICAL', label: 'Medical Allowance' },
    { code: 'TRAVEL', label: 'Travel Allowance' },
    { code: 'SPECIAL', label: 'Special Allowance' },
    { code: 'BONUS', label: 'Bonus (Optional)' },
];

function Switch({ checked, onChange, id, className }: { checked: boolean; onChange: (v: boolean) => void; id?: string; className?: string }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            id={id}
            onClick={() => onChange(!checked)}
            className={cn(
                'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                checked ? 'bg-primary' : 'bg-gray-300',
                className
            )}
        >
            <span
                className={cn(
                    'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                    checked ? 'translate-x-4' : 'translate-x-0.5'
                )}
            />
        </button>
    );
}

const DEDUCTION_FIELDS: FieldDef[] = [
    { code: 'PF', label: 'Provident Fund (PF)', toggle: true },
    { code: 'ESI', label: 'Employee State Insurance (ESI)', toggle: true },
    { code: 'PT', label: 'Professional Tax (PT)' },
    { code: 'TDS', label: 'Tax Deducted at Source (TDS)' },
];

const ALL_CODES = [...EARNING_FIELDS, ...DEDUCTION_FIELDS].map((f) => f.code);

const validationSchema = Yup.object({
    employee_id: Yup.string().required('Employee is required'),
    effective_from: Yup.string().optional(),
});

export function EmployeeSalariesClient({ canCreate = true, canEdit = true, canDelete = true }) {
    const [data, setData] = useState<EmployeeSalary[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<EmployeeSalary | null>(null);
    const [deleteItem, setDeleteItem] = useState<EmployeeSalary | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [salaryComponents, setSalaryComponents] = useState<SalaryComponent[]>([]);
    const [loadingDefaults, setLoadingDefaults] = useState(false);
    const [amounts, setAmounts] = useState<Record<string, number>>({});
    const [enabled, setEnabled] = useState<Record<string, boolean>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [grossSalary, setGrossSalary] = useState(0);
    const [totalDeductions, setTotalDeductions] = useState(0);
    const [netSalary, setNetSalary] = useState(0);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1, pages: 1, total: 0, limit: 10,
    });

    const codeToId: Record<string, string> = {};
    salaryComponents.forEach((c) => {
        if (c.code && ALL_CODES.includes(c.code)) codeToId[c.code] = c.id;
    });
    const missingCodes = ALL_CODES.filter((code) => !codeToId[code]);

    const fetchDropdowns = useCallback(async () => {
        try {
            const [empRes, scRes] = await Promise.all([
                axios.get('/api/hr/employees', { params: { limit: 200 } }),
                axios.get('/api/hr/salary-components', { params: { limit: 200 } }),
            ]);
            setEmployees(empRes.data.data || []);
            setSalaryComponents(scRes.data.data || []);
        } catch {
            toast.error('Failed to load dropdown data');
        }
    }, []);

    useEffect(() => { fetchDropdowns(); }, [fetchDropdowns]);

    const computeGross = (amountMap: Record<string, number>, enabledMap: Record<string, boolean> = enabled) => {
        const total = EARNING_FIELDS.reduce((sum, f) => sum + (Number(amountMap[f.code]) || 0), 0);
        const deductionTotal = DEDUCTION_FIELDS.reduce((sum, f) => {
            if (f.toggle && !enabledMap[f.code]) return sum;
            return sum + (Number(amountMap[f.code]) || 0);
        }, 0);
        setGrossSalary(total);
        setTotalDeductions(deductionTotal);
        setNetSalary(total - deductionTotal);
        return total;
    };

    const setAmount = (code: string, value: number) => {
        const next = { ...amounts, [code]: value };
        setAmounts(next);
        computeGross(next);
    };

    const formik = useFormik({
        initialValues: { employee_id: '', effective_from: '', effective_to: '' },
        validationSchema,
        validateOnChange: true,
        validateOnBlur: true,
        enableReinitialize: true,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            const validationErrors: Record<string, string> = {};
            if (!values.employee_id) validationErrors.employee_id = 'Employee is required';
            const basic = Number(amounts['BASIC']) || 0;
            if (basic <= 0) validationErrors['BASIC'] = 'Basic Salary must be greater than 0';

            const components: any[] = [];
            for (const f of EARNING_FIELDS) {
                const id = codeToId[f.code];
                if (id) {
                    const amt = Number(amounts[f.code]) || 0;
                    if (amt < 0) validationErrors[f.code] = 'Amount cannot be negative';
                    components.push({ salary_component_id: id, amount: amt, calculation_type: 'FIXED' });
                }
            }
            for (const f of DEDUCTION_FIELDS) {
                const id = codeToId[f.code];
                if (!id) continue;
                if (f.toggle && !enabled[f.code]) continue;
                const amt = Number(amounts[f.code]) || 0;
                if (amt < 0) validationErrors[f.code] = 'Amount cannot be negative';
                components.push({ salary_component_id: id, amount: amt, calculation_type: 'FIXED' });
            }

            if (Object.keys(validationErrors).length > 0) {
                setErrors(validationErrors);
                setSubmitting(false);
                return;
            }

            try {
                const payload = {
                    ...values,
                    effective_from: values.effective_from || null,
                    effective_to: values.effective_to || null,
                    gross_salary: computeGross(amounts),
                    components,
                };
                if (editingItem) {
                    await axios.put(`/api/hr/employee-salaries/${editingItem.id}`, payload);
                    toast.success('Employee salary updated successfully');
                } else {
                    await axios.post('/api/hr/employee-salaries', payload);
                    toast.success('Employee salary created successfully');
                }
                setModalOpen(false);
                setEditingItem(null);
                resetForm();
                setAmounts({});
                setEnabled({});
                setGrossSalary(0);
                setErrors({});
                fetchData(pagination.page);
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save employee salary');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const progress = useMemo(() => {
        let filled = 0;
        let total = 0;
        const baseFields = [formik.values.employee_id, formik.values.effective_from];
        baseFields.forEach((v) => { total++; if (v && String(v).trim() !== '') filled++; });
        EARNING_FIELDS.forEach((f) => {
            total++;
            const val = amounts[f.code];
            if (val !== undefined && val !== 0) filled++;
        });
        DEDUCTION_FIELDS.forEach((f) => {
            total++;
            const val = amounts[f.code];
            if (f.toggle) {
                if (enabled[f.code] && val !== undefined && val !== 0) filled++;
            } else {
                if (val !== undefined && val !== 0) filled++;
            }
        });
        return total > 0 ? Math.round((filled / total) * 100) : 0;
    }, [formik.values, amounts, enabled]);

    const fetchData = useCallback(async (page = 1, searchValue = search, pageLimit = limit) => {
        try {
            setLoading(true);
            const response = await axios.get('/api/hr/employee-salaries', {
                params: { page, limit: pageLimit, search: searchValue },
            });
            setData(response.data.data);
            setPagination(response.data.pagination);
        } catch {
            toast.error('Failed to fetch employee salaries');
        } finally {
            setLoading(false);
        }
    }, [search, limit]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const resetFormState = () => {
        setAmounts({});
        setEnabled({});
        setGrossSalary(0);
        setTotalDeductions(0);
        setNetSalary(0);
        setErrors({});
        formik.resetForm({ values: { employee_id: '', effective_from: '', effective_to: '' } });
    };

    const handleEdit = async (item: EmployeeSalary) => {
        setEditingItem(item);
        setModalOpen(true);
        formik.setValues({
            employee_id: item.employee_id,
            effective_from: toDateInputValue(item.effective_from),
            effective_to: toDateInputValue(item.effective_to),
        });
        try {
            const res = await axios.get(`/api/hr/employee-salaries/${item.id}`);
            const salary = res.data.data || res.data;
            const comps: EmpSalaryComponent[] = salary.components || [];
            const nextAmounts: Record<string, number> = {};
            const nextEnabled: Record<string, boolean> = {};
            comps.forEach((c) => {
                const code = c.salaryComponent?.code;
                if (!code || !ALL_CODES.includes(code)) return;
                nextAmounts[code] = Number(c.amount || 0);
                if (c.salaryComponent?.type === 'DEDUCTION' && (code === 'PF' || code === 'ESI')) {
                    nextEnabled[code] = Number(c.amount || 0) > 0;
                }
            });
            setAmounts(nextAmounts);
            setEnabled(nextEnabled);
            computeGross(nextAmounts, nextEnabled);
        } catch {
            setAmounts({});
        }
    };

    const handleDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            const response = await axios.delete(`/api/hr/employee-salaries/${deleteItem.id}`);
            toast.success(response.data.message || 'Employee salary deleted successfully');
            setDeleteItem(null);
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete employee salary');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingItem(null);
        const init: Record<string, number> = {};
        salaryComponents.forEach((c) => {
            if (c.code && ALL_CODES.includes(c.code)) {
                init[c.code] = Number(c.default_value) || 0;
            }
        });
        setAmounts(init);
        setEnabled({});
        setErrors({});
        computeGross(init, {});
        formik.resetForm({ values: { employee_id: '', effective_from: '', effective_to: '' } });
        setModalOpen(true);
    };

    const handleLoadDefaults = async () => {
        try {
            setLoadingDefaults(true);
            await axios.post('/api/hr/salary-components/seed-defaults');
            toast.success('Default components loaded');
            await fetchDropdowns();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to load defaults');
        } finally {
            setLoadingDefaults(false);
        }
    };

    const fmt = (n: number) => `₹${Number(n || 0).toLocaleString()}`;

    const columns: Column<EmployeeSalary>[] = [
        { header: 'Employee', accessorKey: 'employee', cell: (item) => item.employee?.name || '-' },
        { header: 'Effective From', accessorKey: 'effective_from', cell: (item) => item.effective_from ? formatDateDisplay(item.effective_from) : '-' },
        { header: 'Effective To', accessorKey: 'effective_to', cell: (item) => (item.effective_to ? formatDateDisplay(item.effective_to) : '-') },
        { header: 'Gross Salary', accessorKey: 'gross_salary', cell: (item) => fmt(item.gross_salary) },
    ];

    const renderField = (field: FieldDef) => {
        const value = amounts[field.code] ?? 0;
        const isEnabled = !!enabled[field.code];
        return (
            <div key={field.code} className="space-y-2 relative">
                <Label htmlFor={field.code} className="text-sm font-medium leading-tight">
                    {field.label}{field.required ? ' *' : ''}
                </Label>
                {field.toggle ? (
                    <div className="flex items-center gap-2">
                        <Input
                            id={field.code}
                            type="number"
                            step="0.01"
                            min="0"
                            inputMode="decimal"
                            placeholder={isEnabled ? '0.00' : 'Enable to enter'}
                            disabled={!isEnabled}
                            value={value === 0 ? '' : value}
                            onChange={(e) => setAmount(field.code, parseFloat(e.target.value) || 0)}
                            className="flex-1"
                        />
                        <Switch
                            id={`${field.code}_toggle`}
                            checked={isEnabled}
                            onChange={(v) => {
                                const nextEnabled = { ...enabled, [field.code]: v };
                                setEnabled(nextEnabled);
                                computeGross(amounts, nextEnabled);
                            }}
                            className="shrink-0"
                        />
                    </div>
                ) : (
                    <Input
                        id={field.code}
                        type="number"
                        step="0.01"
                        min="0"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={value === 0 ? '' : value}
                        onChange={(e) => setAmount(field.code, parseFloat(e.target.value) || 0)}
                    />
                )}
                {errors[field.code] && <p className="text-xs text-destructive">{errors[field.code]}</p>}
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 p-2 w-full overflow-hidden">
            <div className="shrink-0">
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Employee Salaries</h2>
                <p className="text-muted-foreground text-sm">Configure each employee&apos;s complete salary structure</p>
            </div>

            <DataTable
                data={data}
                columns={columns}
                loading={loading}
                pagination={{ page: pagination.page, totalPages: pagination.pages, total: pagination.total, limit: pagination.limit }}
                onPageChange={(page) => fetchData(page, search, limit)}
                onSearch={(value) => setSearch(value)}
                onLimitChange={(newLimit) => { setLimit(newLimit); fetchData(1, search, newLimit); }}
                onAdd={canCreate ? handleAdd : undefined}
                onEdit={canEdit ? handleEdit : undefined}
                onDelete={canDelete ? (item) => setDeleteItem(item) : undefined}
                searchPlaceholder="Search employee salaries..."
                addLabel="Add Salary"
            />

            <FormModal
                title={editingItem ? 'Edit Employee Salary' : 'Add Employee Salary'}
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditingItem(null); resetFormState(); }}
                loading={formik.isSubmitting}
                submitLabel={editingItem ? 'Update' : 'Create'}
                size="2xl"
                progress={progress}
            >
                {missingCodes.length > 0 && (
                    <div className="mb-4 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
                        <Info className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="flex-1">
                            <p>Standard salary components are not loaded yet. Load the defaults to configure the salary structure.</p>
                            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={handleLoadDefaults} disabled={loadingDefaults}>
                                {loadingDefaults ? 'Loading...' : 'Load Default Components'}
                            </Button>
                        </div>
                    </div>
                )}
                <form onSubmit={formik.handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                        <div className="space-y-2 relative md:col-span-1">
                            <Label htmlFor="employee_id">Employee *</Label>
                            <Select value={formik.values.employee_id} onValueChange={(value) => formik.setFieldValue('employee_id', value)}>
                                <SelectTrigger><SelectValue placeholder="Select employee" /></SelectTrigger>
                                <SelectContent>
                                    {employees.map((emp) => (
                                        <SelectItem key={emp.id} value={emp.id}>{emp.name} ({emp.employee_code})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {formik.touched.employee_id && formik.errors.employee_id && (
                                <p className="text-sm text-destructive">{formik.errors.employee_id}</p>
                            )}
                        </div>
                        <div className="space-y-2 relative">
                            <Label htmlFor="effective_from">Effective From</Label>
                            <Input id="effective_from" type="date" {...formik.getFieldProps('effective_from')} />
                            {formik.touched.effective_from && formik.errors.effective_from && (
                                <p className="text-sm text-destructive">{formik.errors.effective_from}</p>
                            )}
                        </div>
                        <div className="space-y-2 relative">
                            <Label htmlFor="effective_to">Effective To</Label>
                            <Input id="effective_to" type="date" {...formik.getFieldProps('effective_to')} />
                        </div>
                    </div>

                    <div className="space-y-2 relative">
                        <Labels>Earnings</Labels>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {EARNING_FIELDS.map(renderField)}
                        </div>
                    </div>

                    <div className="space-y-2 relative">
                        <Labels>Deductions</Labels>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                            {DEDUCTION_FIELDS.map(renderField)}
                        </div>
                    </div>

                    <div className="flex items-center justify-between rounded-md border bg-muted/40 p-3">
                        <span className="text-sm font-medium text-muted-foreground">Gross Salary (auto-calculated)</span>
                        <span className="text-lg font-semibold">{fmt(grossSalary)}</span>
                    </div>

                    <div className="flex items-center justify-between rounded-md border p-3">
                        <span className="text-sm font-medium text-muted-foreground">Total Deductions</span>
                        <span className="text-lg font-semibold text-destructive">{fmt(totalDeductions)}</span>
                    </div>

                    <div className="flex items-center justify-between rounded-md border border-green-200 bg-green-50 p-3">
                        <span className="text-sm font-medium text-green-700">Net Salary (Gross − Deductions)</span>
                        <span className="text-lg font-semibold text-green-700">{fmt(netSalary)}</span>
                    </div>

                    <Button type="submit" disabled={formik.isSubmitting || missingCodes.length > 0} className="w-full">
                        {formik.isSubmitting ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                    </Button>
                </form>
            </FormModal>

            <Dialog open={!!deleteItem} onOpenChange={(open: boolean) => !open && setDeleteItem(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Delete Employee Salary</DialogTitle></DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to delete salary record for <strong>{deleteItem?.employee?.name}</strong>?
                    </DialogDescription>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteItem(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
                            {deleteLoading ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
