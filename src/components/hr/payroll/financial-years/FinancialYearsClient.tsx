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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toDateInputValue, formatDateDisplay } from '@/lib/date-utils';

interface Period {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    is_closed: boolean;
}

interface FinancialYear {
    id: string;
    name: string;
    start_date: string;
    end_date: string;
    is_closed: boolean;
    periods?: Period[];
    createdAt: string;
    updatedAt: string;
}

interface PaginationInfo {
    page: number;
    pages: number;
    total: number;
    limit: number;
}

const fyValidation = Yup.object({
    name: Yup.string().trim().required('Name is required').max(100),
    start_date: Yup.string().required('Start date is required'),
    end_date: Yup.string().required('End date is required'),
    is_closed: Yup.boolean(),
});

const periodValidation = Yup.object({
    name: Yup.string().trim().required('Name is required'),
    start_date: Yup.string().required('Start date is required'),
    end_date: Yup.string().required('End date is required'),
    is_closed: Yup.boolean(),
});

export function FinancialYearsClient({ canCreate = true, canEdit = true, canDelete = true }) {
    const [data, setData] = useState<FinancialYear[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<FinancialYear | null>(null);
    const [deleteItem, setDeleteItem] = useState<FinancialYear | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [selectedFY, setSelectedFY] = useState<FinancialYear | null>(null);
    const [periods, setPeriods] = useState<Period[]>([]);
    const [periodModalOpen, setPeriodModalOpen] = useState(false);
    const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
    const [periodLoading, setPeriodLoading] = useState(false);
    const [deletePeriod, setDeletePeriod] = useState<Period | null>(null);
    const [deletePeriodLoading, setDeletePeriodLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('list');
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1, pages: 1, total: 0, limit: 10,
    });

    const formik = useFormik({
        initialValues: { name: editingItem?.name || '', start_date: toDateInputValue(editingItem?.start_date), end_date: toDateInputValue(editingItem?.end_date), is_closed: editingItem?.is_closed ?? false },
        validationSchema: fyValidation,
        validateOnChange: true,
        validateOnBlur: true,
        enableReinitialize: true,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            try {
                if (editingItem) {
                    await axios.put(`/api/hr/financial-years/${editingItem.id}`, values);
                    toast.success('Financial year updated successfully');
                } else {
                    await axios.post('/api/hr/financial-years', values);
                    toast.success('Financial year created successfully');
                }
                setModalOpen(false);
                setEditingItem(null);
                resetForm();
                fetchData(pagination.page);
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save financial year');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const periodFormik = useFormik({
        initialValues: { name: editingPeriod?.name || '', start_date: toDateInputValue(editingPeriod?.start_date), end_date: toDateInputValue(editingPeriod?.end_date), is_closed: editingPeriod?.is_closed ?? false },
        validationSchema: periodValidation,
        validateOnChange: true,
        validateOnBlur: true,
        enableReinitialize: true,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            if (!selectedFY) return;
            try {
                setPeriodLoading(true);
                if (editingPeriod) {
                    await axios.put(`/api/hr/financial-years/${selectedFY.id}/periods/${editingPeriod.id}`, values);
                    toast.success('Period updated successfully');
                } else {
                    await axios.post(`/api/hr/financial-years/${selectedFY.id}/periods`, values);
                    toast.success('Period created successfully');
                }
                setPeriodModalOpen(false);
                setEditingPeriod(null);
                resetForm();
                fetchPeriods(selectedFY.id);
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save period');
            } finally {
                setSubmitting(false);
                setPeriodLoading(false);
            }
        },
    });

    const fyProgress = useMemo(() => {
        const fields = [formik.values.name, formik.values.start_date, formik.values.end_date];
        const filled = fields.filter((v) => v && String(v).trim() !== '').length;
        return Math.round((filled / fields.length) * 100);
    }, [formik.values]);

    const periodProgress = useMemo(() => {
        const fields = [periodFormik.values.name, periodFormik.values.start_date, periodFormik.values.end_date];
        const filled = fields.filter((v) => v && String(v).trim() !== '').length;
        return Math.round((filled / fields.length) * 100);
    }, [periodFormik.values]);

    const fetchPeriods = useCallback(async (fyId: string) => {
        try {
            const res = await axios.get(`/api/hr/financial-years/${fyId}/periods`);
            setPeriods(res.data.data || []);
        } catch {
            toast.error('Failed to fetch periods');
        }
    }, []);

    const fetchData = useCallback(async (page = 1, searchValue = search, pageLimit = limit) => {
        try {
            setLoading(true);
            const response = await axios.get('/api/hr/financial-years', {
                params: { page, limit: pageLimit, search: searchValue },
            });
            setData(response.data.data);
            setPagination(response.data.pagination);
        } catch {
            toast.error('Failed to fetch financial years');
        } finally {
            setLoading(false);
        }
    }, [search, limit]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleEdit = (item: FinancialYear) => {
        setEditingItem(item);
        formik.resetForm({
            values: {
                name: item.name,
                start_date: toDateInputValue(item.start_date),
                end_date: toDateInputValue(item.end_date),
                is_closed: item.is_closed,
            },
        });
        setModalOpen(true);
    };

    const handleViewPeriods = (item: FinancialYear) => {
        setSelectedFY(item);
        setActiveTab('periods');
        fetchPeriods(item.id);
    };

    const handleDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            const response = await axios.delete(`/api/hr/financial-years/${deleteItem.id}`);
            toast.success(response.data.message || 'Financial year deleted successfully');
            setDeleteItem(null);
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete financial year');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingItem(null);
        formik.resetForm({ values: { name: '', start_date: '', end_date: '', is_closed: false } });
        setModalOpen(true);
    };

    const handleAddPeriod = () => {
        setEditingPeriod(null);
        periodFormik.resetForm({ values: { name: '', start_date: '', end_date: '', is_closed: false } });
        setPeriodModalOpen(true);
    };

    const handleEditPeriod = (period: Period) => {
        setEditingPeriod(period);
        periodFormik.resetForm({
            values: {
                name: period.name,
                start_date: toDateInputValue(period.start_date),
                end_date: toDateInputValue(period.end_date),
                is_closed: period.is_closed,
            },
        });
        setPeriodModalOpen(true);
    };

    const handleDeletePeriod = async () => {
        if (!deletePeriod || !selectedFY) return;
        try {
            setDeletePeriodLoading(true);
            const response = await axios.delete(`/api/hr/financial-years/${selectedFY.id}/periods/${deletePeriod.id}`);
            toast.success(response.data.message || 'Period deleted successfully');
            setDeletePeriod(null);
            fetchPeriods(selectedFY.id);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete period');
        } finally {
            setDeletePeriodLoading(false);
        }
    };

    const columns: Column<FinancialYear>[] = [
        { header: 'Name', accessorKey: 'name', sortable: true },
        {
            header: 'Start Date',
            accessorKey: 'start_date',
            cell: (item) => formatDateDisplay(item.start_date),
        },
        {
            header: 'End Date',
            accessorKey: 'end_date',
            cell: (item) => formatDateDisplay(item.end_date),
        },
        {
            header: 'Closed',
            accessorKey: 'is_closed',
            cell: (item) => <Badge variant={item.is_closed ? 'destructive' : 'default'}>{item.is_closed ? 'Yes' : 'No'}</Badge>,
        },
    ];

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 p-2 w-full overflow-hidden">
            <div className="shrink-0 flex items-center justify-between">
                <div>
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Financial Years</h2>
                    <p className="text-muted-foreground text-sm">Manage financial years and periods</p>
                </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="list">Financial Years</TabsTrigger>
                    <TabsTrigger value="periods" disabled={!selectedFY}>
                        {selectedFY ? `Periods: ${selectedFY.name}` : 'Periods'}
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="list">
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
                        searchPlaceholder="Search financial years..."
                        addLabel="Add Financial Year"
                        extraActions={(item) => [{
                            label: 'View Periods',
                            icon: null as any,
                            onClick: () => handleViewPeriods(item),
                        }]}
                    />
                </TabsContent>

                <TabsContent value="periods">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold">Periods for {selectedFY?.name}</h3>
                                <p className="text-sm text-muted-foreground">{formatDateDisplay(selectedFY?.start_date || '')} - {formatDateDisplay(selectedFY?.end_date || '')}</p>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm" onClick={() => setActiveTab('list')}>Back</Button>
                                {canCreate && (
                                    <Button size="sm" onClick={handleAddPeriod}>Add Period</Button>
                                )}
                            </div>
                        </div>

                        {periods.length === 0 ? (
                            <Card>
                                <CardContent className="py-8 text-center text-muted-foreground">
                                    No periods found. Click "Add Period" to create one.
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="grid gap-3">
                                {periods.map((period) => (
                                    <Card key={period.id}>
                                        <CardContent className="py-4">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="font-medium">{period.name}</p>
                                                    <p className="text-sm text-muted-foreground">
                                                        {formatDateDisplay(period.start_date)} - {formatDateDisplay(period.end_date)}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <Badge variant={period.is_closed ? 'destructive' : 'default'}>
                                                        {period.is_closed ? 'Closed' : 'Open'}
                                                    </Badge>
                                                    {canEdit && (
                                                        <Button variant="ghost" size="sm" onClick={() => handleEditPeriod(period)}>Edit</Button>
                                                    )}
                                                    {canDelete && (
                                                        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => setDeletePeriod(period)}>Delete</Button>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </TabsContent>
            </Tabs>

            <FormModal
                title={editingItem ? 'Edit Financial Year' : 'Add Financial Year'}
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditingItem(null); formik.resetForm(); }}
                loading={formik.isSubmitting}
                submitLabel={editingItem ? 'Update' : 'Create'}
                progress={fyProgress}
            >
                <form onSubmit={formik.handleSubmit} className="space-y-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="fy_name">Name *</Label>
                        <Input id="fy_name" {...formik.getFieldProps('name')} placeholder="e.g., FY 2025-2026" />
                        {formik.touched.name && formik.errors.name && (
                            <p className="text-sm text-destructive">{formik.errors.name}</p>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="start_date">Start Date *</Label>
                            <Input id="start_date" type="date" {...formik.getFieldProps('start_date')} />
                            {formik.touched.start_date && formik.errors.start_date && (
                                <p className="text-sm text-destructive">{formik.errors.start_date}</p>
                            )}
                        </div>
                        <div className="space-y-2 relative">
                            <Label htmlFor="end_date">End Date *</Label>
                            <Input id="end_date" type="date" {...formik.getFieldProps('end_date')} />
                            {formik.touched.end_date && formik.errors.end_date && (
                                <p className="text-sm text-destructive">{formik.errors.end_date}</p>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="is_closed">Closed</Label>
                        <Select value={formik.values.is_closed ? 'true' : 'false'} onValueChange={(value) => formik.setFieldValue('is_closed', value === 'true')}>
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="false">No</SelectItem>
                                <SelectItem value="true">Yes</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    </div>
                    <Button type="submit" disabled={formik.isSubmitting} className="w-full">
                        {formik.isSubmitting ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                    </Button>
                </form>
            </FormModal>

            <FormModal
                title={editingPeriod ? 'Edit Period' : 'Add Period'}
                isOpen={periodModalOpen}
                onClose={() => { setPeriodModalOpen(false); setEditingPeriod(null); periodFormik.resetForm(); }}
                loading={periodLoading}
                submitLabel={editingPeriod ? 'Update' : 'Create'}
                progress={periodProgress}
            >
                <form onSubmit={periodFormik.handleSubmit} className="space-y-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="period_name">Name *</Label>
                        <Input id="period_name" {...periodFormik.getFieldProps('name')} placeholder="e.g., April 2025" />
                        {periodFormik.touched.name && periodFormik.errors.name && (
                            <p className="text-sm text-destructive">{periodFormik.errors.name}</p>
                        )}
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="period_start">Start Date *</Label>
                            <Input id="period_start" type="date" {...periodFormik.getFieldProps('start_date')} />
                            {periodFormik.touched.start_date && periodFormik.errors.start_date && (
                                <p className="text-sm text-destructive">{periodFormik.errors.start_date}</p>
                            )}
                        </div>
                        <div className="space-y-2 relative">
                            <Label htmlFor="period_end">End Date *</Label>
                            <Input id="period_end" type="date" {...periodFormik.getFieldProps('end_date')} />
                            {periodFormik.touched.end_date && periodFormik.errors.end_date && (
                                <p className="text-sm text-destructive">{periodFormik.errors.end_date}</p>
                            )}
                        </div>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="period_closed">Closed</Label>
                        <Select value={periodFormik.values.is_closed ? 'true' : 'false'} onValueChange={(value) => periodFormik.setFieldValue('is_closed', value === 'true')}>
                            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="false">No</SelectItem>
                                <SelectItem value="true">Yes</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    </div>
                    <Button type="submit" disabled={periodFormik.isSubmitting} className="w-full">
                        {periodFormik.isSubmitting ? 'Saving...' : editingPeriod ? 'Update' : 'Create'}
                    </Button>
                </form>
            </FormModal>

            <Dialog open={!!deletePeriod} onOpenChange={(open: boolean) => !open && setDeletePeriod(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Delete Period</DialogTitle></DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to delete <strong>{deletePeriod?.name}</strong>?
                    </DialogDescription>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeletePeriod(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDeletePeriod} disabled={deletePeriodLoading}>
                            {deletePeriodLoading ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deleteItem} onOpenChange={(open: boolean) => !open && setDeleteItem(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Delete Financial Year</DialogTitle></DialogHeader>
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
