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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toDateInputValue, formatDateDisplay } from '@/lib/date-utils';

interface Employee {
    id: string;
    name: string;
    employee_code: string;
}

interface PerformanceReview {
    id: string;
    employee_id: string;
    reviewer: string | null;
    rating: number | null;
    goals: string | null;
    achievements: string | null;
    comments: string | null;
    review_date: string;
    createdAt: string;
    updatedAt: string;
    employee?: Employee;
}

interface PaginationInfo {
    page: number;
    pages: number;
    total: number;
    limit: number;
}

const performanceValidationSchema = Yup.object({
    employee_id: Yup.string().required('Employee is required'),
    reviewer: Yup.string().nullable(),
    rating: Yup.number().integer().min(1).max(5).nullable(),
    goals: Yup.string().nullable(),
    achievements: Yup.string().nullable(),
    comments: Yup.string().nullable(),
    review_date: Yup.string().nullable(),
});

function RatingDisplay({ rating }: { rating: number | null }) {
    if (!rating) return <span className="text-muted-foreground">-</span>;
    return (
        <span className="inline-flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
                <span key={i} className={i < rating ? 'text-yellow-500' : 'text-gray-300'}>
                    ★
                </span>
            ))}
            <span className="ml-1 text-xs text-muted-foreground">({rating}/5)</span>
        </span>
    );
}

interface PerformanceClientProps {
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
}

