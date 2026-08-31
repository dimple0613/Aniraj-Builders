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
import { ReimbursementTypeModal } from '@/components/hr/payroll/reimbursement-types/ReimbursementTypeModal';
import { toDateInputValue, formatDateDisplay } from '@/lib/date-utils';

interface Employee {
    id: string;
    name: string;
    employee_code: string;
}

interface ReimbursementType {
    id: string;
    name: string;
}

interface ReimbursementRequest {
    id: string;
    employee_id: string;
    reimbursement_type_id: string;
    amount: number;
    description: string | null;
    expense_date: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
    employee?: Employee;
    reimbursement_type?: ReimbursementType;
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
    reimbursement_type_id: Yup.string().required('Reimbursement type is required'),
    amount: Yup.number().min(1, 'Amount must be at least 1').required('Amount is required'),
    description: Yup.string().nullable(),
    expense_date: Yup.string().required('Expense date is required'),
});

export function ReimbursementRequestsClient({ canCreate = true, canEdit = true, canDelete = true, canApprove = true }) {
    const router = useRouter();
    const [data, setData] = useState<ReimbursementRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ReimbursementRequest | null>(null);
    const [deleteItem, setDeleteItem] = useState<ReimbursementRequest | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [reimbTypes, setReimbTypes] = useState<ReimbursementType[]>([]);
    const [typeModalOpen, setTypeModalOpen] = useState(false);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1, pages: 1, total: 0, limit: 10,
    });

    const fetchDropdowns = useCallback(async () => {
        try {
            const [empRes, rtRes] = await Promise.all([
                axios.get('/api/hr/employees', { params: { limit: 200 } }),
                axios.get('/api/hr/reimbursement-types', { params: { limit: 200 } }),
            ]);
            setEmployees(empRes.data.data || []);
            setReimbTypes(rtRes.data.data || []);
        } catch {
            toast.error('Failed to load dropdown data');
        }
    }, []);

    useEffect(() => { fetchDropdowns(); }, [fetchDropdowns]);

    const formik = useFormik({
        initialValues: {
            employee_id: editingItem?.employee_id || '',
            reimbursement_type_id: editingItem?.reimbursement_type_id || '',
            amount: editingItem ? String(editingItem.amount) : '',
            description: editingItem?.description || '',
            expense_date: toDateInputValue(editingItem?.expense_date),
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
                    description: values.description || null,
                };
                if (editingItem) {
                    await axios.put(`/api/hr/reimbursement-requests/${editingItem.id}`, payload);
                    toast.success('Reimbursement request updated successfully');
                } else {
                    await axios.post('/api/hr/reimbursement-requests', payload);
                    toast.success('Reimbursement request created successfully');
                }
                setModalOpen(false);
                setEditingItem(null);
                resetForm();
                fetchData(pagination.page);
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save request');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const progress = useMemo(() => {
        const fields = [formik.values.employee_id, formik.values.reimbursement_type_id, formik.values.amount, formik.values.description, formik.values.expense_date];
        const filled = fields.filter((v) => v && String(v).trim() !== '').length;
        return Math.round((filled / fields.length) * 100);
    }, [formik.values]);

    const fetchData = useCallback(async (page = 1, searchValue = search, pageLimit = limit) => {
        try {
            setLoading(true);
            const response = await axios.get('/api/hr/reimbursement-requests', {
                params: { page, limit: pageLimit, search: searchValue },
            });
            setData(response.data.data);
            setPagination(response.data.pagination);
        } catch {
            toast.error('Failed to fetch reimbursement requests');
        } finally {
            setLoading(false);
        }
    }, [search, limit]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleEdit = (item: ReimbursementRequest) => {
        setEditingItem(item);
        formik.resetForm({
            values: {
                employee_id: item.employee_id,
                reimbursement_type_id: item.reimbursement_type_id,
                amount: String(item.amount),
                description: item.description || '',
                expense_date: toDateInputValue(item.expense_date),
            },
        });
        setModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            const response = await axios.delete(`/api/hr/reimbursement-requests/${deleteItem.id}`);
            toast.success(response.data.message || 'Request deleted successfully');
            setDeleteItem(null);
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete request');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleApprove = async (item: ReimbursementRequest, status: string) => {
        try {
            await axios.put(`/api/hr/reimbursement-requests/${item.id}`, { status });
            toast.success(`Request ${status.toLowerCase()} successfully`);
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || `Failed to ${status.toLowerCase()}`);
        }
    };

    const handleAdd = () => {
        setEditingItem(null);
        formik.resetForm({
            values: { employee_id: '', reimbursement_type_id: '', amount: '', description: '', expense_date: '' },
        });
        setModalOpen(true);
    };

    const statusBadge = (status: string) => {
        const colors: Record<string, string> = {
            PENDING: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
            APPROVED: 'bg-green-100 text-green-800 hover:bg-green-100',
            REJECTED: 'bg-red-100 text-red-800 hover:bg-red-100',
            PAID: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
        };
        const variants: Record<string, string> = { PENDING: 'secondary', APPROVED: 'default', REJECTED: 'destructive', PAID: 'outline' };
        return <Badge variant={(variants[status] as any) || 'secondary'} className={colors[status] || ''}>{status}</Badge>;
    };

    const formatCurrency = (val: number) => `₹${Number(val).toLocaleString()}`;

    const columns: Column<ReimbursementRequest>[] = [
        {
            header: 'Employee',
            accessorKey: 'employee',
            cell: (item) => item.employee?.name || '-',
        },
        {
            header: 'Type',
            accessorKey: 'reimbursement_type',
            cell: (item) => item.reimbursement_type?.name || '-',
        },
        {
            header: 'Amount',
            accessorKey: 'amount',
            cell: (item) => <span className="font-medium">{formatCurrency(item.amount)}</span>,
        },
        {
            header: 'Expense Date',
            accessorKey: 'expense_date',
            cell: (item) => formatDateDisplay(item.expense_date),
        },
        {
            header: 'Status',
            accessorKey: 'status',
            cell: (item) => statusBadge(item.status),
        },
    ];

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 p-2 w-full overflow-hidden">
            <div className="shrink-0 flex items-center justify-between">
                <div>
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Reimbursement Requests</h2>
                    <p className="text-muted-foreground text-sm">Manage employee reimbursement requests</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setTypeModalOpen(true)}>
                    Reimbursement Types
                </Button>
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
                onView={(item) => router.push(`/hr/reimbursement-requests/${item.id}`)}
                searchPlaceholder="Search requests..."
                addLabel="Add Request"
                extraActions={(item) => {
                    if (canApprove && item.status === 'PENDING') {
                        return [
                            { label: 'Approve', icon: null as any, onClick: () => handleApprove(item, 'APPROVED'), className: 'text-green-600' },
                            { label: 'Reject', icon: null as any, onClick: () => handleApprove(item, 'REJECTED'), className: 'text-red-600' },
                        ];
                    }
                    return [];
                }}
            />

            <FormModal
                title={editingItem ? 'Edit Reimbursement Request' : 'Add Reimbursement Request'}
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
                            <Label htmlFor="reimbursement_type_id">Type *</Label>
                            <Select value={formik.values.reimbursement_type_id} onValueChange={(value) => formik.setFieldValue('reimbursement_type_id', value)}>
                                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                <SelectContent className="max-h-[200px] overflow-y-auto [&>[data-radix-viewport]]:h-auto [&>[data-radix-viewport]]:max-h-[200px] [&>button]:hidden">
                                    {reimbTypes.filter(t => t.name).map((rt) => (
                                        <SelectItem key={rt.id} value={rt.id}>{rt.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {formik.touched.reimbursement_type_id && formik.errors.reimbursement_type_id && (
                                <p className="text-sm text-destructive">{formik.errors.reimbursement_type_id}</p>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="amount">Amount *</Label>
                            <Input id="amount" type="number" step="0.01" min="1" {...formik.getFieldProps('amount')} placeholder="Amount" />
                            {formik.touched.amount && formik.errors.amount && (
                                <p className="text-sm text-destructive">{formik.errors.amount}</p>
                            )}
                        </div>
                        <div className="space-y-2 relative">
                            <Label htmlFor="expense_date">Expense Date *</Label>
                            <Input id="expense_date" type="date" {...formik.getFieldProps('expense_date')} />
                            {formik.touched.expense_date && formik.errors.expense_date && (
                                <p className="text-sm text-destructive">{formik.errors.expense_date}</p>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" {...formik.getFieldProps('description')} placeholder="Description" />
                    </div>
                    </div>
                    <Button type="submit" disabled={formik.isSubmitting} className="w-full">
                        {formik.isSubmitting ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                    </Button>
                </form>
            </FormModal>

            <Dialog open={!!deleteItem} onOpenChange={(open: boolean) => !open && setDeleteItem(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Delete Request</DialogTitle></DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to delete this reimbursement request?
                    </DialogDescription>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteItem(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
                            {deleteLoading ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ReimbursementTypeModal
                isOpen={typeModalOpen}
                onClose={() => setTypeModalOpen(false)}
                onTypesChanged={() => fetchDropdowns()}
            />
        </div>
    );
}
