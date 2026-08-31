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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

import { Column, DataTable, FormModal } from '../common';
import { UnitManager } from '../common/UnitManager';
import { Button } from '../ui/button';
import { formatIndianCurrency } from '@/lib/financial-year';
import { Labels } from '../ui/labels';

interface Subcontractor {
    id: string;
    name: string;
    unit_id?: string | null;
    unit?: { id: string; unit_name: string } | null;
    currentRate: string;
    createdAt: string;
    updatedAt: string;
    rates: any;
}

interface Unit {
    id: string;
    unit_name: string;
}

interface SubcontractorFormValues {
    name: string;
    rate?: number;
    updateRate: boolean;
    newRate?: number;
    unit_id: string;
}

const createSubcontractorSchema = Yup.object({
    name: Yup.string()
        .required('Name is required')
        .max(255, 'Name must be less than 255 characters'),
    rate: Yup.number()
        .required('Rate is required')
        .positive('Rate must be greater than 0')
        .typeError('Rate must be a number'),
});

const updateSubcontractorSchema = Yup.object({
    name: Yup.string()
        .required('Name is required')
        .max(255, 'Name must be less than 255 characters'),
    updateRate: Yup.boolean(),
    newRate: Yup.number()
        .when('updateRate', {
            is: true,
            then: (schema) => schema
                .required('New rate is required when updating rate')
                .positive('New rate must be greater than 0')
                .typeError('New rate must be a number'),
            otherwise: (schema) => schema.notRequired(),
        }),
});

