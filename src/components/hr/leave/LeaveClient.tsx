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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { toDateInputValue, formatDateDisplay } from '@/lib/date-utils';

interface Employee {
    id: string;
    name: string;
    employee_code: string;
}

interface LeaveType {
    id: string;
    name: string;
    days: number;
}

interface LeaveRequest {
    id: string;
    employee_id: string;
    leave_type_id: string;
    from_date: string;
    to_date: string;
    reason: string | null;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    createdAt: string;
    updatedAt: string;
    employee?: Employee;
    leaveType?: LeaveType;
}

interface PaginationInfo {
    page: number;
    pages: number;
    total: number;
    limit: number;
}

const leaveValidationSchema = Yup.object({
    employee_id: Yup.string().required('Employee is required'),
    leave_type_id: Yup.string().required('Leave type is required'),
    from_date: Yup.string().required('From date is required'),
    to_date: Yup.string().required('To date is required').test(
        'to-date-not-before-from',
        'To date cannot be earlier than from date',
        function (value) {
            const { from_date } = this.parent;
            if (!from_date || !value) return true;
            return value >= from_date;
        }
    ),
    reason: Yup.string().nullable(),
});

function calculateDays(from_date: string, to_date: string): number {
    const from = new Date(from_date);
    const to = new Date(to_date);
    const diff = to.getTime() - from.getTime();
    return Math.max(1, Math.round(diff / (1000 * 60 * 60 * 24)) + 1);
}

interface LeaveClientProps {
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
    canApprove?: boolean;
}

