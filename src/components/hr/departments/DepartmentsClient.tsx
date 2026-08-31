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

interface Department {
    id: string;
    name: string;
    code: string | null;
    manager_name: string | null;
    phone: string | null;
    email: string | null;
    description: string | null;
    status: string;
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
    code: Yup.string().nullable().max(50, 'Code must not exceed 50 characters'),
    manager_name: Yup.string().nullable().max(100, 'Manager name must not exceed 100 characters'),
    phone: Yup.string().nullable().max(20, 'Phone must not exceed 20 characters'),
    email: Yup.string().nullable().email('Invalid email format'),
    description: Yup.string().nullable(),
    status: Yup.string().oneOf(['ACTIVE', 'INACTIVE'], 'Status must be ACTIVE or INACTIVE'),
});

interface DepartmentsClientProps {
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
}

export function DepartmentsClient({ canCreate = true, canEdit = true, canDelete = true }: DepartmentsClientProps) {
    const [data, setData] = useState<Department[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Department | null>(null);
    const [deleteItem, setDeleteItem] = useState<Department | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1,
        pages: 1,
        total: 0,
        limit: 10,
    });

    const formik = useFormik({
        initialValues: {
            name: editingItem?.name || '',
            code: editingItem?.code || '',
            manager_name: editingItem?.manager_name || '',
            phone: editingItem?.phone || '',
            email: editingItem?.email || '',
            description: editingItem?.description || '',
            status: editingItem?.status || 'ACTIVE',
        },
        validationSchema,
        validateOnChange: true,
        validateOnBlur: true,
        enableReinitialize: true,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            try {
                const payload = {
                    ...values,
                    code: values.code || null,
                    manager_name: values.manager_name || null,
                    phone: values.phone || null,
                    email: values.email || null,
                    description: values.description || null,
                };
                if (editingItem) {
                    await axios.put(`/api/departments/${editingItem.id}`, payload);
                    toast.success('Department updated successfully');
                } else {
                    await axios.post('/api/departments', payload);
                    toast.success('Department created successfully');
                }
                setModalOpen(false);
                setEditingItem(null);
                resetForm();
                fetchData(pagination.page);
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save department');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const progress = useMemo(() => {
        const fields = [formik.values.name, formik.values.code, formik.values.manager_name, formik.values.phone, formik.values.email, formik.values.description, formik.values.status];
        const filled = fields.filter((v) => v && String(v).trim() !== '').length;
        return Math.round((filled / fields.length) * 100);
    }, [formik.values]);

    const fetchData = useCallback(async (page = 1, searchValue = search, pageLimit = limit) => {
        try {
            setLoading(true);
            const response = await axios.get('/api/departments', {
                params: { page, limit: pageLimit, search: searchValue },
            });
            setData(response.data.data);
            setPagination(response.data.pagination);
        } catch {
            toast.error('Failed to fetch departments');
        } finally {
            setLoading(false);
        }
    }, [search, limit]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleEdit = (item: Department) => {
        setEditingItem(item);
        formik.resetForm({
            values: {
                name: item.name,
                code: item.code || '',
                manager_name: item.manager_name || '',
                phone: item.phone || '',
                email: item.email || '',
                description: item.description || '',
                status: item.status || 'ACTIVE',
            },
        });
        setModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            const response = await axios.delete(`/api/departments/${deleteItem.id}`);
            toast.success(response.data.message || 'Department deleted successfully');
            setDeleteItem(null);
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete department');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingItem(null);
        formik.resetForm({ values: { name: '', code: '', manager_name: '', phone: '', email: '', description: '', status: 'ACTIVE' } });
        setModalOpen(true);
    };

    const statusBadgeVariant = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'default';
            case 'INACTIVE': return 'destructive';
            default: return 'secondary';
        }
    };

    const columns: Column<Department>[] = [
        { header: 'Name', accessorKey: 'name', sortable: true },
        { header: 'Code', accessorKey: 'code', cell: (item) => item.code || '-' },
        { header: 'Manager', accessorKey: 'manager_name', cell: (item) => item.manager_name || '-' },
        { header: 'Phone', accessorKey: 'phone', cell: (item) => item.phone || '-' },
        { header: 'Email', accessorKey: 'email', cell: (item) => item.email || '-' },
        {
            header: 'Status',
            accessorKey: 'status',
            cell: (item) => (
                <Badge variant={statusBadgeVariant(item.status) as any}>{item.status}</Badge>
            ),
        },
    ];

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 p-2 w-full overflow-hidden">
            <div className="shrink-0">
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Departments</h2>
                <p className="text-muted-foreground text-sm">Manage departments</p>
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
                searchPlaceholder="Search departments..."
                addLabel="Add Department"
            />

            <FormModal
                title={editingItem ? 'Edit Department' : 'Add Department'}
                isOpen={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setEditingItem(null);
                    formik.resetForm();
                }}
                loading={formik.isSubmitting}
                submitLabel={editingItem ? 'Update' : 'Create'}
                size="lg"
                progress={progress}
            >
                <form onSubmit={formik.handleSubmit} className="space-y-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="name">Name *</Label>
                        <Input id="name" {...formik.getFieldProps('name')} placeholder="e.g., Human Resources" />
                        {formik.touched.name && formik.errors.name && (
                            <p className="text-sm text-destructive">{formik.errors.name}</p>
                        )}
                    </div>
                    <div className="space-y-2 relative">
                        <Label htmlFor="code">Code</Label>
                        <Input id="code" {...formik.getFieldProps('code')} placeholder="e.g., HR" />
                    </div>
                    <div className="space-y-2 relative">
                        <Label htmlFor="manager_name">Manager</Label>
                        <Input id="manager_name" {...formik.getFieldProps('manager_name')} placeholder="Manager name" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="phone">Phone</Label>
                            <Input id="phone" {...formik.getFieldProps('phone')} placeholder="Phone number" />
                        </div>
                        <div className="space-y-2 relative">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" {...formik.getFieldProps('email')} placeholder="Email address" type="email" />
                            {formik.touched.email && formik.errors.email && (
                                <p className="text-sm text-destructive">{formik.errors.email}</p>
                            )}
                        </div>
                    </div>
                    <div className="space-y-2 relative">
                        <Label htmlFor="description">Description</Label>
                        <Input id="description" {...formik.getFieldProps('description')} placeholder="Description" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="status">Status</Label>
                        <Select
                            value={formik.values.status}
                            onValueChange={(value) => formik.setFieldValue('status', value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="ACTIVE">Active</SelectItem>
                                <SelectItem value="INACTIVE">Inactive</SelectItem>
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
                    <DialogHeader>
                        <DialogTitle>Delete Department</DialogTitle>
                    </DialogHeader>
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
