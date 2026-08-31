'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

interface Department {
    id: string;
    name: string;
    code: string | null;
    manager_name: string | null;
    phone: string | null;
    email: string | null;
    description: string | null;
    status: string;
}

const validationSchema = Yup.object({
    name: Yup.string().trim().required('Name is required').max(100),
    code: Yup.string().nullable().max(50),
    manager_name: Yup.string().nullable().max(100),
    phone: Yup.string().nullable().max(20),
    email: Yup.string().nullable().email('Invalid email format'),
    description: Yup.string().nullable(),
    status: Yup.string().oneOf(['ACTIVE', 'INACTIVE']),
});

interface DepartmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function DepartmentModal({ isOpen, onClose, onSuccess }: DepartmentModalProps) {
    const [data, setData] = useState<Department[]>([]);
    const [loading, setLoading] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Department | null>(null);
    const [deleteItem, setDeleteItem] = useState<Department | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const fetchData = useCallback(async () => {
        if (!isOpen) return;
        try {
            setLoading(true);
            const response = await axios.get('/api/departments', { params: { page: 1, limit: 100 } });
            setData(response.data.data);
        } catch {
            toast.error('Failed to fetch departments');
        } finally {
            setLoading(false);
        }
    }, [isOpen]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const formik = useFormik({
        initialValues: {
            name: editingItem?.name || '',
            code: editingItem?.code || '',
            manager_name: editingItem?.manager_name || '',
            phone: editingItem?.phone || '',
            email: editingItem?.email || '',
            description: editingItem?.description || '',
            status: editingItem?.status || 'ACTIVE',
        },
        validationSchema,
        enableReinitialize: true,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            try {
                const payload = {
                    ...values,
                    code: values.code || null,
                    manager_name: values.manager_name || null,
                    phone: values.phone || null,
                    email: values.email || null,
                    description: values.description || null,
                };
                if (editingItem) {
                    await axios.put(`/api/departments/${editingItem.id}`, payload);
                    toast.success('Department updated successfully');
                } else {
                    await axios.post('/api/departments', payload);
                    toast.success('Department created successfully');
                }
                setFormOpen(false);
                setEditingItem(null);
                resetForm();
                fetchData();
                onSuccess?.();
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save department');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const handleAdd = () => {
        setEditingItem(null);
        formik.resetForm({ values: { name: '', code: '', manager_name: '', phone: '', email: '', description: '', status: 'ACTIVE' } });
        setFormOpen(true);
    };

    const handleEdit = (item: Department) => {
        setEditingItem(item);
        formik.resetForm({
            values: {
                name: item.name,
                code: item.code || '',
                manager_name: item.manager_name || '',
                phone: item.phone || '',
                email: item.email || '',
                description: item.description || '',
                status: item.status || 'ACTIVE',
            },
        });
        setFormOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            const response = await axios.delete(`/api/departments/${deleteItem.id}`);
            toast.success(response.data.message || 'Department deleted successfully');
            setDeleteItem(null);
            fetchData();
            onSuccess?.();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete department');
        } finally {
            setDeleteLoading(false);
        }
    };

    const progress = useMemo(() => {
        const fields = [formik.values.name, formik.values.code, formik.values.manager_name, formik.values.phone, formik.values.email, formik.values.description, formik.values.status];
        const filled = fields.filter((v) => v && String(v).trim() !== '').length;
        return Math.round((filled / fields.length) * 100);
    }, [formik.values]);

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col overflow-hidden">
                    <DialogHeader className="shrink-0">
                        <DialogTitle>Departments</DialogTitle>
                        <DialogDescription>Manage company departments.</DialogDescription>
                    </DialogHeader>

                    <div className="overflow-y-auto min-h-0 flex-1 -mx-6 px-6">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : data.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">No departments found.</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Code</TableHead>
                                        <TableHead>Manager</TableHead>
                                        <TableHead className="w-[70px]">Status</TableHead>
                                        <TableHead className="w-[80px] text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.name}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{item.code || '-'}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{item.manager_name || '-'}</TableCell>
                                            <TableCell>
                                                <Badge variant={item.status === 'ACTIVE' ? 'default' : 'destructive'} className={item.status === 'ACTIVE' ? 'bg-green-600' : ''}>
                                                    {item.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(item)}>
                                                        <Pencil className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteItem(item)}>
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
                        <Button variant="outline" size="sm" onClick={handleAdd}>
                            <Plus className="h-4 w-4 mr-1" /> Add Department
                        </Button>
                        <Button variant="outline" onClick={onClose}>Close</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={formOpen} onOpenChange={(open) => !open && setFormOpen(false)}>
                <DialogContent className="sm:max-w-[500px]">
                    <div className="-mx-6 -mt-6">
                        <div className="w-full h-1.5 bg-red-500 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-600 transition-all duration-300" style={{ width: `${progress}%` }} />
                        </div>
                    </div>
                    <DialogHeader>
                        <DialogTitle>{editingItem ? 'Edit Department' : 'Add Department'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={formik.handleSubmit} className="space-y-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="dm-name">Name *</Label>
                            <Input id="dm-name" {...formik.getFieldProps('name')} onChange={(e) => formik.setFieldValue('name', e.target.value.toUpperCase())} className="uppercase" placeholder="e.g., Human Resources" />
                            {formik.touched.name && formik.errors.name && (
                                <p className="text-sm text-destructive">{formik.errors.name}</p>
                            )}
                        </div>
                        <div className="space-y-2 relative">
                            <Label htmlFor="dm-code">Code</Label>
                            <Input id="dm-code" {...formik.getFieldProps('code')} onChange={(e) => formik.setFieldValue('code', e.target.value.toUpperCase())} className="uppercase" placeholder="e.g., HR" />
                        </div> 
                        <div className="space-y-2 relative">
                            <Label htmlFor="dm-manager">Manager</Label>
                            <Input id="dm-manager" {...formik.getFieldProps('manager_name')} onChange={(e) => formik.setFieldValue('manager_name', e.target.value.toUpperCase())} className="uppercase" placeholder="Manager name" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2 relative">
                                <Label htmlFor="dm-phone">Phone</Label>
                                <Input id="dm-phone" {...formik.getFieldProps('phone')} onChange={(e) => formik.setFieldValue('phone', e.target.value.toUpperCase())} className="uppercase" placeholder="Phone number" />
                            </div>
                            <div className="space-y-2 relative">
                                <Label htmlFor="dm-email">Email</Label>
                                <Input id="dm-email" {...formik.getFieldProps('email')} type="email" placeholder="Email" />
                            </div>
                        </div>
                        <div className="space-y-2 relative">
                            <Label htmlFor="dm-description">Description</Label>
                            <Input id="dm-description" {...formik.getFieldProps('description')} onChange={(e) => formik.setFieldValue('description', e.target.value.toUpperCase())} className="uppercase" placeholder="Description" />
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="dm-status">Status</Label>
                            <Select value={formik.values.status} onValueChange={(value) => formik.setFieldValue('status', value)}>
                                <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ACTIVE">Active</SelectItem>
                                    <SelectItem value="INACTIVE">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
                            <Button type="submit" disabled={formik.isSubmitting}>
                                {formik.isSubmitting ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!deleteItem} onOpenChange={(open: boolean) => !open && setDeleteItem(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Delete Department</DialogTitle></DialogHeader>
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
        </>
    );
}
