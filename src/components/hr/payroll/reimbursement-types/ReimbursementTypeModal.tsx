'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react';

interface ReimbursementType {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
    createdAt: string;
    updatedAt: string;
}

const validationSchema = Yup.object({
    name: Yup.string().trim().required('Name is required').max(100, 'Name must not exceed 100 characters'),
    description: Yup.string().nullable(),
    is_active: Yup.boolean(),
});

interface ReimbursementTypeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onTypesChanged?: () => void;
}

export function ReimbursementTypeModal({ isOpen, onClose, onTypesChanged }: ReimbursementTypeModalProps) {
    const [data, setData] = useState<ReimbursementType[]>([]);
    const [loading, setLoading] = useState(false);
    const [formOpen, setFormOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ReimbursementType | null>(null);
    const [deleteItem, setDeleteItem] = useState<ReimbursementType | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const fetchData = useCallback(async () => {
        if (!isOpen) return;
        try {
            setLoading(true);
            const response = await axios.get('/api/hr/reimbursement-types', {
                params: { page: 1, limit: 100 },
            });
            setData(response.data.data);
        } catch {
            toast.error('Failed to fetch reimbursement types');
        } finally {
            setLoading(false);
        }
    }, [isOpen]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const formik = useFormik({
        initialValues: { name: editingItem?.name || '', description: editingItem?.description || '', is_active: editingItem?.is_active ?? true },
        validationSchema,
        validateOnChange: true,
        validateOnBlur: true,
        enableReinitialize: true,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            try {
                const payload = { ...values, description: values.description || null };
                if (editingItem) {
                    await axios.put(`/api/hr/reimbursement-types/${editingItem.id}`, payload);
                    toast.success('Reimbursement type updated successfully');
                } else {
                    await axios.post('/api/hr/reimbursement-types', payload);
                    toast.success('Reimbursement type created successfully');
                }
                setFormOpen(false);
                setEditingItem(null);
                resetForm();
                fetchData();
                onTypesChanged?.();
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save reimbursement type');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const handleAdd = () => {
        setEditingItem(null);
        formik.resetForm({ values: { name: '', description: '', is_active: true } });
        setFormOpen(true);
    };

    const handleEdit = (item: ReimbursementType) => {
        setEditingItem(item);
        formik.resetForm({
            values: { name: item.name, description: item.description || '', is_active: item.is_active },
        });
        setFormOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            const response = await axios.delete(`/api/hr/reimbursement-types/${deleteItem.id}`);
            toast.success(response.data.message || 'Reimbursement type deleted successfully');
            setDeleteItem(null);
            fetchData();
            onTypesChanged?.();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete reimbursement type');
        } finally {
            setDeleteLoading(false);
        }
    };

    const progress = useMemo(() => {
        const fields = [formik.values.name, formik.values.description, String(formik.values.is_active)];
        const filled = fields.filter((v) => v && String(v).trim() !== '').length;
        return Math.round((filled / fields.length) * 100);
    }, [formik.values]);

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="sm:max-w-[700px] flex flex-col max-h-[85vh]">
                    <DialogHeader className="shrink-0">
                        <DialogTitle>Reimbursement Types</DialogTitle>
                        <DialogDescription>Manage reimbursement types used in requests.</DialogDescription>
                    </DialogHeader>

                    <div className="py-2 overflow-y-auto min-h-0 flex-1">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            </div>
                        ) : data.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">No reimbursement types found.</p>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead className="w-[70px]">Active</TableHead>
                                        <TableHead className="w-[80px] text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {data.map((item) => (
                                        <TableRow key={item.id}>
                                            <TableCell className="font-medium">{item.name}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{item.description || '-'}</TableCell>
                                            <TableCell>
                                                <Badge variant={item.is_active ? 'default' : 'secondary'}>
                                                    {item.is_active ? 'Yes' : 'No'}
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
                            <Plus className="h-4 w-4 mr-1" /> Add Type
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
                        <DialogTitle>{editingItem ? 'Edit Reimbursement Type' : 'Add Reimbursement Type'}</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={formik.handleSubmit} className="space-y-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="rt-name">Name *</Label>
                            <Input id="rt-name" {...formik.getFieldProps('name')} placeholder="e.g., Travel Allowance" />
                            {formik.touched.name && formik.errors.name && (
                                <p className="text-sm text-destructive">{formik.errors.name}</p>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="rt-description">Description</Label>
                            <Textarea id="rt-description" {...formik.getFieldProps('description')} placeholder="Description" />
                        </div>
                        <div className="space-y-2 relative">
                            <Label htmlFor="rt-active">Active</Label>
                            <Select value={formik.values.is_active ? 'true' : 'false'} onValueChange={(value) => formik.setFieldValue('is_active', value === 'true')}>
                                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="true">Yes</SelectItem>
                                    <SelectItem value="false">No</SelectItem>
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
                    <DialogHeader><DialogTitle>Delete Reimbursement Type</DialogTitle></DialogHeader>
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
