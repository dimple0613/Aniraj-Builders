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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toDateInputValue } from '@/lib/date-utils';

interface Announcement {
    id: string;
    title: string;
    description: string | null;
    publish_date: string;
    expiry_date: string | null;
    priority: string;
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
    title: Yup.string().trim().required('Title is required').max(200, 'Title must not exceed 200 characters'),
    description: Yup.string().nullable(),
    publish_date: Yup.string().nullable(),
    expiry_date: Yup.string().nullable(),
    priority: Yup.string().oneOf(['LOW', 'MEDIUM', 'HIGH', 'NORMAL']),
    status: Yup.string().oneOf(['ACTIVE', 'ARCHIVED', 'DRAFT']),
});

interface AnnouncementsClientProps {
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
}

export function AnnouncementsClient({ canCreate = true, canEdit = true, canDelete = true }: AnnouncementsClientProps) {
    const [data, setData] = useState<Announcement[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Announcement | null>(null);
    const [deleteItem, setDeleteItem] = useState<Announcement | null>(null);
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
            description: '',
            publish_date: '',
            expiry_date: '',
            priority: 'NORMAL',
            status: 'ACTIVE',
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
                    publish_date: values.publish_date || null,
                    expiry_date: values.expiry_date || null,
                };
                if (editingItem) {
                    await axios.put(`/api/hr/announcements/${editingItem.id}`, payload);
                    toast.success('Announcement updated successfully');
                } else {
                    await axios.post('/api/hr/announcements', payload);
                    toast.success('Announcement created successfully');
                }
                setModalOpen(false);
                setEditingItem(null);
                resetForm();
                fetchData(pagination.page);
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save announcement');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const progress = useMemo(() => {
        const fields = [formik.values.title, formik.values.description, formik.values.publish_date, formik.values.expiry_date, formik.values.priority, formik.values.status];
        const filled = fields.filter((v) => v && String(v).trim() !== '').length;
        return Math.round((filled / fields.length) * 100);
    }, [formik.values]);

    const fetchData = useCallback(async (page = 1, searchValue = search, pageLimit = limit) => {
        try {
            setLoading(true);
            const response = await axios.get('/api/hr/announcements', {
                params: { page, limit: pageLimit, search: searchValue },
            });
            setData(response.data.data);
            setPagination(response.data.pagination);
        } catch {
            toast.error('Failed to fetch announcements');
        } finally {
            setLoading(false);
        }
    }, [search, limit]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleEdit = (item: Announcement) => {
        setEditingItem(item);
        formik.resetForm({
            values: {
                title: item.title,
                description: item.description || '',
                publish_date: toDateInputValue(item.publish_date),
                expiry_date: toDateInputValue(item.expiry_date),
                priority: item.priority || 'NORMAL',
                status: item.status || 'ACTIVE',
            },
        });
        setModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            const response = await axios.delete(`/api/hr/announcements/${deleteItem.id}`);
            toast.success(response.data.message || 'Announcement deleted successfully');
            setDeleteItem(null);
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete announcement');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingItem(null);
        formik.resetForm({ values: { title: '', description: '', publish_date: '', expiry_date: '', priority: 'NORMAL', status: 'ACTIVE' } });
        setModalOpen(true);
    };

    const statusBadgeVariant = (status: string) => {
        switch (status) {
            case 'ACTIVE': return 'default';
            case 'DRAFT': return 'secondary';
            case 'ARCHIVED': return 'outline';
            default: return 'secondary';
        }
    };

    const priorityBadgeVariant = (priority: string) => {
        switch (priority) {
            case 'HIGH': return 'destructive';
            case 'MEDIUM': return 'secondary';
            case 'LOW': return 'outline';
            case 'NORMAL': return 'default';
            default: return 'secondary';
        }
    };

    const columns: Column<Announcement>[] = [
        { header: 'Title', accessorKey: 'title', sortable: true },
        {
            header: 'Content',
            accessorKey: 'description',
            cell: (item) => (
                <span className="line-clamp-1 max-w-[250px] block">{item.description || '-'}</span>
            ),
        },
        {
            header: 'Priority',
            accessorKey: 'priority',
            cell: (item) => (
                <Badge variant={priorityBadgeVariant(item.priority) as any}>{item.priority}</Badge>
            ),
        },
        {
            header: 'Status',
            accessorKey: 'status',
            cell: (item) => (
                <Badge variant={statusBadgeVariant(item.status) as any}>{item.status}</Badge>
            ),
        },
    ];

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 p-2 md:p-6 w-full overflow-hidden">
            <div className="shrink-0">
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Announcements</h2>
                <p className="text-muted-foreground text-sm">Manage announcements</p>
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
                searchPlaceholder="Search announcements..."
                addLabel="Add Announcement"
            />

            <FormModal
                title={editingItem ? 'Edit Announcement' : 'Add Announcement'}
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
                    <div className="space-y-2">
                        <Label htmlFor="title">Title *</Label>
                        <Input id="title" {...formik.getFieldProps('title')} placeholder="Announcement title" />
                        {formik.touched.title && formik.errors.title && (
                            <p className="text-sm text-destructive">{formik.errors.title}</p>
                        )}
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="description">Content</Label>
                        <Textarea id="description" {...formik.getFieldProps('description')} placeholder="Announcement content" rows={4} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="publish_date">Publish Date</Label>
                            <Input id="publish_date" type="date" {...formik.getFieldProps('publish_date')} />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="expiry_date">Expiry Date</Label>
                            <Input id="expiry_date" type="date" {...formik.getFieldProps('expiry_date')} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="priority">Priority</Label>
                            <Select
                                value={formik.values.priority}
                                onValueChange={(value) => formik.setFieldValue('priority', value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select priority" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="LOW">Low</SelectItem>
                                    <SelectItem value="MEDIUM">Medium</SelectItem>
                                    <SelectItem value="HIGH">High</SelectItem>
                                    <SelectItem value="NORMAL">Normal</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
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
                                    <SelectItem value="DRAFT">Draft</SelectItem>
                                    <SelectItem value="ARCHIVED">Archived</SelectItem>
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
                        <DialogTitle>Delete Announcement</DialogTitle>
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
