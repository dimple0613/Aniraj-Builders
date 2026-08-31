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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { useRouter } from 'next/navigation';
import { toDateInputValue, formatDateDisplay } from '@/lib/date-utils';

interface Employee {
    id: string;
    name: string;
    employee_code: string;
}

interface Loan {
    id: string;
    employee_id: string;
    loan_type: 'LOAN' | 'ADVANCE';
    amount: number;
    emi_amount: number;
    total_installments: number;
    paid_installments: number;
    start_date: string;
    notes: string | null;
    status: 'ACTIVE' | 'CLOSED';
    employee?: Employee;
    createdAt: string;
    updatedAt: string;
}

interface PaginationInfo {
    page: number;
    pages: number;
    total: number;
    limit: number;
}

const validationSchema = Yup.object({
    employee_id: Yup.string().required('Employee is required'),
    loan_type: Yup.string().oneOf(['LOAN', 'ADVANCE']).required('Loan type is required'),
    amount: Yup.number().min(1, 'Amount must be at least 1').required('Amount is required'),
    emi_amount: Yup.number().min(1, 'EMI amount must be at least 1').required('EMI amount is required'),
    total_installments: Yup.number().min(1, 'Must be at least 1').required('Total installments is required'),
    start_date: Yup.string().required('Start date is required'),
    notes: Yup.string().nullable(),
});