export function PerformanceClient({ canCreate = true, canEdit = true, canDelete = true }: PerformanceClientProps) {
    const [data, setData] = useState<PerformanceReview[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<PerformanceReview | null>(null);
    const [deleteItem, setDeleteItem] = useState<PerformanceReview | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1,
        pages: 1,
        total: 0,
        limit: 10,
    });

    const fetchDropdownData = useCallback(async () => {
        try {
            const res = await axios.get('/api/hr/employees?limit=100');
            setEmployees(res.data.data || []);
        } catch {
            toast.error('Failed to load employees');
        }
    }, []);

    useEffect(() => {
        fetchDropdownData();
    }, [fetchDropdownData]);

    const formik = useFormik({
        initialValues: {
            employee_id: '',
            reviewer: '',
            rating: '' as string | number,
            goals: '',
            achievements: '',
            comments: '',
            review_date: '',
        },
        validationSchema: performanceValidationSchema,
        validateOnChange: true,
        validateOnBlur: true,
        enableReinitialize: true,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            try {
                const payload = {
                    ...values,
                    rating: values.rating ? Number(values.rating) : null,
                    review_date: values.review_date || null,
                };
                if (editingItem) {
                    await axios.put(`/api/hr/performance/${editingItem.id}`, payload);
                    toast.success('Performance review updated successfully');
                } else {
                    await axios.post('/api/hr/performance', payload);
                    toast.success('Performance review created successfully');
                }
                setModalOpen(false);
                setEditingItem(null);
                resetForm();
                fetchData(pagination.page);
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save performance review');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const progress = useMemo(() => {
        const fields = [formik.values.employee_id, formik.values.reviewer, formik.values.rating, formik.values.goals, formik.values.achievements, formik.values.comments, formik.values.review_date];
        const filled = fields.filter((v) => v && String(v).trim() !== '').length;
        return Math.round((filled / fields.length) * 100);
    }, [formik.values]);

    const fetchData = useCallback(async (page = 1, searchValue = search, pageLimit = limit) => {
        try {
            setLoading(true);
            const response = await axios.get('/api/hr/performance', {
                params: { page, limit: pageLimit, search: searchValue },
            });
            setData(response.data.data);
            setPagination(response.data.pagination);
        } catch {
            toast.error('Failed to fetch performance reviews');
        } finally {
            setLoading(false);
        }
    }, [search, limit]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleEdit = (item: PerformanceReview) => {
        setEditingItem(item);
        formik.resetForm({
            values: {
                employee_id: item.employee_id,
                reviewer: item.reviewer || '',
                rating: item.rating ? String(item.rating) : '',
                goals: item.goals || '',
                achievements: item.achievements || '',
                comments: item.comments || '',
                review_date: toDateInputValue(item.review_date),
            },
        });
        setModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            const response = await axios.delete(`/api/hr/performance/${deleteItem.id}`);
            toast.success(response.data.message || 'Performance review deleted successfully');
            setDeleteItem(null);
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete performance review');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingItem(null);
        formik.resetForm({
            values: {
                employee_id: '',
                reviewer: '',
                rating: '',
                goals: '',
                achievements: '',
                comments: '',
                review_date: '',
            },
        });
        setModalOpen(true);
    };

    const columns: Column<PerformanceReview>[] = [
        {
            header: 'Employee',
            accessorKey: 'employee',
            cell: (item) => item.employee?.name || '-',
        },
        {
            header: 'Review Date',
            accessorKey: 'review_date',
            cell: (item) => formatDateDisplay(item.review_date),
        },
        {
            header: 'Rating',
            accessorKey: 'rating',
            cell: (item) => <RatingDisplay rating={item.rating} />,
        },
        {
            header: 'Reviewer',
            accessorKey: 'reviewer',
            cell: (item) => item.reviewer || '-',
        },
        {
            header: 'Goals',
            accessorKey: 'goals',
            cell: (item) => item.goals ? (
                <span className="line-clamp-2 max-w-[200px] text-sm">{item.goals}</span>
            ) : '-',
        },
        {
            header: 'Achievements',
            accessorKey: 'achievements',
            cell: (item) => item.achievements ? (
                <span className="line-clamp-2 max-w-[200px] text-sm">{item.achievements}</span>
            ) : '-',
        },
    ];

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 p-2 md:p-6 w-full overflow-hidden">
            <div className="shrink-0">
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Performance Reviews</h2>
                <p className="text-muted-foreground text-sm">Manage employee performance reviews</p>
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
                searchPlaceholder="Search performance reviews..."
                addLabel="Add Review"
            />

            <FormModal
                title={editingItem ? 'Edit Performance Review' : 'Add Performance Review'}
                isOpen={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setEditingItem(null);
                    formik.resetForm();
                }}
                loading={formik.isSubmitting}
                submitLabel={editingItem ? 'Update' : 'Create'}
                size="xl"
                progress={progress}
            >
                <form onSubmit={formik.handleSubmit} className="space-y-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="perf_employee_id">Employee *</Label>
                        <Select
                            value={formik.values.employee_id}
                            onValueChange={(value) => formik.setFieldValue('employee_id', value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select employee" />
                            </SelectTrigger>
                            <SelectContent>
                                {employees.map((emp) => (
                                    <SelectItem key={emp.id} value={emp.id}>
                                        {emp.name} ({emp.employee_code})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {formik.touched.employee_id && formik.errors.employee_id && (
                            <p className="text-sm text-destructive">{formik.errors.employee_id}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="perf_reviewer">Reviewer</Label>
                            <Input id="perf_reviewer" {...formik.getFieldProps('reviewer')} placeholder="Reviewer name" />
                        </div>

                        <div className="space-y-2 relative">
                            <Label htmlFor="perf_review_date">Review Date</Label>
                            <Input id="perf_review_date" type="date" {...formik.getFieldProps('review_date')} />
                        </div>
                    </div>

                    <div className="space-y-2 relative">
                        <Label htmlFor="perf_rating">Rating (1-5)</Label>
                        <Input
                            id="perf_rating"
                            type="number"
                            min={1}
                            max={5}
                            {...formik.getFieldProps('rating')}
                            placeholder="Rate from 1 to 5"
                        />
                        {formik.touched.rating && formik.errors.rating && (
                            <p className="text-sm text-destructive">{formik.errors.rating}</p>
                        )}
                    </div>

                    <div className="space-y-2 relative">
                        <Label htmlFor="perf_goals">Goals</Label>
                        <textarea
                            id="perf_goals"
                            rows={3}
                            className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            {...formik.getFieldProps('goals')}
                            placeholder="Goals for this review period"
                        />
                    </div>

                    <div className="space-y-2 relative">
                        <Label htmlFor="perf_achievements">Achievements</Label>
                        <textarea
                            id="perf_achievements"
                            rows={3}
                            className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            {...formik.getFieldProps('achievements')}
                            placeholder="Key achievements"
                        />
                    </div>

                    <div className="space-y-2 relative">
                        <Label htmlFor="perf_comments">Comments / Areas for Improvement</Label>
                        <textarea
                            id="perf_comments"
                            rows={3}
                            className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            {...formik.getFieldProps('comments')}
                            placeholder="Additional comments or areas for improvement"
                        />
                    </div>

                    <Button type="submit" disabled={formik.isSubmitting} className="w-full">
                        {formik.isSubmitting ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                    </Button>
                </form>
            </FormModal>

            <Dialog open={!!deleteItem} onOpenChange={(open: boolean) => !open && setDeleteItem(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Delete Performance Review</DialogTitle></DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to delete the review for <strong>{deleteItem?.employee?.name}</strong>?
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
