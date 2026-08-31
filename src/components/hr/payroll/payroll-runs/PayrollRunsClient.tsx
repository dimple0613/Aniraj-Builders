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
import { useRouter } from 'next/navigation';
import { toDateInputValue, formatDateDisplay } from '@/lib/date-utils';

interface FinancialYear {
    id: string;
    name: string;
}

interface Period {
    id: string;
    name: string;
}

interface PayrollRun {
    id: string;
    financial_year_id: string;
    period_id: string;
    process_date: string;
    status: 'DRAFT' | 'PROCESSED' | 'FINALIZED';
    financial_year?: FinancialYear;
    period?: Period;
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
    financial_year_id: Yup.string().required('Financial year is required'),
    period_id: Yup.string().required('Period is required'),
    process_date: Yup.string().required('Process date is required'),
});

export function PayrollRunsClient({ canCreate = true, canEdit = true, canDelete = true }: { canCreate?: boolean; canEdit?: boolean; canDelete?: boolean }) {
    const router = useRouter();
    const [data, setData] = useState<PayrollRun[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<PayrollRun | null>(null);
    const [deleteItem, setDeleteItem] = useState<PayrollRun | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [financialYears, setFinancialYears] = useState<FinancialYear[]>([]);
    const [periods, setPeriods] = useState<Period[]>([]);
    const [processLoading, setProcessLoading] = useState(false);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1, pages: 1, total: 0, limit: 10,
    });

    const fetchDropdowns = useCallback(async () => {
        try {
            const res = await axios.get('/api/hr/financial-years', { params: { limit: 50 } });
            setFinancialYears(res.data.data || []);
        } catch {
            toast.error('Failed to load financial years');
        }
    }, []);

    useEffect(() => { fetchDropdowns(); }, [fetchDropdowns]);

    const fetchPeriods = useCallback(async (fyId: string) => {
        if (!fyId) { setPeriods([]); return; }
        try {
            const res = await axios.get(`/api/hr/financial-years/${fyId}/periods`);
            setPeriods(res.data.data || []);
        } catch {
            setPeriods([]);
        }
    }, []);

    const formik = useFormik({
        initialValues: { financial_year_id: editingItem?.financial_year_id || '', period_id: editingItem?.period_id || '', process_date: toDateInputValue(editingItem?.process_date) },
        validationSchema,
        validateOnChange: true,
        validateOnBlur: true,
        enableReinitialize: true,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            try {
                if (editingItem) {
                    await axios.put(`/api/hr/payroll-runs/${editingItem.id}`, values);
                    toast.success('Payroll run updated successfully');
                } else {
                    await axios.post('/api/hr/payroll-runs', values);
                    toast.success('Payroll run created successfully');
                }
                setModalOpen(false);
                setEditingItem(null);
                resetForm();
                fetchData(pagination.page);
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save payroll run');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const progress = useMemo(() => {
        const fields = [formik.values.financial_year_id, formik.values.period_id, formik.values.process_date];
        const filled = fields.filter((v) => v && String(v).trim() !== '').length;
        return Math.round((filled / fields.length) * 100);
    }, [formik.values]);

    const fetchData = useCallback(async (page = 1, searchValue = search, pageLimit = limit) => {
        try {
            setLoading(true);
            const response = await axios.get('/api/hr/payroll-runs', {
                params: { page, limit: pageLimit, search: searchValue },
            });
            setData(response.data.data);
            setPagination(response.data.pagination);
        } catch {
            toast.error('Failed to fetch payroll runs');
        } finally {
            setLoading(false);
        }
    }, [search, limit]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleProcessPayroll = async () => {
        try {
            setProcessLoading(true);
            const res = await axios.post('/api/hr/payroll-runs/process');
            toast.success(res.data.message || 'Payroll processed successfully');
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to process payroll');
        } finally {
            setProcessLoading(false);
        }
    };

    const handleEdit = (item: PayrollRun) => {
        setEditingItem(item);
        formik.resetForm({
            values: {
                financial_year_id: item.financial_year_id,
                period_id: item.period_id,
                process_date: toDateInputValue(item.process_date),
            },
        });
        fetchPeriods(item.financial_year_id);
        setModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            const response = await axios.delete(`/api/hr/payroll-runs/${deleteItem.id}`);
            toast.success(response.data.message || 'Payroll run deleted successfully');
            setDeleteItem(null);
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete payroll run');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingItem(null);
        formik.resetForm({ values: { financial_year_id: '', period_id: '', process_date: '' } });
        setPeriods([]);
        setModalOpen(true);
    };

    const statusBadge = (status: string) => {
        const variants: Record<string, string> = { DRAFT: 'secondary', PROCESSED: 'default', FINALIZED: 'outline' };
        const colors: Record<string, string> = {
            DRAFT: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
            PROCESSED: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
            FINALIZED: 'bg-green-100 text-green-800 hover:bg-green-100',
        };
        return (
            <Badge variant={(variants[status] as any) || 'secondary'} className={colors[status] || ''}>
                {status}
            </Badge>
        );
    };

    const columns: Column<PayrollRun>[] = [
        {
            header: 'Financial Year',
            accessorKey: 'financial_year',
            cell: (item) => item.financial_year?.name || (item as any).financialYear?.name || '-',
        },
        {
            header: 'Period',
            accessorKey: 'period',
            cell: (item) => {
                const p = item.period || (item as any).period;
                if (!p) return '-';
                if (p.name) return p.name;
                if (p.month && p.year) {
                    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                    return `${MONTHS[p.month - 1]} ${p.year}`;
                }
                return '-';
            },
        },
        {
            header: 'Process Date',
            accessorKey: 'process_date',
            cell: (item) => formatDateDisplay(item.process_date),
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
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Payroll Runs</h2>
                    <p className="text-muted-foreground text-sm">Manage payroll processing runs</p>
                </div>
                <Button
                    variant="default"
                    size="sm"
                    onClick={handleProcessPayroll}
                    disabled={processLoading}
                >
                    {processLoading ? 'Processing...' : 'Process Payroll'}
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
                onView={(item) => router.push(`/hr/payroll-runs/${item.id}`)}
                searchPlaceholder="Search payroll runs..."
                addLabel="Add Run"
            />

            <FormModal
                title={editingItem ? 'Edit Payroll Run' : 'Add Payroll Run'}
                isOpen={modalOpen}
                onClose={() => { setModalOpen(false); setEditingItem(null); formik.resetForm(); setPeriods([]); }}
                loading={formik.isSubmitting}
                submitLabel={editingItem ? 'Update' : 'Create'}
                progress={progress}
            >
                <form onSubmit={formik.handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="financial_year_id">Financial Year *</Label>
                        <Select
                            value={formik.values.financial_year_id}
                            onValueChange={(value) => {
                                formik.setFieldValue('financial_year_id', value);
                                formik.setFieldValue('period_id', '');
                                fetchPeriods(value);
                            }}
                        >
                            <SelectTrigger><SelectValue placeholder="Select financial year" /></SelectTrigger>
                            <SelectContent>
                                {financialYears.map((fy) => (
                                    <SelectItem key={fy.id} value={fy.id}>{fy.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {formik.touched.financial_year_id && formik.errors.financial_year_id && (
                            <p className="text-sm text-destructive">{formik.errors.financial_year_id}</p>
                        )}
                    </div>
                    
                    <div className="space-y-2 relative">
                        <Label htmlFor="period_id">Period *</Label>
                        <Select value={formik.values.period_id} onValueChange={(value) => formik.setFieldValue('period_id', value)}>
                            <SelectTrigger><SelectValue placeholder="Select period" /></SelectTrigger>
                            <SelectContent>
                                {periods.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {formik.touched.period_id && formik.errors.period_id && (
                            <p className="text-sm text-destructive">{formik.errors.period_id}</p>
                        )}
                    </div>
                    </div>
                    <div className="space-y-2 relative">
                        <Label htmlFor="process_date">Process Date *</Label>
                        <Input id="process_date" type="date" {...formik.getFieldProps('process_date')} />
                        {formik.touched.process_date && formik.errors.process_date && (
                            <p className="text-sm text-destructive">{formik.errors.process_date}</p>
                        )}
                    </div>
                    <Button type="submit" disabled={formik.isSubmitting} className="w-full">
                        {formik.isSubmitting ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                    </Button>
                </form>
            </FormModal>

            <Dialog open={!!deleteItem} onOpenChange={(open: boolean) => !open && setDeleteItem(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Delete Payroll Run</DialogTitle></DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to delete this payroll run?
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
