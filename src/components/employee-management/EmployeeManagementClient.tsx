'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

import { Column, DataTable, FormModal } from '../common';
import { Button } from '../ui/button';
import { formatIndianCurrency } from '@/lib/financial-year';
import { Labels } from '../ui/labels';

interface Employee {
    id: string;
    name: string;
    currentSalary: string;
    createdAt: string;
    updatedAt: string;
    prices: any;
}

interface EmployeeFormValues {
    name: string;
    salary?: number;
    updateSalary: boolean;
    newSalary?: number;
}

const createEmployeeSchema = Yup.object({
    name: Yup.string()
        .required('Name is required')
        .max(255, 'Name must be less than 255 characters'),
    salary: Yup.number()
        .required('Salary is required')
        .positive('Salary must be greater than 0')
        .typeError('Salary must be a number'),
});

const updateEmployeeSchema = Yup.object({
    name: Yup.string()
        .required('Name is required')
        .max(255, 'Name must be less than 255 characters'),
    updateSalary: Yup.boolean(),
    newSalary: Yup.number()
        .when('updateSalary', {
            is: true,
            then: (schema) => schema
                .required('New salary is required when updating salary')
                .positive('New salary must be greater than 0')
                .typeError('New salary must be a number'),
            otherwise: (schema) => schema.notRequired(),
        }),
});