export default function SubcontractorManagementClient({
    canCreate,
    canEdit,
    canDelete,
}: {
    canCreate: boolean;
    canEdit: boolean;
    canDelete: boolean;
}) {
    const [data, setData] = useState<Subcontractor[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [limit, setLimit] = useState(10);

    const [modalOpen, setModalOpen] = useState(false);
    const [editingSubcontractor, setEditingSubcontractor] = useState<Subcontractor | null>(null);
    const [formLoading, setFormLoading] = useState(false);

    const [deleteSubcontractor, setDeleteSubcontractor] = useState<Subcontractor | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const [units, setUnits] = useState<Unit[]>([]);

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

            const response = await axios.get('/api/subcontractor-management', {
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
            toast.error('Failed to fetch subcontractors');
        } finally {
            setLoading(false);
        }
    }, [search, sortField, sortOrder, limit]);

    const fetchUnits = useCallback(async () => {
        try {
            const response = await axios.get('/api/units');
            setUnits(response.data.data || []);
        } catch {
            toast.error('Failed to fetch units');
        }
    }, []);

    useEffect(() => {
        fetchUnits();
    }, [fetchUnits]);

    useEffect(() => {
        fetchData(1);
    }, [search, sortField, sortOrder, limit]);

    const createFormik = useFormik<SubcontractorFormValues>({
        initialValues: {
            name: '',
            rate: undefined,
            updateRate: false,
            newRate: undefined,
            unit_id: '',
        },
        validationSchema: createSubcontractorSchema,
        enableReinitialize: true,
        onSubmit: async (values) => {
            try {
                setFormLoading(true);
                await axios.post('/api/subcontractor-management', {
                    name: values.name,
                    rate: values.rate,
                    unit_id: values.unit_id || null,
                });
                toast.success('Subcontractor created successfully');
                setModalOpen(false);
                createFormik.resetForm();
                fetchData(pagination.page);
            } catch (error: any) {
                toast.error(error.response?.data?.message || 'Failed to create subcontractor');
            } finally {
                setFormLoading(false);
            }
        },
    });

    const formProgress = useMemo(() => {
        if (editingSubcontractor) return undefined;
        const values = createFormik.values;
        let filled = 0;
        let total = 0;
        const fields = ['name', 'rate', 'unit_id'];
        fields.forEach(field => {
            total++;
            const val = (values as any)[field];
            if (val !== undefined && val !== '' && val !== null) filled++;
        });
        return total > 0 ? Math.round((filled / total) * 100) : 0;
    }, [createFormik.values, editingSubcontractor]);

    const updateFormik = useFormik<SubcontractorFormValues>({
        initialValues: {
            name: '',
            updateRate: false,
            newRate: undefined,
            unit_id: '',
        },
        validationSchema: updateSubcontractorSchema,
        enableReinitialize: true,
        onSubmit: async (values) => {
            if (!editingSubcontractor) return;

            try {
                setFormLoading(true);
                await axios.put('/api/subcontractor-management', {
                    id: editingSubcontractor.id,
                    name: values.name,
                    updateRate: values.updateRate,
                    newRate: values.newRate,
                    unit_id: values.unit_id || null,
                });
                toast.success('Subcontractor updated successfully');
                setModalOpen(false);
                setEditingSubcontractor(null);
                updateFormik.resetForm();
                fetchData(pagination.page);
            } catch (error: any) {
                toast.error(error.response?.data?.message || 'Failed to update subcontractor');
            } finally {
                setFormLoading(false);
            }
        },
    });

    const handleAdd = () => {
        setEditingSubcontractor(null);
        createFormik.resetForm();
        setModalOpen(true);
    };

    const handleEdit = (subcontractor: Subcontractor) => {
        setEditingSubcontractor(subcontractor);
        updateFormik.setValues({
            name: subcontractor.name,
            updateRate: false,
            newRate: undefined,
            unit_id: (subcontractor as any).unit_id || '',
        });
        setModalOpen(true);
    };

    const handleDelete = (subcontractor: Subcontractor) => {
        setDeleteSubcontractor(subcontractor);
    };

    const confirmDelete = async () => {
        if (!deleteSubcontractor) return;

        try {
            setDeleteLoading(true);
            await axios.delete('/api/subcontractor-management', {
                data: { id: deleteSubcontractor.id },
            });
            toast.success('Subcontractor deleted successfully');
            setDeleteSubcontractor(null);
            fetchData(pagination.page);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete subcontractor');
        } finally {
            setDeleteLoading(false);
        }
    };


    const handleCloseModal = () => {
        setModalOpen(false);
        setEditingSubcontractor(null);
        createFormik.resetForm();
        updateFormik.resetForm();
    };

    const getCurrentRate = (rateHistory: any[]) => {
        const current = rateHistory.find(item => item.expiry_date === null);
        return current ? current.rate : '0';
    };

    const columns = useMemo<Column<Subcontractor>[]>(() => {
        return [
            {
                header: 'Name',
                accessorKey: 'name' as keyof Subcontractor,
                sortable: true,
                cell: (subcontractor) => (
                    <span className="font-medium">{subcontractor.name}</span>
                ),
            },
            {
                header: 'Rate',
                accessorKey: 'rateHistory',
                cell: (subcontractor) => {
                    const currentRate = getCurrentRate(subcontractor?.rates || []);

                    return (
                        <span className="font-medium text-green-600">
                            ₹{formatIndianCurrency(Number(currentRate))}
                        </span>
                    );
                },
            },
            {
                header: 'Unit',
                accessorKey: 'unit_id',
                cell: (subcontractor) => (
                    <span>{subcontractor.unit?.unit_name || '-'}</span>
                ),
            }
        ];
    }, []);

    return (
        <div className="flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Subcontractor
                    </h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <UnitManager onSuccess={fetchUnits} />
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
                searchPlaceholder="Search subcontractors..."
            />

            <FormModal
                title={editingSubcontractor ? 'Edit Subcontractor' : 'Add Subcontractor'}
                isOpen={modalOpen}
                onClose={handleCloseModal}
                loading={formLoading}
                progress={!editingSubcontractor ? formProgress : undefined}
            >
                {editingSubcontractor ? (
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
                                    placeholder="Enter subcontractor name"
                                />
                                {updateFormik.touched.name && updateFormik.errors.name && (
                                    <p className="text-sm text-destructive">{updateFormik.errors.name}</p>
                                )}
                            </div>
                        </div>
                        <div className='grid grid-cols-1 md:grid-cols-1 gap-4'>
                            <div className="space-y-2 relative">
                                <Labels htmlFor="updateRate" className="font-medium cursor-pointer flex flex-wrap">
                                    <Checkbox
                                        id="updateRate"
                                        checked={updateFormik.values.updateRate}
                                        onCheckedChange={(checked) => {
                                            updateFormik.setFieldValue('updateRate', checked);
                                            if (!checked) {
                                                updateFormik.setFieldValue('newRate', undefined);
                                            }
                                        }}
                                        className='mr-[8px]'
                                    />

                                    Update Rate
                                </Labels>
                            </div>
                        </div>

                        {updateFormik.values.updateRate && (

                            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                                <div className="space-y-2 relative">
                                    <Label htmlFor="newRate">New Rate *</Label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                            ₹
                                        </span>
                                        <Input
                                            id="newRate"
                                            name="newRate"
                                            type="number"
                                            step="0.01"
                                            min="0"
                                            className="pl-7"
                                            value={updateFormik.values.newRate || ''}
                                            onChange={updateFormik.handleChange}
                                            onBlur={updateFormik.handleBlur}
                                            placeholder="Enter new rate"
                                        />
                                    </div>
                                    {updateFormik.touched.newRate && updateFormik.errors.newRate && (
                                        <p className="text-sm text-destructive">{updateFormik.errors.newRate}</p>
                                    )}
                                </div>
                            </div>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                            <div className="space-y-2 relative">
                                <Label htmlFor="edit-unit">Unit</Label>
                                <Select
                                    value={updateFormik.values.unit_id}
                                    onValueChange={(val) => updateFormik.setFieldValue('unit_id', val)}
                                >
                                    <SelectTrigger id="edit-unit">
                                        <SelectValue placeholder="Select unit" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {units.map((unit) => (
                                            <SelectItem key={unit.id} value={unit.id}>
                                                {unit.unit_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        {editingSubcontractor?.rates?.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {editingSubcontractor.rates.map((item: any, index: number) => {
                                    const isCurrent = item.expiry_date === null;

                                    return (
                                        <span
                                            key={index}
                                            className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium
                        ${isCurrent
                                                    ? 'bg-green-100 text-green-700 border-green-300'
                                                    : 'bg-muted text-gray-600'
                                                }`}
                                        >
                                            ₹{formatIndianCurrency(Number(item.rate))}

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
                            {formLoading ? 'Saving...' : 'Update Subcontractor'}
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
                                    placeholder="Enter subcontractor name"
                                />
                                {createFormik.touched.name && createFormik.errors.name && (
                                    <p className="text-sm text-destructive">{createFormik.errors.name}</p>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                            <div className="space-y-2 relative">
                                <Label htmlFor="rate">Rate *</Label>
                                <div className="relative">
                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                        ₹
                                    </span>
                                    <Input
                                        id="rate"
                                        name="rate"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        className="pl-7"
                                        value={createFormik.values.rate || ''}
                                        onChange={createFormik.handleChange}
                                        onBlur={createFormik.handleBlur}
                                        placeholder="Enter rate"
                                    />
                                </div>
                                {createFormik.touched.rate && createFormik.errors.rate && (
                                    <p className="text-sm text-destructive">{createFormik.errors.rate}</p>
                                )}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                            <div className="space-y-2 relative">
                                <Label htmlFor="create-unit">Unit</Label>
                                <Select
                                    value={createFormik.values.unit_id}
                                    onValueChange={(val) => createFormik.setFieldValue('unit_id', val)}
                                >
                                    <SelectTrigger id="create-unit">
                                        <SelectValue placeholder="Select unit" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {units.map((unit) => (
                                            <SelectItem key={unit.id} value={unit.id}>
                                                {unit.unit_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <Button
                            type="submit"
                            disabled={!createFormik.isValid || !createFormik.dirty}
                            className='w-full'
                        >
                            {formLoading ? 'Creating...' : 'Create Subcontractor'}
                        </Button>
                    </form>
                )}
            </FormModal>

            <Dialog
                open={!!deleteSubcontractor}
                onOpenChange={(open) => {
                    if (!open) setDeleteSubcontractor(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                    </DialogHeader>

                    <DialogDescription className="py-4">
                        Are you sure you want to delete{' '}
                        <strong>{deleteSubcontractor?.name}</strong>?
                        This action cannot be undone and will delete all rate history.
                    </DialogDescription>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteSubcontractor(null)}
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
