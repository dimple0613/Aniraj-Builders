'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

interface AYMaster {
    id: string;
    ay_no: string;
    company_id: string;
    createdAt: string;
    updatedAt: string;
    company?: {
        company_name: string;
    };
    _count: {
        itemManagements: number;
    };
}

interface PaginationInfo {
    page: number;
    pages: number;
    total: number;
    limit: number;
}

const validationSchema = Yup.object({
    ay_no: Yup.string().trim().required('AY number is required'),
});

export function AYMasterClient() {
    const [data, setData] = useState<AYMaster[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<AYMaster | null>(null);
    const [deleteItem, setDeleteItem] = useState<AYMaster | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1,
        pages: 1,
        total: 0,
        limit: 10,
    });

    const formik = useFormik({
        initialValues: {
            ay_no: '',
        },
        validationSchema,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            try {
                if (editingItem) {
                    await axios.put(`/api/ay-masters/${editingItem.id}`, values);
                    toast.success('AY master updated successfully');
                } else {
                    await axios.post('/api/ay-masters', values);
                    toast.success('AY master created successfully');
                }
                setModalOpen(false);
                setEditingItem(null);
                resetForm();
                fetchData(pagination.page);
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save AY master');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const fetchData = useCallback(async (page = 1, searchValue = search, pageLimit = limit) => {
        try {
            setLoading(true);
            const response = await axios.get('/api/ay-masters', {
                params: {
                    page,
                    limit: pageLimit,
                    search: searchValue,
                },
            });
            setData(response.data.data);
            setPagination(response.data.pagination);
        } catch (error) {
            toast.error('Failed to fetch AY masters');
        } finally {
            setLoading(false);
        }
    }, [search, limit]);

    const handleEdit = (item: AYMaster) => {
        setEditingItem(item);
        formik.resetForm({ values: { ay_no: item.ay_no } });
        setModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            await axios.delete(`/api/ay-masters/${deleteItem.id}`);
            toast.success('AY master deleted successfully');
            setDeleteItem(null);
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete AY master');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingItem(null);
        formik.resetForm({ values: { ay_no: '' } });
        setModalOpen(true);
    };

    const progress = useMemo(() => {
        let filled = 0;
        let total = 0;

        const allFields = [
            { value: formik.values.ay_no },
        ];

        allFields.forEach(field => {
            total++;
            if (field.value && field.value.toString().trim() !== '') {
                filled++;
            }
        });

        return total > 0 ? Math.round((filled / total) * 100) : 0;
    }, [formik.values.ay_no]);

    const columns: Column<AYMaster>[] = [
        {
            header: 'AY Number',
            accessorKey: 'ay_no',
            sortable: true,
        },
        {
            header: 'Items',
            accessorKey: '_count.itemManagements',
            cell: (item: any) => (
                <Badge variant="outline" className="text-center">
                    {item._count.itemManagements}
                </Badge>
            ),
        },
    ];

    return (
        <div className="h-full flex flex-col gap-6 ">
            <div>
                <h2 className="text-2xl font-semibold tracking-tight">AY Masters</h2>
                <p className="text-muted-foreground text-sm">Manage AY (Varsh) numbers for item classification</p>
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
                onPageChange={(page: any) => fetchData(page, search, limit)}
                onSearch={(value: any) => setSearch(value)}
                onLimitChange={(newLimit: any) => {
                    setLimit(newLimit);
                    fetchData(1, search, newLimit);
                }}
                onAdd={handleAdd}
                onEdit={handleEdit}
                onDelete={(item: any) => setDeleteItem(item)}
                searchPlaceholder="Search AY..."
                addLabel="Add AY"
                showAddOnlyOnLastPage={true}
            />

            <FormModal
                title={editingItem ? 'Edit AY Master' : 'Add AY Master'}
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
                    <div className="space-y-2">
                        <Label htmlFor="ay_no">AY Number *</Label>
                        <Input
                            id="ay_no"
                            {...formik.getFieldProps('ay_no')}
                            placeholder="e.g., 2024-25"
                        />
                        {formik.touched.ay_no && formik.errors.ay_no && (
                            <p className="text-sm text-destructive">{formik.errors.ay_no}</p>
                        )}
                    </div>
                    <Button
                        type="submit"
                        disabled={formik.isSubmitting}
                        className="w-full"
                    >
                        {formik.isSubmitting ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                    </Button>
                </form>
            </FormModal>

            <Dialog open={!!deleteItem} onOpenChange={(open: boolean) => !open && setDeleteItem(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete AY Master</DialogTitle>
                    </DialogHeader>
                    <p>
                        Are you sure you want to delete <strong>{deleteItem?.ay_no}</strong>?
                        {deleteItem && deleteItem._count.itemManagements > 0 && (
                            <span className="block mt-2 text-red-500 text-sm">
                                This AY is referenced by {deleteItem._count.itemManagements} items.
                            </span>
                        )}
                    </p>
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