export default function EmployeeManagementClient({
    canCreate,
    canEdit,
    canDelete,
}: {
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
}) {
    const [data, setData] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [limit, setLimit] = useState(10);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
    const [formLoading, setFormLoading] = useState(false);

    const [deleteEmployee, setDeleteEmployee] = useState<Employee | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    const [pagination, setPagination] = useState({
        page: 1,
        totalPages: 1,
    });

    const fetchData = useCallback(async (
        page = 1,
        searchValue = search,
        sort = sortField,
        order = sortOrder,
        pageLimit = limit
    ) => {
        try {
            setLoading(true);

            const response = await axios.get('/api/employee-management', {
                params: {
                    page,
                    limit: pageLimit,
                    search: searchValue,
                    sortField: sort,
                    sortOrder: order,
                },
            });

            setData(response.data.data || []);

            setPagination({
                page: response.data.pagination?.page || 1,
                totalPages: response.data.pagination?.pages || 1,
            });
        } catch (error) {
            toast.error('Failed to fetch employees');
        } finally {
            setLoading(false);
        }
    }, [search, sortField, sortOrder, limit]);

    useEffect(() => {
        fetchData(1);
    }, [search, sortField, sortOrder, limit]);

    const createFormik = useFormik<EmployeeFormValues>({
        initialValues: {
            name: '',
            salary: undefined,
            updateSalary: false,
            newSalary: undefined,
        },
        validationSchema: createEmployeeSchema,
        enableReinitialize: true,
        onSubmit: async (values) => {
            try {
                setFormLoading(true);
                await axios.post('/api/employee-management', {
                    name: values.name,
                    salary: values.salary,
                });
                toast.success('Employee created successfully');
                setModalOpen(false);
                createFormik.resetForm();
                fetchData(pagination.page);
            } catch (error: any) {
                toast.error(error.response?.data?.message || 'Failed to create employee');
            } finally {
                setFormLoading(false);
            }
        },
    });

    const updateFormik = useFormik<EmployeeFormValues>({
        initialValues: {
            name: '',
            updateSalary: false,
            newSalary: undefined,
        },
        validationSchema: updateEmployeeSchema,
        enableReinitialize: true,
        onSubmit: async (values) => {
            if (!editingEmployee) return;

            try {
                setFormLoading(true);
                await axios.put('/api/employee-management', {
                    id: editingEmployee.id,
                    name: values.name,
                    updateSalary: values.updateSalary,
                    newSalary: values.newSalary,
                });
                toast.success('Employee updated successfully');
                setModalOpen(false);
                setEditingEmployee(null);
                updateFormik.resetForm();
                fetchData(pagination.page);
            } catch (error: any) {
                toast.error(error.response?.data?.message || 'Failed to update employee');
            } finally {
                setFormLoading(false);
            }
        },
    });

    const handleAdd = () => {
        setEditingEmployee(null);
        createFormik.resetForm();
        setModalOpen(true);
    };

    const handleEdit = (employee: Employee) => {
        setEditingEmployee(employee);
        updateFormik.setValues({
            name: employee.name,
            updateSalary: false,
            newSalary: undefined,
        });
        setModalOpen(true);
    };

    const handleDelete = (employee: Employee) => {
        setDeleteEmployee(employee);
    };

    const confirmDelete = async () => {
        if (!deleteEmployee) return;

        try {
            setDeleteLoading(true);
            await axios.delete('/api/employee-management', {
                data: { id: deleteEmployee.id },
            });
            toast.success('Employee deleted successfully');
            setDeleteEmployee(null);
            fetchData(pagination.page);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete employee');
        } finally {
            setDeleteLoading(false);
        }
    };


    useEffect(() => {
        if (!modalOpen || !editingEmployee) {
            if (!modalOpen) setProgress(0);
            return;
        }
        let filled = 0;
        let total = 2;
        if (updateFormik.values.name && updateFormik.values.name.trim() !== '') filled++;
        if (updateFormik.values.updateSalary && (updateFormik.values.newSalary ?? 0) > 0) filled++;
        if (!updateFormik.values.updateSalary) { total--; filled++; }
        setProgress(total > 0 ? Math.round((filled / total) * 100) : 0);
    }, [updateFormik.values, modalOpen, editingEmployee]);

    useEffect(() => {
        if (!modalOpen || editingEmployee) {
            if (!modalOpen) setProgress(0);
            return;
        }
        let filled = 0;
        let total = 2;
        if (createFormik.values.name && createFormik.values.name.trim() !== '') filled++;
        if ((createFormik.values.salary ?? 0) > 0) filled++;
        setProgress(total > 0 ? Math.round((filled / total) * 100) : 0);
    }, [createFormik.values, modalOpen, editingEmployee]);

    const handleCloseModal = () => {
        setModalOpen(false);
        setEditingEmployee(null);
        createFormik.resetForm();
        updateFormik.resetForm();
    };
    const getCurrentSalary = (salaryHistory: any[]) => {
        const current = salaryHistory.find(item => item.expiry_date === null);
        return current ? current.price : '0';
    };
    const columns = useMemo<Column<Employee>[]>(() => {
        return [
            {
                header: 'Name',
                accessorKey: 'name' as keyof Employee,
                sortable: true,
                cell: (employee) => (
                    <span className="font-medium">{employee.name}</span>
                ),
            },
            {
                header: 'Salary',
                accessorKey: 'salaryHistory',
                cell: (employee) => {
                    const currentSalary = getCurrentSalary(employee?.prices || []);

                    return (
                        <span className="font-medium text-green-600">
                            ₹{formatIndianCurrency(Number(currentSalary))}
                        </span>
                    );
                },
            }
        ];
    }, []);

    return (
        <div className="flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Employee
                    </h2>
                </div>
            </div>

            <DataTable
                data={data}
                columns={columns}
                loading={loading}
                pagination={pagination}
                onPageChange={(page) => fetchData(page)}
                onSearch={(value) => setSearch(value)}
                onSortChange={(field, order) => {
                    setSortField(field);
                    setSortOrder(order);
                }}
                onLimitChange={(newLimit) => setLimit(newLimit)}
                onAdd={canCreate ? handleAdd : undefined}
                onEdit={canEdit ? handleEdit : undefined}
                onDelete={canDelete ? handleDelete : undefined}
                searchPlaceholder="Search employees..."
            />

            <FormModal
                title={editingEmployee ? 'Edit Employee' : 'Add Employee'}
                isOpen={modalOpen}
                onClose={handleCloseModal}
                loading={formLoading}
                progress={progress}
            >
                {editingEmployee ? (
                    <form onSubmit={updateFormik.handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                            <div className="space-y-2 relative">
                                <Label htmlFor="name">Name *</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    value={updateFormik.values.name}
                                    onChange={updateFormik.handleChange}
                                    onBlur={updateFormik.handleBlur}
                                    placeholder="Enter employee name"
                                />
                                {updateFormik.touched.name && updateFormik.errors.name && (
                                    <p className="text-sm text-destructive">{updateFormik.errors.name}</p>
                                )}
                            </div>
                        </div>
                        <div className='grid grid-cols-1 md:grid-cols-1 gap-4'>
                            <div className="space-y-2 relative">
                                <Labels htmlFor="updateSalary" className="font-medium cursor-pointer flex flex-wrap">
                                    <Checkbox
                                        id="updateSalary"
                                        checked={updateFormik.values.updateSalary}
                                        onCheckedChange={(checked) => {
                                            updateFormik.setFieldValue('updateSalary', checked);
                                            if (!checked) {
                                                updateFormik.setFieldValue('newSalary', undefined);
                                            }
                                        }}
                                        className='mr-[8px]'
                                    />

                                    Update Salary
                                </Labels>
                            </div>
                        </div>

                        {updateFormik.values.updateSalary && (

                            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                                <div className="space-y-2 relative">
                                    <Label htmlFor="newSalary">New Salary *</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                            ₹
                                        </span>
                                        <Input
                                            id="newSalary"
                                            name="newSalary"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="pl-7"
                                            value={updateFormik.values.newSalary || ''}
                                            onChange={updateFormik.handleChange}
                                            onBlur={updateFormik.handleBlur}
                                            placeholder="Enter new salary"
                                        />
                                    </div>
                                    {updateFormik.touched.newSalary && updateFormik.errors.newSalary && (
                                        <p className="text-sm text-destructive">{updateFormik.errors.newSalary}</p>
                                    )}
                                </div>
                            </div>
                        )}
                        {editingEmployee?.prices?.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {editingEmployee.prices.map((item: any, index: number) => {
                                    const isCurrent = item.expiry_date === null;

                                    return (
                                        <span
                                            key={index}
                                            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium
                        ${isCurrent
                                                    ? 'bg-green-100 text-green-700 border-green-300'  // ✅ highlight current
                                                    : 'bg-muted text-gray-600'
                                                }`}
                                        >
                                            ₹{formatIndianCurrency(Number(item.price))}

                                            {isCurrent && (
                                                <span className="ml-1 text-[10px] font-semibold">(Current)</span>
                                            )}
                                        </span>
                                    );
                                })}
                            </div>
                        )}
                        <Button
                            type="submit"
                            disabled={!updateFormik.isValid || !updateFormik.dirty}
                            className="w-full"
                        >
                            {formLoading ? 'Saving...' : 'Update Employee'}
                        </Button>
                    </form>
                ) : (
                    <form onSubmit={createFormik.handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                            <div className="space-y-2 relative">
                                <Label htmlFor="name">Name *</Label>
                                <Input
                                    id="name"
                                    name="name"
                                    value={createFormik.values.name}
                                    onChange={createFormik.handleChange}
                                    onBlur={createFormik.handleBlur}
                                    placeholder="Enter employee name"
                                />
                                {createFormik.touched.name && createFormik.errors.name && (
                                    <p className="text-sm text-destructive">{createFormik.errors.name}</p>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                            <div className="space-y-2 relative">
                                <Label htmlFor="salary">Salary *</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                        ₹
                                    </span>
                                    <Input
                                        id="salary"
                                        name="salary"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="pl-7"
                                        value={createFormik.values.salary || ''}
                                        onChange={createFormik.handleChange}
                                        onBlur={createFormik.handleBlur}
                                        placeholder="Enter salary"
                                    />
                                </div>
                                {createFormik.touched.salary && createFormik.errors.salary && (
                                    <p className="text-sm text-destructive">{createFormik.errors.salary}</p>
                                )}
                            </div>
                        </div>
                        <Button
                            type="submit"
                            disabled={!createFormik.isValid || !createFormik.dirty}
                            className='w-full'
                        >
                            {formLoading ? 'Creating...' : 'Create Employee'}
                        </Button>
                    </form>
                )}
            </FormModal>

            <Dialog
                open={!!deleteEmployee}
                onOpenChange={(open) => {
                    if (!open) setDeleteEmployee(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                    </DialogHeader>

                    <DialogDescription className="py-4">
                        Are you sure you want to delete{' '}
                        <strong>{deleteEmployee?.name}</strong>?
                        This action cannot be undone and will delete all salary history.
                    </DialogDescription>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteEmployee(null)}
                            disabled={deleteLoading}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDelete}
                            disabled={deleteLoading}
                        >
                            {deleteLoading ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