export function LeaveClient({ canCreate = true, canEdit = true, canDelete = true, canApprove = true }: LeaveClientProps) {
    const [data, setData] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<LeaveRequest | null>(null);
    const [deleteItem, setDeleteItem] = useState<LeaveRequest | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
    const [leaveTypeModalOpen, setLeaveTypeModalOpen] = useState(false);
    const [addLeaveTypeModalOpen, setAddLeaveTypeModalOpen] = useState(false);
    const [leaveTypeLoading, setLeaveTypeLoading] = useState(false);
    const [deleteLeaveTypeItem, setDeleteLeaveTypeItem] = useState<LeaveType | null>(null);
    const [deleteLeaveTypeLoading, setDeleteLeaveTypeLoading] = useState(false);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1,
        pages: 1,
        total: 0,
        limit: 10,
    });

    const fetchDropdownData = useCallback(async () => {
        try {
            const [empRes, ltRes] = await Promise.all([
                axios.get('/api/hr/employees?limit=100'),
                axios.get('/api/hr/leave-types?limit=100'),
            ]);
            setEmployees(empRes.data.data || []);
            setLeaveTypes(ltRes.data.data || []);
        } catch {
            toast.error('Failed to load dropdown data');
        }
    }, []);

    useEffect(() => {
        fetchDropdownData();
    }, [fetchDropdownData]);

    const formik = useFormik({
        initialValues: {
            employee_id: editingItem?.employee_id || '',
            leave_type_id: editingItem?.leave_type_id || '',
            from_date: toDateInputValue(editingItem?.from_date),
            to_date: toDateInputValue(editingItem?.to_date),
            reason: editingItem?.reason || '',
        },
        validationSchema: leaveValidationSchema,
        validateOnChange: true,
        validateOnBlur: true,
        enableReinitialize: true,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            try {
                if (editingItem) {
                    await axios.put(`/api/hr/leave-requests/${editingItem.id}`, values);
                    toast.success('Leave request updated successfully');
                } else {
                    await axios.post('/api/hr/leave-requests', values);
                    toast.success('Leave request created successfully');
                }
                setModalOpen(false);
                setEditingItem(null);
                resetForm();
                fetchData(pagination.page);
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save leave request');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const leaveDuration = useMemo(() => {
        const { from_date, to_date } = formik.values;
        if (!from_date || !to_date) return 0;
        return calculateDays(from_date, to_date);
    }, [formik.values.from_date, formik.values.to_date]);

    const progress = useMemo(() => {
        const fields = [formik.values.employee_id, formik.values.leave_type_id, formik.values.from_date, formik.values.to_date, formik.values.reason];
        const filled = fields.filter((v) => v && String(v).trim() !== '').length;
        return Math.round((filled / fields.length) * 100);
    }, [formik.values]);

    const leaveTypeFormik = useFormik({
        initialValues: { name: '' },
        validationSchema: Yup.object({
            name: Yup.string().trim().required('Name is required'),
        }),
        validateOnChange: true,
        validateOnBlur: true,
        enableReinitialize: true,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            try {
                setLeaveTypeLoading(true);
                await axios.post('/api/hr/leave-types', {
                    name: values.name,
                });
                toast.success('Leave type created successfully');
                setAddLeaveTypeModalOpen(false);
                resetForm();
                await fetchDropdownData();
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to create leave type');
            } finally {
                setSubmitting(false);
                setLeaveTypeLoading(false);
            }
        },
    });

    const leaveTypeProgress = useMemo(() => {
        const fields = [leaveTypeFormik.values.name];
        const filled = fields.filter((v) => v && String(v).trim() !== '').length;
        return Math.round((filled / fields.length) * 100);
    }, [leaveTypeFormik.values]);

    const fetchData = useCallback(async (page = 1, searchValue = search, pageLimit = limit) => {
        try {
            setLoading(true);
            const response = await axios.get('/api/hr/leave-requests', {
                params: {
                    page,
                    limit: pageLimit,
                    search: searchValue,
                },
            });
            setData(response.data.data);
            setPagination(response.data.pagination);
        } catch {
            toast.error('Failed to fetch leave requests');
        } finally {
            setLoading(false);
        }
    }, [search, limit]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleEdit = (item: LeaveRequest) => {
        setEditingItem(item);
        formik.resetForm({
            values: {
                employee_id: item.employee_id,
                leave_type_id: item.leave_type_id,
                from_date: toDateInputValue(item.from_date),
                to_date: toDateInputValue(item.to_date),
                reason: item.reason || '',
            },
        });
        setModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            const response = await axios.delete(`/api/hr/leave-requests/${deleteItem.id}`);
            toast.success(response.data.message || 'Leave request deleted successfully');
            setDeleteItem(null);
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete leave request');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleApprove = async (item: LeaveRequest) => {
        try {
            await axios.put(`/api/hr/leave-requests/${item.id}`, { status: 'APPROVED' });
            toast.success('Leave request approved');
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to approve');
        }
    };

    const handleReject = async (item: LeaveRequest) => {
        try {
            await axios.put(`/api/hr/leave-requests/${item.id}`, { status: 'REJECTED' });
            toast.success('Leave request rejected');
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to reject');
        }
    };

    const handleDeleteLeaveType = async () => {
        if (!deleteLeaveTypeItem) return;
        try {
            setDeleteLeaveTypeLoading(true);
            await axios.delete(`/api/hr/leave-types/${deleteLeaveTypeItem.id}`);
            toast.success('Leave type deleted successfully');
            setDeleteLeaveTypeItem(null);
            await fetchDropdownData();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete leave type');
        } finally {
            setDeleteLeaveTypeLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingItem(null);
        formik.resetForm({
            values: {
                employee_id: '',
                leave_type_id: '',
                from_date: '',
                to_date: '',
                reason: '',
            },
        });
        setModalOpen(true);
    };

    const statusBadgeVariant = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return 'default' as const;
            case 'REJECTED':
                return 'destructive' as const;
            default:
                return 'secondary' as const;
        }
    };

    const statusBadgeClass = (status: string) => {
        switch (status) {
            case 'APPROVED':
                return 'bg-green-100 text-green-800 hover:bg-green-100';
            case 'REJECTED':
                return 'bg-red-100 text-red-800 hover:bg-red-100';
            default:
                return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100';
        }
    };

    const columns: Column<LeaveRequest>[] = [
        {
            header: 'Employee',
            accessorKey: 'employee',
            cell: (item) => item.employee?.name || '-',
        },
        {
            header: 'Leave Type',
            accessorKey: 'leaveType',
            cell: (item) => item.leaveType?.name || '-',
        },
        {
            header: 'From Date',
            accessorKey: 'from_date',
            cell: (item) => formatDateDisplay(item.from_date),
        },
        {
            header: 'To Date',
            accessorKey: 'to_date',
            cell: (item) => formatDateDisplay(item.to_date),
        },
        {
            header: 'Days',
            accessorKey: 'days',
            cell: (item) => (
                <Badge variant="outline" className="text-center">
                    {calculateDays(item.from_date, item.to_date)}
                </Badge>
            ),
        },
        {
            header: 'Status',
            accessorKey: 'status',
            cell: (item) => (
                <Badge variant={statusBadgeVariant(item.status)} className={statusBadgeClass(item.status)}>
                    {item.status}
                </Badge>
            ),
        },
    ];

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 p-2 w-full overflow-hidden">
            <div className="shrink-0 flex items-center justify-between">
                <div>
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Leave Requests</h2>
                    <p className="text-muted-foreground text-sm">Manage employee leave requests</p>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setLeaveTypeModalOpen(true)}
                >
                    Leave Type
                </Button>
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
                searchPlaceholder="Search leave requests..."
                addLabel="Add Leave Request"
                extraActions={(item) => {
                    if (canApprove && item.status === 'PENDING') {
                        return [
                            {
                                label: 'Approve',
                                icon: null as any,
                                onClick: () => handleApprove(item),
                                className: 'text-green-600',
                            },
                            {
                                label: 'Reject',
                                icon: null as any,
                                onClick: () => handleReject(item),
                                className: 'text-red-600',
                            },
                        ];
                    }
                    return [];
                }}
            />

            <FormModal
                title={editingItem ? 'Edit Leave Request' : 'Add Leave Request'}
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
                    <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="employee_id">Employee *</Label>
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
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="leave_type_id">Leave Type *</Label>
                        <Select
                            value={formik.values.leave_type_id}
                            onValueChange={(value) => {
                                if (value === '__add_new__') {
                                    leaveTypeFormik.resetForm();
                                    setLeaveTypeModalOpen(true);
                                } else {
                                    formik.setFieldValue('leave_type_id', value);
                                }
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select leave type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="__add_new__" className="text-primary font-medium border-b mb-1">
                                    + Add New
                                </SelectItem>
                                {leaveTypes.map((lt) => (
                                    <SelectItem key={lt.id} value={lt.id}>
                                        {lt.name} ({leaveDuration > 0 ? leaveDuration : lt.days} days)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        {formik.touched.leave_type_id && formik.errors.leave_type_id && (
                            <p className="text-sm text-destructive">{formik.errors.leave_type_id}</p>
                        )}
                    </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="from_date">From Date *</Label>
                            <Input
                                id="from_date"
                                type="date"
                                {...formik.getFieldProps('from_date')}
                            />
                            {formik.touched.from_date && formik.errors.from_date && (
                                <p className="text-sm text-destructive">{formik.errors.from_date}</p>
                            )}
                        </div>

                        <div className="space-y-2 relative">
                            <Label htmlFor="to_date">To Date *</Label>
                            <Input
                                id="to_date"
                                type="date"
                                min={formik.values.from_date || undefined}
                                {...formik.getFieldProps('to_date')}
                            />
                            {formik.touched.to_date && formik.errors.to_date && (
                                <p className="text-sm text-destructive">{formik.errors.to_date}</p>
                            )}
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="reason">Reason</Label>
                        <textarea
                            id="reason"
                            rows={3}
                            className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            {...formik.getFieldProps('reason')}
                            placeholder="Enter reason for leave"
                        />
                    </div>
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

            <Dialog open={leaveTypeModalOpen} onOpenChange={(open: boolean) => !open && setLeaveTypeModalOpen(false)}>
                <DialogContent className="sm:max-w-[500px] max-h-[85vh] flex flex-col overflow-hidden">
                    <DialogHeader className="shrink-0">
                        <DialogTitle>Manage Leave Types</DialogTitle>
                        <DialogDescription>Manage employee leave types.</DialogDescription>
                    </DialogHeader>

                    <div className="overflow-y-auto min-h-0 flex-1 -mx-6 px-6">
                        {leaveTypes.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">No leave types found.</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead className="w-[70px] text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {leaveTypes.map((lt) => (
                                        <TableRow key={lt.id}>
                                            <TableCell className="font-medium">{lt.name}</TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteLeaveTypeItem(lt)}>
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </div>

                    <DialogFooter className="flex-row justify-between sm:justify-between shrink-0">
                        <Button variant="outline" size="sm" onClick={() => {
                            leaveTypeFormik.resetForm();
                            setAddLeaveTypeModalOpen(true);
                        }}>
                            <Plus className="h-4 w-4 mr-1" /> Add Leave Type
                        </Button>
                        <Button variant="outline" onClick={() => setLeaveTypeModalOpen(false)}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <FormModal
                title="Add Leave Type"
                isOpen={addLeaveTypeModalOpen}
                onClose={() => {
                    setAddLeaveTypeModalOpen(false);
                    leaveTypeFormik.resetForm();
                }}
                loading={leaveTypeLoading}
                submitLabel="Create"
                progress={leaveTypeProgress}
            >
                <form onSubmit={leaveTypeFormik.handleSubmit} className="space-y-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="lt_name">Name *</Label>
                        <Input id="lt_name" {...leaveTypeFormik.getFieldProps('name')} placeholder="e.g. Sick Leave" />
                        {leaveTypeFormik.touched.name && leaveTypeFormik.errors.name && (
                            <p className="text-sm text-destructive">{leaveTypeFormik.errors.name}</p>
                        )}
                    </div>
                    <Button type="submit" disabled={leaveTypeFormik.isSubmitting} className="w-full">
                        {leaveTypeFormik.isSubmitting ? 'Creating...' : 'Create'}
                    </Button>
                </form>
            </FormModal>

            <Dialog open={!!deleteLeaveTypeItem} onOpenChange={(open: boolean) => !open && setDeleteLeaveTypeItem(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Leave Type</DialogTitle>
                    </DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to delete <strong>{deleteLeaveTypeItem?.name}</strong>?
                    </DialogDescription>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteLeaveTypeItem(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDeleteLeaveType} disabled={deleteLeaveTypeLoading}>
                            {deleteLeaveTypeLoading ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deleteItem} onOpenChange={(open: boolean) => !open && setDeleteItem(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Leave Request</DialogTitle>
                    </DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to delete this leave request for <strong>{deleteItem?.employee?.name}</strong>?
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
