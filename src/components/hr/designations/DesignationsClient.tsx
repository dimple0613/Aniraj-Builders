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
}

interface Designation {
    id: string;
    name: string;
    department_id: string | null;
    description: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
    department?: {
        id: string;
        name: string;
    } | null;
}

interface PaginationInfo {
    page: number;
    pages: number;
    total: number;
    limit: number;
}

const validationSchema = Yup.object({
    name: Yup.string().trim().required('Name is required').max(100, 'Name must not exceed 100 characters'),
    department_id: Yup.string().nullable(),
    description: Yup.string().nullable(),
    status: Yup.string().oneOf(['ACTIVE', 'INACTIVE'], 'Status must be ACTIVE or INACTIVE'),
});

interface DesignationsClientProps {
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
}

export function DesignationsClient({ canCreate = true, canEdit = true, canDelete = true }: DesignationsClientProps) {
    const [data, setData] = useState<Designation[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Designation | null>(null);
    const [deleteItem, setDeleteItem] = useState<Designation | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1,
        pages: 1,
        total: 0,
        limit: 10,
    });

    useEffect(() => {
        axios.get('/api/departments', { params: { limit: 100 } })
            .then((res) => setDepartments(res.data.data))
            .catch(() => toast.error('Failed to load departments'));
    }, []);

    const formik = useFormik({
        initialValues: {
            name: editingItem?.name || '',
            department_id: editingItem?.department_id || '',
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
                    department_id: values.department_id || null,
                    description: values.description || null,
                };
                if (editingItem) {
                    await axios.put(`/api/hr/designations/${editingItem.id}`, payload);
                    toast.success('Designation updated successfully');
                } else {
                    await axios.post('/api/hr/designations', payload);
                    toast.success('Designation created successfully');
                }
                setModalOpen(false);
                setEditingItem(null);
                resetForm();
                fetchData(pagination.page);
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save designation');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const progress = useMemo(() => {
        const fields = [formik.values.name, formik.values.department_id, formik.values.description, formik.values.status];
        const filled = fields.filter((v) => v && String(v).trim() !== '').length;
        return Math.round((filled / fields.length) * 100);
    }, [formik.values]);

    const fetchData = useCallback(async (page = 1, searchValue = search, pageLimit = limit) => {
        try {
            setLoading(true);
            const response = await axios.get('/api/hr/designations', {
                params: { page, limit: pageLimit, search: searchValue },
            });
            setData(response.data.data);
            setPagination(response.data.pagination);
        } catch {
            toast.error('Failed to fetch designations');
        } finally {
            setLoading(false);
        }
    }, [search, limit]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleEdit = (item: Designation) => {
        setEditingItem(item);
        formik.resetForm({
            values: {
                name: item.name,
                department_id: item.department_id || '',
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
            const response = await axios.delete(`/api/hr/designations/${deleteItem.id}`);
            toast.success(response.data.message || 'Designation deleted successfully');
            setDeleteItem(null);
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete designation');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingItem(null);
        formik.resetForm({ values: { name: '', department_id: '', description: '', status: 'ACTIVE' } });
        setModalOpen(true);
    };

    const statusBadgeVariant = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'default';
            case 'INACTIVE': return 'destructive';
            default: return 'secondary';
        }
    };

    const columns: Column<Designation>[] = [
        { header: 'Name', accessorKey: 'name', sortable: true },
        {
            header: 'Department',
            accessorKey: 'department',
            cell: (item) => <span>{item.department?.name || '-'}</span>,
        },
        { header: 'Description', accessorKey: 'description' },
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
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Designations</h2>
                <p className="text-muted-foreground text-sm">Manage designations</p>
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
                searchPlaceholder="Search designations..."
                addLabel="Add Designation"
            />

            <FormModal
                title={editingItem ? 'Edit Designation' : 'Add Designation'}
                isOpen={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setEditingItem(null);
                    formik.resetForm();
                }}
                loading={formik.isSubmitting}
                submitLabel={editingItem ? 'Update' : 'Create'}
                progress={progress}
            >
                <form onSubmit={formik.handleSubmit} className="space-y-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="name">Name *</Label>
                        <Input id="name" {...formik.getFieldProps('name')} placeholder="e.g., Software Engineer" />
                        {formik.touched.name && formik.errors.name && (
                            <p className="text-sm text-destructive">{formik.errors.name}</p>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="department_id">Department</Label>
                        <Select
                            value={formik.values.department_id}
                            onValueChange={(value) => formik.setFieldValue('department_id', value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select department" />
                            </SelectTrigger>
                            <SelectContent>
                                {departments.map((dept) => (
                                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
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
                        <DialogTitle>Delete Designation</DialogTitle>
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
