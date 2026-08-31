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
import { toDateInputValue, formatDateDisplay } from '@/lib/date-utils';

interface Holiday {
    id: string;
    title: string;
    date: string;
    type: string | null;
    description: string | null;
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
    title: Yup.string().trim().required('Name is required').max(200, 'Name must not exceed 200 characters'),
    date: Yup.string().required('Date is required'),
    type: Yup.string().oneOf(['PUBLIC', 'OBSERVANCE', 'OPTIONAL']),
    description: Yup.string().nullable(),
});

interface HolidaysClientProps {
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
}

export function HolidaysClient({ canCreate = true, canEdit = true, canDelete = true }: HolidaysClientProps) {
    const [data, setData] = useState<Holiday[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Holiday | null>(null);
    const [deleteItem, setDeleteItem] = useState<Holiday | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1,
        pages: 1,
        total: 0,
        limit: 10,
    });

    const formik = useFormik({
        initialValues: {
            title: '',
            date: '',
            type: 'PUBLIC',
            description: '',
        },
        validationSchema,
        validateOnChange: true,
        validateOnBlur: true,
        enableReinitialize: true,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            try {
                const payload = {
                    ...values,
                    description: values.description || null,
                };
                if (editingItem) {
                    await axios.put(`/api/hr/holidays/${editingItem.id}`, payload);
                    toast.success('Holiday updated successfully');
                } else {
                    await axios.post('/api/hr/holidays', payload);
                    toast.success('Holiday created successfully');
                }
                setModalOpen(false);
                setEditingItem(null);
                resetForm();
                fetchData(pagination.page);
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save holiday');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const progress = useMemo(() => {
        const fields = [formik.values.title, formik.values.date, formik.values.type, formik.values.description];
        const filled = fields.filter((v) => v && String(v).trim() !== '').length;
        return Math.round((filled / fields.length) * 100);
    }, [formik.values]);

    const fetchData = useCallback(async (page = 1, searchValue = search, pageLimit = limit) => {
        try {
            setLoading(true);
            const response = await axios.get('/api/hr/holidays', {
                params: { page, limit: pageLimit, search: searchValue },
            });
            setData(response.data.data);
            setPagination(response.data.pagination);
        } catch {
            toast.error('Failed to fetch holidays');
        } finally {
            setLoading(false);
        }
    }, [search, limit]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleEdit = (item: Holiday) => {
        setEditingItem(item);
        const dateValue = toDateInputValue(item.date);
        formik.resetForm({
            values: {
                title: item.title,
                date: dateValue,
                type: item.type || 'PUBLIC',
                description: item.description || '',
            },
        });
        setModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            const response = await axios.delete(`/api/hr/holidays/${deleteItem.id}`);
            toast.success(response.data.message || 'Holiday deleted successfully');
            setDeleteItem(null);
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete holiday');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingItem(null);
        formik.resetForm({ values: { title: '', date: '', type: 'PUBLIC', description: '' } });
        setModalOpen(true);
    };

    const typeBadgeVariant = (type: string | null) => {
        switch (type) {
            case 'PUBLIC': return 'default';
            case 'OBSERVANCE': return 'secondary';
            case 'OPTIONAL': return 'outline';
            default: return 'outline';
        }
    };

    const columns: Column<Holiday>[] = [
        { header: 'Name', accessorKey: 'title', sortable: true },
        {
            header: 'Date',
            accessorKey: 'date',
            cell: (item) => <span>{formatDateDisplay(item.date, 'en-IN')}</span>,
        },
        {
            header: 'Type',
            accessorKey: 'type',
            cell: (item) => (
                <Badge variant={typeBadgeVariant(item.type) as any}>{item.type || '-'}</Badge>
            ),
        },
    ];

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 p-2 md:p-6 w-full overflow-hidden">
            <div className="shrink-0">
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Holidays</h2>
                <p className="text-muted-foreground text-sm">Manage holidays</p>
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
                searchPlaceholder="Search holidays..."
                addLabel="Add Holiday"
            />

            <FormModal
                title={editingItem ? 'Edit Holiday' : 'Add Holiday'}
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
                        <Label htmlFor="title">Name *</Label>
                        <Input id="title" {...formik.getFieldProps('title')} placeholder="e.g., Republic Day" />
                        {formik.touched.title && formik.errors.title && (
                            <p className="text-sm text-destructive">{formik.errors.title}</p>
                        )}
                    </div>
                    <div className="space-y-2 relative">
                        <Label htmlFor="date">Date *</Label>
                        <Input id="date" type="date" {...formik.getFieldProps('date')} />
                        {formik.touched.date && formik.errors.date && (
                            <p className="text-sm text-destructive">{formik.errors.date}</p>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="type">Type</Label>
                        <Select
                            value={formik.values.type}
                            onValueChange={(value) => formik.setFieldValue('type', value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="PUBLIC">Public</SelectItem>
                                <SelectItem value="OBSERVANCE">Observance</SelectItem>
                                <SelectItem value="OPTIONAL">Optional</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    </div>
                    <div className="space-y-2 relative">
                        <Label htmlFor="description">Description</Label>
                        <Input id="description" {...formik.getFieldProps('description')} placeholder="Description" />
                    </div>
                    <Button type="submit" disabled={formik.isSubmitting} className="w-full">
                        {formik.isSubmitting ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                    </Button>
                </form>
            </FormModal>

            <Dialog open={!!deleteItem} onOpenChange={(open: boolean) => !open && setDeleteItem(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Holiday</DialogTitle>
                    </DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to delete <strong>{deleteItem?.title}</strong>?
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
