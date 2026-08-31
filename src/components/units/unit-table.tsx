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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

interface Unit {
    id: string;
    unit_name: string;
    company_id: string;
    createdAt: string;
    updatedAt: string;
    company?: {
        company_name: string;
    };
    _count: {
        itemManagements: number;
        vardhiEstimationItems?: number;
    };
}

interface PaginationInfo {
    page: number;
    pages: number;
    total: number;
    limit: number;
}

const unitValidationSchema = Yup.object({
    unit_name: Yup.string()
        .trim()
        .required('Unit name is required')
        .min(1, 'Unit name is required'),
});

export function UnitTable() {
    const [data, setData] = useState<Unit[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Unit | null>(null);
    const [deleteItem, setDeleteItem] = useState<Unit | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1,
        pages: 1,
        total: 0,
        limit: 10,
    });

    const formik = useFormik({
        initialValues: {
            unit_name: '',
        },
        validationSchema: unitValidationSchema,
        validateOnChange: true,
        validateOnBlur: true,
        enableReinitialize: true,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            try {
                if (editingItem) {
                    await axios.put(`/api/units/${editingItem.id}`, values);
                    toast.success('Unit updated successfully');
                } else {
                    await axios.post('/api/units', values);
                    toast.success('Unit created successfully');
                }
                setModalOpen(false);
                setEditingItem(null);
                resetForm();
                fetchData(pagination.page);
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save unit');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const fetchData = useCallback(async (page = 1, searchValue = search, pageLimit = limit) => {
        try {
            setLoading(true);
            const response = await axios.get('/api/units', {
                params: {
                    page,
                    limit: pageLimit,
                    search: searchValue,
                },
            });
            setData(response.data.data);
            setPagination(response.data.pagination);
        } catch (error) {
            toast.error('Failed to fetch units');
        } finally {
            setLoading(false);
        }
    }, [search, limit]);

    const handleEdit = (item: Unit) => {
        setEditingItem(item);
        formik.resetForm({ values: { unit_name: item.unit_name } });
        setModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            const response = await axios.delete(`/api/units/${deleteItem.id}`);
            toast.success(response.data.message || 'Unit deleted successfully');
            setDeleteItem(null);
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string; references?: { items: number; estimationItems: number } } } };
            const refs = err.response?.data?.references;
            let errorMsg = err.response?.data?.error || err.response?.data?.message || 'Failed to delete unit';
            if (refs) {
                const parts = [];
                if (refs.items > 0) parts.push(`${refs.items} item(s)`);
                if (refs.estimationItems > 0) parts.push(`${refs.estimationItems} estimation item(s)`);
                errorMsg = `Cannot delete: Unit is referenced by ${parts.join(' and ')}`;
            }
            toast.error(errorMsg);
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingItem(null);
        formik.resetForm({ values: { unit_name: '' } });
        setModalOpen(true);
    };

    const progress = useMemo(() => {
        let filled = 0;
        let total = 0;

        const allFields = [
            { value: formik.values.unit_name },
        ];

        allFields.forEach(field => {
            total++;
            if (field.value && field.value.toString().trim() !== '') {
                filled++;
            }
        });

        return total > 0 ? Math.round((filled / total) * 100) : 0;
    }, [formik.values.unit_name]);

    const columns: Column<Unit>[] = [
        {
            header: 'Unit Name',
            accessorKey: 'unit_name',
            sortable: true,
        },
        {
            header: 'Items',
            accessorKey: '_count.itemManagements',
            cell: (item) => (
                <Badge variant="outline" className="text-center">
                    {item._count.itemManagements}
                </Badge>
            ),
        },
    ];

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 p-2 md:p-6 w-full overflow-hidden">
            <div className="shrink-0">
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Units</h2>
                <p className="text-muted-foreground text-sm">Manage units of measurement</p>
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
                onAdd={handleAdd}
                onEdit={handleEdit}
                onDelete={(item) => setDeleteItem(item)}
                searchPlaceholder="Search units..."
                addLabel="Add Unit"
                showAddOnlyOnLastPage={true}
            />

            <FormModal
                title={editingItem ? 'Edit Unit' : 'Add Unit'}
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
                        <Label htmlFor="unit_name">Unit Name *</Label>
                        <Input
                            id="unit_name"
                            {...formik.getFieldProps('unit_name')}
                            placeholder="e.g., Kilogram, Meter, Piece"
                        />
                        {formik.touched.unit_name && formik.errors.unit_name && (
                            <p className="text-sm text-destructive">{formik.errors.unit_name}</p>
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
                        <DialogTitle>Delete Unit</DialogTitle>
                    </DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to delete <strong>{deleteItem?.unit_name}</strong>?
                        {deleteItem && (deleteItem._count.itemManagements > 0 || (deleteItem._count.vardhiEstimationItems ?? 0) > 0) && (
                            <span className="block mt-2 text-red-500 text-sm">
                                This unit is referenced by {deleteItem._count.itemManagements > 0 && `${deleteItem._count.itemManagements} item(s)`}{deleteItem._count.itemManagements > 0 && (deleteItem._count.vardhiEstimationItems ?? 0) > 0 && ' and '}{(deleteItem._count.vardhiEstimationItems ?? 0) > 0 && `${deleteItem._count.vardhiEstimationItems} estimation item(s)`}.
                            </span>
                        )}
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
