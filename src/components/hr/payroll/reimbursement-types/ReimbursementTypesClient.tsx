'use client';

import { useState, useCallback, useEffect } from 'react';
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

interface ReimbursementType {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
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
    description: Yup.string().nullable(),
    is_active: Yup.boolean(),
});

export function ReimbursementTypesClient({ canCreate = true, canEdit = true, canDelete = true }) {
    const [data, setData] = useState<ReimbursementType[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ReimbursementType | null>(null);
    const [deleteItem, setDeleteItem] = useState<ReimbursementType | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1, pages: 1, total: 0, limit: 10,
    });

    const formik = useFormik({
        initialValues: { name: editingItem?.name || '', description: editingItem?.description || '', is_active: editingItem?.is_active ?? true },
        validationSchema,
        validateOnChange: true,
        validateOnBlur: true,
        enableReinitialize: true,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            try {
                const payload = { ...values, description: values.description || null };
                if (editingItem) {
                    await axios.put(`/api/hr/reimbursement-types/${editingItem.id}`, payload);
                    toast.success('Reimbursement type updated successfully');
                } else {
                    await axios.post('/api/hr/reimbursement-types', payload);
                    toast.success('Reimbursement type created successfully');
                }
                setModalOpen(false);
                setEditingItem(null);
                resetForm();
                fetchData(pagination.page);
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save reimbursement type');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const fetchData = useCallback(async (page = 1, searchValue = search, pageLimit = limit) => {
        try {
            setLoading(true);
            const response = await axios.get('/api/hr/reimbursement-types', {
                params: { page, limit: pageLimit, search: searchValue },
            });
            setData(response.data.data);
            setPagination(response.data.pagination);
        } catch {
            toast.error('Failed to fetch reimbursement types');
        } finally {
            setLoading(false);
        }
    }, [search, limit]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleEdit = (item: ReimbursementType) => {
        setEditingItem(item);
        formik.resetForm({
            values: { name: item.name, description: item.description || '', is_active: item.is_active },
        });
        setModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            const response = await axios.delete(`/api/hr/reimbursement-types/${deleteItem.id}`);
            toast.success(response.data.message || 'Reimbursement type deleted successfully');
            setDeleteItem(null);
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete reimbursement type');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingItem(null);
        formik.resetForm({ values: { name: '', description: '', is_active: true } });
        setModalOpen(true);
    };

    const columns: Column<ReimbursementType>[] = [
        { header: 'Name', accessorKey: 'name', sortable: true },
        { header: 'Description', accessorKey: 'description', cell: (item) => item.description || '-' },
        {
            header: 'Active',
            accessorKey: 'is_active',
            cell: (item) => <Badge variant={item.is_active ? 'default' : 'secondary'}>{item.is_active ? 'Yes' : 'No'}</Badge>,
        },
    ];

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 p-2 w-full overflow-hidden">
            <div className="shrink-0">
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Reimbursement Types</h2>
                <p className="text-muted-foreground text-sm">Manage reimbursement types</p>
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
                searchPlaceholder="Search reimbursement types..."
                addLabel="Add Type"
            />

            <FormModal
                title={editingItem ? 'Edit Reimbursement Type' : 'Add Reimbursement Type'}
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditingItem(null); formik.resetForm(); }}
                loading={formik.isSubmitting}
                submitLabel={editingItem ? 'Update' : 'Create'}
            >
                <form onSubmit={formik.handleSubmit} className="space-y-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="name">Name *</Label>
                        <Input id="name" {...formik.getFieldProps('name')} placeholder="e.g., Travel Allowance" />
                        {formik.touched.name && formik.errors.name && (
                            <p className="text-sm text-destructive">{formik.errors.name}</p>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" {...formik.getFieldProps('description')} placeholder="Description" />
                    </div>
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
                    <DialogHeader><DialogTitle>Delete Reimbursement Type</DialogTitle></DialogHeader>
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