export function LoansClient({ canCreate = true, canEdit = true, canDelete = true }) {
    const router = useRouter();
    const [data, setData] = useState<Loan[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Loan | null>(null);
    const [deleteItem, setDeleteItem] = useState<Loan | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1, pages: 1, total: 0, limit: 10,
    });

    const fetchEmployees = useCallback(async () => {
        try {
            const res = await axios.get('/api/hr/employees', { params: { limit: 200 } });
            setEmployees(res.data.data || []);
        } catch {
            toast.error('Failed to load employees');
        }
    }, []);

    useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

    const formik = useFormik({
        initialValues: {
            employee_id: editingItem?.employee_id || '',
            loan_type: editingItem?.loan_type || 'LOAN',
            amount: editingItem ? String(editingItem.amount) : '',
            emi_amount: editingItem ? String(editingItem.emi_amount) : '',
            total_installments: editingItem ? String(editingItem.total_installments) : '',
            start_date: toDateInputValue(editingItem?.start_date),
            notes: editingItem?.notes || '',
        },
        validationSchema,
        validateOnChange: true,
        validateOnBlur: true,
        enableReinitialize: true,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            try {
                const payload = {
                    ...values,
                    amount: Number(values.amount),
                    emi_amount: Number(values.emi_amount),
                    total_installments: Number(values.total_installments),
                    notes: values.notes || null,
                };
                if (editingItem) {
                    await axios.put(`/api/hr/loans/${editingItem.id}`, payload);
                    toast.success('Loan updated successfully');
                } else {
                    await axios.post('/api/hr/loans', payload);
                    toast.success('Loan created successfully');
                }
                setModalOpen(false);
                setEditingItem(null);
                resetForm();
                fetchData(pagination.page);
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save loan');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const progress = useMemo(() => {
        const fields = [formik.values.employee_id, formik.values.loan_type, formik.values.amount, formik.values.emi_amount, formik.values.total_installments, formik.values.start_date, formik.values.notes];
        const filled = fields.filter((v) => v && String(v).trim() !== '').length;
        return Math.round((filled / fields.length) * 100);
    }, [formik.values]);

    const fetchData = useCallback(async (page = 1, searchValue = search, pageLimit = limit) => {
        try {
            setLoading(true);
            const response = await axios.get('/api/hr/loans', {
                params: { page, limit: pageLimit, search: searchValue },
            });
            setData(response.data.data);
            setPagination(response.data.pagination);
        } catch {
            toast.error('Failed to fetch loans');
        } finally {
            setLoading(false);
        }
    }, [search, limit]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleEdit = (item: Loan) => {
        setEditingItem(item);
        formik.resetForm({
            values: {
                employee_id: item.employee_id,
                loan_type: item.loan_type,
                amount: String(item.amount),
                emi_amount: String(item.emi_amount),
                total_installments: String(item.total_installments),
                start_date: toDateInputValue(item.start_date),
                notes: item.notes || '',
            },
        });
        setModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            const response = await axios.delete(`/api/hr/loans/${deleteItem.id}`);
            toast.success(response.data.message || 'Loan deleted successfully');
            setDeleteItem(null);
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete loan');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingItem(null);
        formik.resetForm({
            values: { employee_id: '', loan_type: 'LOAN', amount: '', emi_amount: '', total_installments: '', start_date: '', notes: '' },
        });
        setModalOpen(true);
    };

    const statusBadge = (status: string) => {
        const colors: Record<string, string> = {
            ACTIVE: 'bg-green-100 text-green-800 hover:bg-green-100',
            CLOSED: 'bg-gray-100 text-gray-800 hover:bg-gray-100',
        };
        return <Badge variant="outline" className={colors[status] || ''}>{status}</Badge>;
    };

    const formatCurrency = (val: number) => `₹${Number(val).toLocaleString()}`;

    const columns: Column<Loan>[] = [
        {
            header: 'Employee',
            accessorKey: 'employee',
            cell: (item) => item.employee?.name || '-',
        },
        {
            header: 'Type',
            accessorKey: 'loan_type',
            cell: (item) => <Badge variant="outline">{item.loan_type}</Badge>,
        },
        {
            header: 'Amount',
            accessorKey: 'amount',
            cell: (item) => <span className="font-medium">{formatCurrency(item.amount)}</span>,
        },
        {
            header: 'EMI',
            accessorKey: 'emi_amount',
            cell: (item) => formatCurrency(item.emi_amount),
        },
        {
            header: 'Installments',
            accessorKey: 'total_installments',
            cell: (item) => `${item.paid_installments || 0}/${item.total_installments}`,
        },
        {
            header: 'Status',
            accessorKey: 'status',
            cell: (item) => statusBadge(item.status),
        },
    ];

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 p-2 w-full overflow-hidden">
            <div className="shrink-0">
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Loans & Advances</h2>
                <p className="text-muted-foreground text-sm">Manage employee loans and advances</p>
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
                onView={(item) => router.push(`/hr/loans/${item.id}`)}
                searchPlaceholder="Search loans..."
                addLabel="Add Loan"
            />

            <FormModal
                title={editingItem ? 'Edit Loan/Advance' : 'Add Loan/Advance'}
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditingItem(null); formik.resetForm(); }}
                loading={formik.isSubmitting}
                submitLabel={editingItem ? 'Update' : 'Create'}
                size="lg"
                progress={progress}
            >
                <form onSubmit={formik.handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 relative">
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
                            <Label htmlFor="loan_type">Type *</Label>
                            <Select value={formik.values.loan_type} onValueChange={(value) => formik.setFieldValue('loan_type', value)}>
                                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LOAN">Loan</SelectItem>
                                    <SelectItem value="ADVANCE">Advance</SelectItem>
                                </SelectContent>
                            </Select>
                            {formik.touched.loan_type && formik.errors.loan_type && (
                                <p className="text-sm text-destructive">{formik.errors.loan_type}</p>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="amount">Amount *</Label>
                            <Input id="amount" type="number" step="0.01" min="1" {...formik.getFieldProps('amount')} placeholder="Loan amount" />
                            {formik.touched.amount && formik.errors.amount && (
                                <p className="text-sm text-destructive">{formik.errors.amount}</p>
                            )}
                        </div>
                        <div className="space-y-2 relative">
                            <Label htmlFor="emi_amount">EMI Amount *</Label>
                            <Input id="emi_amount" type="number" step="0.01" min="1" {...formik.getFieldProps('emi_amount')} placeholder="EMI per installment" />
                            {formik.touched.emi_amount && formik.errors.emi_amount && (
                                <p className="text-sm text-destructive">{formik.errors.emi_amount}</p>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="total_installments">Total Installments *</Label>
                            <Input id="total_installments" type="number" min="1" {...formik.getFieldProps('total_installments')} placeholder="e.g., 12" />
                            {formik.touched.total_installments && formik.errors.total_installments && (
                                <p className="text-sm text-destructive">{formik.errors.total_installments}</p>
                            )}
                        </div>
                        <div className="space-y-2 relative">
                            <Label htmlFor="start_date">Start Date *</Label>
                            <Input id="start_date" type="date" {...formik.getFieldProps('start_date')} />
                            {formik.touched.start_date && formik.errors.start_date && (
                                <p className="text-sm text-destructive">{formik.errors.start_date}</p>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                 <div className="space-y-2 relative">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea id="notes" {...formik.getFieldProps('notes')} placeholder="Additional notes" />
                    </div>
                    </div>
                    <Button type="submit" disabled={formik.isSubmitting} className="w-full">
                        {formik.isSubmitting ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                    </Button>
                </form>
            </FormModal>

            <Dialog open={!!deleteItem} onOpenChange={(open: boolean) => !open && setDeleteItem(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Delete Loan</DialogTitle></DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to delete this loan for <strong>{deleteItem?.employee?.name}</strong>?
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
