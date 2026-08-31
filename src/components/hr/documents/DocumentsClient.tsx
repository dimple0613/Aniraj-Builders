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

interface EmployeeDocument {
    id: string;
    employee_id: string;
    document_name: string;
    file: string | null;
    expiry_date: string | null;
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

const documentValidationSchema = Yup.object({
    employee_id: Yup.string().required('Employee is required'),
    document_name: Yup.string().trim().required('Document name is required'),
    expiry_date: Yup.string().nullable(),
});

function isExpired(expiryDate: string | null): boolean {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
}

interface DocumentsClientProps {
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
}

export function DocumentsClient({ canCreate = true, canEdit = true, canDelete = true }: DocumentsClientProps) {
    const [data, setData] = useState<EmployeeDocument[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<EmployeeDocument | null>(null);
    const [deleteItem, setDeleteItem] = useState<EmployeeDocument | null>(null);
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
            employee_id: editingItem?.employee_id || '',
            document_name: editingItem?.document_name || '',
            expiry_date: toDateInputValue(editingItem?.expiry_date),
        },
        validationSchema: documentValidationSchema,
        validateOnChange: true,
        validateOnBlur: true,
        enableReinitialize: true,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            try {
                const payload = {
                    ...values,
                    expiry_date: values.expiry_date || null,
                };
                if (editingItem) {
                    await axios.put(`/api/hr/documents/${editingItem.id}`, payload);
                    toast.success('Document updated successfully');
                } else {
                    await axios.post('/api/hr/documents', payload);
                    toast.success('Document created successfully');
                }
                setModalOpen(false);
                setEditingItem(null);
                resetForm();
                fetchData(pagination.page);
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save document');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const progress = useMemo(() => {
        const fields = [formik.values.employee_id, formik.values.document_name, formik.values.expiry_date];
        const filled = fields.filter((v) => v && String(v).trim() !== '').length;
        return Math.round((filled / fields.length) * 100);
    }, [formik.values]);

    const fetchData = useCallback(async (page = 1, searchValue = search, pageLimit = limit) => {
        try {
            setLoading(true);
            const response = await axios.get('/api/hr/documents', {
                params: { page, limit: pageLimit, search: searchValue },
            });
            setData(response.data.data);
            setPagination(response.data.pagination);
        } catch {
            toast.error('Failed to fetch documents');
        } finally {
            setLoading(false);
        }
    }, [search, limit]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleEdit = (item: EmployeeDocument) => {
        setEditingItem(item);
        formik.resetForm({
            values: {
                employee_id: item.employee_id,
                document_name: item.document_name,
                expiry_date: toDateInputValue(item.expiry_date),
            },
        });
        setModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            const response = await axios.delete(`/api/hr/documents/${deleteItem.id}`);
            toast.success(response.data.message || 'Document deleted successfully');
            setDeleteItem(null);
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete document');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingItem(null);
        formik.resetForm({
            values: {
                employee_id: '',
                document_name: '',
                expiry_date: '',
            },
        });
        setModalOpen(true);
    };

    const columns: Column<EmployeeDocument>[] = [
        {
            header: 'Employee',
            accessorKey: 'employee',
            cell: (item) => item.employee?.name || '-',
        },
        {
            header: 'Document Name',
            accessorKey: 'document_name',
            sortable: true,
        },
        {
            header: 'Expiry Date',
            accessorKey: 'expiry_date',
            cell: (item) => formatDateDisplay(item.expiry_date),
        },
        {
            header: 'Status',
            accessorKey: 'status',
            cell: (item) => {
                const expired = isExpired(item.expiry_date);
                return (
                    <Badge
                        variant="outline"
                        className={expired
                            ? 'bg-red-100 text-red-800 hover:bg-red-100'
                            : 'bg-green-100 text-green-800 hover:bg-green-100'}
                    >
                        {expired ? 'EXPIRED' : 'ACTIVE'}
                    </Badge>
                );
            },
        },
    ];

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 p-2 md:p-6 w-full overflow-hidden">
            <div className="shrink-0">
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Employee Documents</h2>
                <p className="text-muted-foreground text-sm">Manage employee documents</p>
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
                searchPlaceholder="Search documents..."
                addLabel="Add Document"
            />

            <FormModal
                title={editingItem ? 'Edit Document' : 'Add Document'}
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
                        <Label htmlFor="doc_employee_id">Employee *</Label>
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

                    <div className="space-y-2">
                        <Label htmlFor="doc_document_name">Document Name *</Label>
                        <Input
                            id="doc_document_name"
                            {...formik.getFieldProps('document_name')}
                            placeholder="e.g., Passport, Aadhaar, Resume"
                        />
                        {formik.touched.document_name && formik.errors.document_name && (
                            <p className="text-sm text-destructive">{formik.errors.document_name}</p>
                        )}
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="doc_expiry_date">Expiry Date</Label>
                        <Input id="doc_expiry_date" type="date" {...formik.getFieldProps('expiry_date')} />
                    </div>

                    <Button type="submit" disabled={formik.isSubmitting} className="w-full">
                        {formik.isSubmitting ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                    </Button>
                </form>
            </FormModal>

            <Dialog open={!!deleteItem} onOpenChange={(open: boolean) => !open && setDeleteItem(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Delete Document</DialogTitle></DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to delete <strong>{deleteItem?.document_name}</strong>?
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
