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
}

interface Designation {
    id: string;
    name: string;
    department_id: string | null;
    description: string | null;
    status: string;
    department?: { id: string; name: string } | null;
}

const validationSchema = Yup.object({
    name: Yup.string().trim().required('Name is required').max(100),
    department_id: Yup.string().nullable(),
    description: Yup.string().nullable(),
    status: Yup.string().oneOf(['ACTIVE', 'INACTIVE']),
});

interface DesignationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess?: () => void;
}

export function DesignationModal({ isOpen, onClose, onSuccess }: DesignationModalProps) {
    const [data, setData] = useState<Designation[]>([]);
    const [loading, setLoading] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Designation | null>(null);
    const [deleteItem, setDeleteItem] = useState<Designation | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [departments, setDepartments] = useState<Department[]>([]);

    useEffect(() => {
        if (!isOpen) return;
        axios.get('/api/departments', { params: { limit: 100 } })
            .then((res) => setDepartments(res.data.data))
            .catch(() => {});
    }, [isOpen]);

    const fetchData = useCallback(async () => {
        if (!isOpen) return;
        try {
            setLoading(true);
            const response = await axios.get('/api/hr/designations', { params: { page: 1, limit: 100 } });
            setData(response.data.data);
        } catch {
            toast.error('Failed to fetch designations');
        } finally {
            setLoading(false);
        }
    }, [isOpen]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const formik = useFormik({
        initialValues: {
            name: editingItem?.name || '',
            department_id: editingItem?.department_id || '',
            description: editingItem?.description || '',
            status: editingItem?.status || 'ACTIVE',
        },
        validationSchema,
        enableReinitialize: true,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            try {
                const payload = {
                    ...values,
                    department_id: values.department_id || null,
                    description: values.description || null,
                };
                if (editingItem) {
                    await axios.put(`/api/hr/designations/${editingItem.id}`, payload);
                    toast.success('Designation updated successfully');
                } else {
                    await axios.post('/api/hr/designations', payload);
                    toast.success('Designation created successfully');
                }
                setFormOpen(false);
                setEditingItem(null);
                resetForm();
                fetchData();
                onSuccess?.();
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save designation');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const handleAdd = () => {
        setEditingItem(null);
        formik.resetForm({ values: { name: '', department_id: '', description: '', status: 'ACTIVE' } });
        setFormOpen(true);
    };

    const handleEdit = (item: Designation) => {
        setEditingItem(item);
        formik.resetForm({
            values: {
                name: item.name,
                department_id: item.department_id || '',
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
            const response = await axios.delete(`/api/hr/designations/${deleteItem.id}`);
            toast.success(response.data.message || 'Designation deleted successfully');
            setDeleteItem(null);
            fetchData();
            onSuccess?.();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete designation');
        } finally {
            setDeleteLoading(false);
        }
    };

    const progress = useMemo(() => {
        const fields = [formik.values.name, formik.values.department_id, formik.values.description, formik.values.status];
        const filled = fields.filter((v) => v && String(v).trim() !== '').length;
        return Math.round((filled / fields.length) * 100);
    }, [formik.values]);

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="sm:max-w-[700px] max-h-[85vh] flex flex-col overflow-hidden">
                    <DialogHeader className="shrink-0">
                        <DialogTitle>Designations</DialogTitle>
                        <DialogDescription>Manage job designations.</DialogDescription>
                    </DialogHeader>

                    <div className="overflow-y-auto min-h-0 flex-1 -mx-6 px-6">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : data.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">No designations found.</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Department</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="w-[70px]">Status</TableHead>
                                        <TableHead className="w-[80px] text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.name}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{item.department?.name || '-'}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{item.description || '-'}</TableCell>
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
                            <Plus className="h-4 w-4 mr-1" /> Add Designation
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
                        <DialogTitle>{editingItem ? 'Edit Designation' : 'Add Designation'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={formik.handleSubmit} className="space-y-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="desig-name">Name *</Label>
                            <Input id="desig-name" {...formik.getFieldProps('name')} onChange={(e) => formik.setFieldValue('name', e.target.value.toUpperCase())} className="uppercase" placeholder="e.g., Software Engineer" />
                            {formik.touched.name && formik.errors.name && (
                                <p className="text-sm text-destructive">{formik.errors.name}</p>
                            )}
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="desig-dept">Department</Label>
                            <Select value={formik.values.department_id || undefined} onValueChange={(value) => formik.setFieldValue('department_id', value)}>
                                <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                                <SelectContent>
                                    {departments.map((dept) => (
                                        <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        </div>
                        <div className="space-y-2 relative">
                            <Label htmlFor="desig-desc">Description</Label>
                            <Input id="desig-desc" {...formik.getFieldProps('description')} placeholder="Description" />
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="desig-status">Status</Label>
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
                    <DialogHeader><DialogTitle>Delete Designation</DialogTitle></DialogHeader>
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
