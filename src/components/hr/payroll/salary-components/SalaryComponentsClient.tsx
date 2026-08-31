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
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

interface SalaryComponent {
    id: string;
    name: string;
    type: 'EARNING' | 'DEDUCTION';
    calculation_type: 'FIXED' | 'PERCENTAGE';
    default_value: number;
    percentage_of_id: string | null;
    percentage_of_name?: string;
    is_active: boolean;
    is_standard: boolean;
    sort_order: number;
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
    name: Yup.string().trim().required('Name is required').max(100, 'Name must not exceed 100 characters'),
    type: Yup.string().oneOf(['EARNING', 'DEDUCTION']).required('Type is required'),
    calculation_type: Yup.string().oneOf(['FIXED', 'PERCENTAGE']).required('Calculation type is required'),
    default_value: Yup.number().min(0, 'Must be 0 or more').required('Default value is required'),
    percentage_of_id: Yup.string().nullable(),
    is_active: Yup.boolean(),
    sort_order: Yup.number().min(0, 'Must be 0 or more').required('Sort order is required'),
});

export function SalaryComponentsClient({ canCreate = true, canEdit = true, canDelete = true }) {
    const [data, setData] = useState<SalaryComponent[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<SalaryComponent | null>(null);
    const [deleteItem, setDeleteItem] = useState<SalaryComponent | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [components, setComponents] = useState<SalaryComponent[]>([]);
    const [loadingDefaults, setLoadingDefaults] = useState(false);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1, pages: 1, total: 0, limit: 10,
    });

    const handleLoadDefaults = async () => {
        try {
            setLoadingDefaults(true);
            await axios.post('/api/hr/salary-components/seed-defaults');
            toast.success('Default salary components loaded');
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to load default components');
        } finally {
            setLoadingDefaults(false);
        }
    };

    const fetchComponents = useCallback(async () => {
        try {
            const res = await axios.get('/api/hr/salary-components', { params: { limit: 200 } });
            setComponents(res.data.data || []);
        } catch {
            // non-critical
        }
    }, []);

    useEffect(() => { fetchComponents(); }, [fetchComponents]);

    const formik = useFormik({
        initialValues: {
            name: editingItem?.name || '',
            type: editingItem?.type || 'EARNING',
            calculation_type: editingItem?.calculation_type || 'FIXED',
            default_value: editingItem?.default_value ?? 0,
            percentage_of_id: editingItem?.percentage_of_id || '',
            is_active: editingItem?.is_active ?? true,
            sort_order: editingItem?.sort_order ?? 0,
        },
        validationSchema,
        validateOnChange: true,
        validateOnBlur: true,
        enableReinitialize: true,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            try {
                const payload = {
                    ...values,
                    default_value: Number(values.default_value),
                    sort_order: Number(values.sort_order),
                    percentage_of_id: values.percentage_of_id || null,
                };
                if (editingItem) {
                    await axios.put(`/api/hr/salary-components/${editingItem.id}`, payload);
                    toast.success('Salary component updated successfully');
                } else {
                    await axios.post('/api/hr/salary-components', payload);
                    toast.success('Salary component created successfully');
                }
                setModalOpen(false);
                setEditingItem(null);
                resetForm();
                fetchData(pagination.page);
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save salary component');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const progress = useMemo(() => {
        const fields = [formik.values.name, formik.values.type, formik.values.calculation_type, String(formik.values.default_value), String(formik.values.sort_order), String(formik.values.is_active)];
        if (formik.values.calculation_type === 'PERCENTAGE') fields.push(formik.values.percentage_of_id);
        const filled = fields.filter((v) => v && String(v).trim() !== '').length;
        return Math.round((filled / fields.length) * 100);
    }, [formik.values]);

    const fetchData = useCallback(async (page = 1, searchValue = search, pageLimit = limit) => {
        try {
            setLoading(true);
            const response = await axios.get('/api/hr/salary-components', {
                params: { page, limit: pageLimit, search: searchValue },
            });
            setData(response.data.data);
            setPagination(response.data.pagination);
        } catch {
            toast.error('Failed to fetch salary components');
        } finally {
            setLoading(false);
        }
    }, [search, limit]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleEdit = (item: SalaryComponent) => {
        setEditingItem(item);
        formik.resetForm({
            values: {
                name: item.name,
                type: item.type,
                calculation_type: item.calculation_type,
                default_value: item.default_value,
                percentage_of_id: item.percentage_of_id || '',
                is_active: item.is_active,
                sort_order: item.sort_order,
            },
        });
        setModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            const response = await axios.delete(`/api/hr/salary-components/${deleteItem.id}`);
            toast.success(response.data.message || 'Salary component deleted successfully');
            setDeleteItem(null);
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete salary component');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingItem(null);
        formik.resetForm({ values: { name: '', type: 'EARNING', calculation_type: 'FIXED', default_value: 0, percentage_of_id: '', is_active: true, sort_order: 0 } });
        setModalOpen(true);
    };

    const typeBadge = (type: string) => (
        <Badge variant={type === 'EARNING' ? 'default' : 'destructive'}>{type}</Badge>
    );

    const standardBadge = (isStandard: boolean) => (
        isStandard ? <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100">Standard</Badge> : null
    );

    const calcTypeBadge = (ct: string) => (
        <Badge variant="outline">{ct}</Badge>
    );

    const columns: Column<SalaryComponent>[] = [
        { header: 'Name', accessorKey: 'name', sortable: true },
        { header: 'Type', accessorKey: 'type', cell: (item) => typeBadge(item.type) },
        { header: 'Calc Type', accessorKey: 'calculation_type', cell: (item) => calcTypeBadge(item.calculation_type) },
        { header: 'Default Value', accessorKey: 'default_value' },
        {
            header: 'Percentage Of',
            accessorKey: 'percentage_of_name',
            cell: (item) => item.percentage_of_name || '-',
        },
        {
            header: 'Standard',
            accessorKey: 'is_standard',
            cell: (item) => standardBadge(item.is_standard),
        },
        {
            header: 'Active',
            accessorKey: 'is_active',
            cell: (item) => <Badge variant={item.is_active ? 'default' : 'secondary'}>{item.is_active ? 'Yes' : 'No'}</Badge>,
        },
        { header: 'Sort Order', accessorKey: 'sort_order' },
    ];

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 p-2 w-full overflow-hidden">
            <div className="shrink-0 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Salary Components</h2>
                    <p className="text-muted-foreground text-sm">Manage salary components (earnings and deductions)</p>
                </div>
                {canCreate && (
                    <Button type="button" variant="outline" onClick={handleLoadDefaults} disabled={loadingDefaults}>
                        {loadingDefaults ? 'Loading...' : 'Load Defaults'}
                    </Button>
                )}
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
                searchPlaceholder="Search salary components..."
                addLabel="Add Component"
            />

            <FormModal
                title={editingItem ? 'Edit Salary Component' : 'Add Salary Component'}
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditingItem(null); formik.resetForm(); }}
                loading={formik.isSubmitting}
                submitLabel={editingItem ? 'Update' : 'Create'}
                size="lg"
                progress={progress}
            >
                <form onSubmit={formik.handleSubmit} className="space-y-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="name">Name *</Label>
                        <Input id="name" {...formik.getFieldProps('name')} placeholder="e.g., Basic Salary" />
                        {formik.touched.name && formik.errors.name && (
                            <p className="text-sm text-destructive">{formik.errors.name}</p>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="type">Type *</Label>
                            <Select value={formik.values.type} onValueChange={(value) => formik.setFieldValue('type', value)}>
                                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="EARNING">Earning</SelectItem>
                                    <SelectItem value="DEDUCTION">Deduction</SelectItem>
                                </SelectContent>
                            </Select>
                            {formik.touched.type && formik.errors.type && (
                                <p className="text-sm text-destructive">{formik.errors.type}</p>
                            )}
                        </div>
                        <div className="space-y-2 relative">
                            <Label htmlFor="calculation_type">Calculation Type *</Label>
                            <Select value={formik.values.calculation_type} onValueChange={(value) => formik.setFieldValue('calculation_type', value)}>
                                <SelectTrigger><SelectValue placeholder="Select calc type" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="FIXED">Fixed</SelectItem>
                                    <SelectItem value="PERCENTAGE">Percentage</SelectItem>
                                </SelectContent>
                            </Select>
                            {formik.touched.calculation_type && formik.errors.calculation_type && (
                                <p className="text-sm text-destructive">{formik.errors.calculation_type}</p>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="default_value">Default Value *</Label>
                            <Input id="default_value" type="number" step="0.01" min="0" {...formik.getFieldProps('default_value')} />
                            {formik.touched.default_value && formik.errors.default_value && (
                                <p className="text-sm text-destructive">{formik.errors.default_value}</p>
                            )}
                        </div>
                        <div className="space-y-2 relative">
                            <Label htmlFor="sort_order">Sort Order *</Label>
                            <Input id="sort_order" type="number" min="0" {...formik.getFieldProps('sort_order')} />
                            {formik.touched.sort_order && formik.errors.sort_order && (
                                <p className="text-sm text-destructive">{formik.errors.sort_order}</p>
                            )}
                        </div>
                    </div>
                    {formik.values.calculation_type === 'PERCENTAGE' && (
                        <div className="space-y-2 relative">
                            <Label htmlFor="percentage_of_id">Percentage Of *</Label>
                            <Select value={formik.values.percentage_of_id} onValueChange={(value) => formik.setFieldValue('percentage_of_id', value)}>
                                <SelectTrigger><SelectValue placeholder="Select base component" /></SelectTrigger>
                                <SelectContent>
                                    {components.filter(c => c.type === 'EARNING' && c.id !== editingItem?.id).map((c) => (
                                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="is_active">Active</Label>
                        <Select value={formik.values.is_active ? 'true' : 'false'} onValueChange={(value) => formik.setFieldValue('is_active', value === 'true')}>
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="true">Yes</SelectItem>
                                <SelectItem value="false">No</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    </div>
                    <Button type="submit" disabled={formik.isSubmitting} className="w-full">
                        {formik.isSubmitting ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                    </Button>
                </form>
            </FormModal>

            <Dialog open={!!deleteItem} onOpenChange={(open: boolean) => !open && setDeleteItem(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Delete Salary Component</DialogTitle></DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to delete <strong>{deleteItem?.name}</strong>?
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
