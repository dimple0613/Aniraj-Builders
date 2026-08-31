'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Plus, Trash2, Search, Loader2, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';

interface Location {
    id: string;
    name: string;
    address: string | null;
}

interface LocationFormData {
    id: string;
    name: string;
    address: string;
    isNew: boolean;
    isEditing: boolean;
    error: string | null;
}

interface PaginationInfo {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
}

interface LocationManagerProps {
    onSuccess?: () => void;
}

export function LocationManager({ onSuccess }: LocationManagerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1,
        totalPages: 1,
        total: 0,
        limit: 5,
    });
    const [sortField, setSortField] = useState<'name' | 'createdAt'>('name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const [locations, setLocations] = useState<LocationFormData[]>([]);
    const [originalLocations, setOriginalLocations] = useState<Map<string, { name: string; address: string | null }>>(new Map());
    const [deleteItem, setDeleteItem] = useState<LocationFormData | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [addModalOpen, setAddModalOpen] = useState(false);

    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        searchTimeoutRef.current = setTimeout(() => {
            setDebouncedSearch(search);
            setPagination(prev => ({ ...prev, page: 1 }));
        }, 400);
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, [search]);

    const fetchLocations = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/locations', {
                params: {
                    page: pagination.page,
                    limit: pagination.limit,
                    search: debouncedSearch,
                },
            });

            const data = response.data.data || [];
            const paginationData = response.data.pagination || {};

            const formData: LocationFormData[] = data.map((l: Location) => ({
                id: l.id,
                name: l.name,
                address: l.address || '',
                isNew: false,
                isEditing: false,
                error: null,
            }));

            const originalMap = new Map<string, { name: string; address: string | null }>();
            data.forEach((l: Location) => originalMap.set(l.id, { name: l.name, address: l.address }));

            setLocations(formData);
            setOriginalLocations(originalMap);
            setPagination({
                page: paginationData.page || 1,
                totalPages: paginationData.pages || 1,
                total: paginationData.total || 0,
                limit: paginationData.limit || 10,
            });
        } catch (error) {
            toast.error('Failed to fetch locations');
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit, debouncedSearch]);

    useEffect(() => {
        if (isOpen) {
            fetchLocations();
        }
    }, [isOpen, fetchLocations]);

    const validateLocation = useCallback((name: string, excludeId?: string): string | null => {
        if (!name.trim()) {
            return 'Location name is required';
        }
        const isDuplicate = locations.some(l =>
            l.name.toLowerCase() === name.toLowerCase() &&
            l.id !== excludeId
        );
        if (isDuplicate) {
            return 'Location name already exists';
        }
        return null;
    }, [locations]);

    const handleAddNewClick = () => {
        setAddModalOpen(true);
    };

    const handleEditField = (id: string, field: 'name' | 'address', value: string) => {
        setLocations(prev => prev.map(l => {
            if (l.id === id) {
                if (field === 'name') {
                    const error = value ? validateLocation(value, id) : 'Location name is required';
                    const original = id ? originalLocations.get(id) : undefined;
                    return {
                        ...l,
                        name: value,
                        isEditing: true,
                        error: l.isNew ? (value ? null : error) : (original && value !== original.name ? null : l.error),
                    };
                } else {
                    return { ...l, address: value, isEditing: true };
                }
            }
            return l;
        }));
    };

    const handleDeleteClick = (item: LocationFormData) => {
        setDeleteItem(item);
    };

    const confirmDelete = async () => {
        if (!deleteItem || deleteItem.isNew) {
            if (deleteItem?.isNew) {
                setLocations(prev => prev.filter(l => l.id !== deleteItem.id));
            }
            setDeleteItem(null);
            return;
        }

        try {
            setDeleteLoading(true);
            await axios.delete(`/api/locations/${deleteItem.id}`);
            toast.success('Location deleted successfully');
            fetchLocations();
        } catch (error: unknown) {
            const err = error as any;
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete location');
        } finally {
            setDeleteLoading(false);
            setDeleteItem(null);
        }
    };

    const handleSave = async () => {
        const locationsToSave = locations.filter(l => l.isEditing && l.name.trim());

        for (const loc of locationsToSave) {
            const error = validateLocation(loc.name, loc.id);
            if (error) {
                toast.error(error);
                return;
            }
        }

        try {
            setSaving(true);

            for (const loc of locationsToSave) {
                const original = loc.id ? originalLocations.get(loc.id) : undefined;
                if (loc.isNew) {
                    await axios.post('/api/locations', { name: loc.name, address: loc.address || undefined });
                } else if (loc.id && original && (loc.name !== original.name || loc.address !== (original.address || ''))) {
                    await axios.put(`/api/locations/${loc.id}`, { name: loc.name, address: loc.address || undefined });
                }
            }

            toast.success('Locations saved successfully');
            fetchLocations();
            onSuccess?.();
        } catch (error: unknown) {
            const err = error as any;
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save locations');
        } finally {
            setSaving(false);
        }
    };

    const handleSort = (field: 'name' | 'createdAt') => {
        if (sortField === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortOrder('asc');
        }
    };

    const handlePageChange = (newPage: number) => {
        setPagination(prev => ({ ...prev, page: newPage }));
    };

    return (
        <>
            <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
                <Plus className="h-4 w-4" />
                Locations
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Location Management</DialogTitle>
                    </DialogHeader>

                    <div className="flex items-center gap-4 pt-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search locations..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input min-w-0 rounded-md border bg-transparent px-3 py-1 shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive h-8 w-[150px] lg:w-[250px] pl-10"
                            />
                        </div>
                        <Button size="sm" onClick={handleAddNewClick}>
                            <Plus className="h-4 w-4" /> Add
                        </Button>
                    </div>

                    <div className="flex-1 overflow-auto border rounded-md min-h-[200px] max-h-[400px]">
                        <Table className='min-w-full'>
                            <TableHeader className="sticky top-0  [&_tr]:border-b">
                                <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors">
                                    <TableHead
                                        className="text-foreground h-[40px] px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]"
                                        onClick={() => handleSort('name')}
                                    >
                                        Location Name {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </TableHead>
                                    <TableHead className="text-foreground h-[40px] px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]">
                                        Address
                                    </TableHead>
                                    <TableHead className="text-foreground h-[40px] px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className='[&_tr:last-child]:border-0'>
                                {loading ? (
                                    <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors">
                                        <TableCell colSpan={3} className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                        </TableCell>
                                    </TableRow>
                                ) : locations.length === 0 ? (
                                    <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors">
                                        <TableCell colSpan={3} className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-center">
                                            No locations found. Click &quot;Add New&quot; to create one.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    locations.map((l) => (
                                        <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors" key={l.id}>
                                            <TableCell className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]">
                                                {l.isEditing || l.isNew ? (
                                                    <div className="space-y-1">
                                                        <Input
                                                            value={l.name}
                                                            onChange={(e) => handleEditField(l.id, 'name', e.target.value)}
                                                            placeholder="Enter location name"
                                                            className={l.error ? 'border-destructive' : ''}
                                                            autoFocus={l.isNew}
                                                        />
                                                        {l.error && (
                                                            <p className="text-xs text-destructive">{l.error}</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span>{l.name}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]">
                                                {l.isEditing || l.isNew ? (
                                                    <Input
                                                        value={l.address}
                                                        onChange={(e) => handleEditField(l.id, 'address', e.target.value)}
                                                        placeholder="Enter address (optional)"
                                                    />
                                                ) : (
                                                    <span className="text-muted-foreground">{l.address || '-'}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {l.isEditing || l.isNew ? (
                                                        <>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-green-600 hover:text-green-700"
                                                                onClick={async () => {
                                                                    if (!l.name.trim()) {
                                                                        toast.error('Location name is required');
                                                                        return;
                                                                    }
                                                                    try {
                                                                        if (l.isNew) {
                                                                            await axios.post('/api/locations', { name: l.name, address: l.address || undefined });
                                                                            toast.success('Location created successfully');
                                                                        } else {
                                                                            await axios.put(`/api/locations/${l.id}`, { name: l.name, address: l.address || undefined });
                                                                            toast.success('Location updated successfully');
                                                                        }
                                                                        fetchLocations();
                                                                    } catch (err: any) {
                                                                        toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save');
                                                                    }
                                                                }}
                                                            >
                                                                <Check className="h-4 w-4" />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8"
                                                                onClick={() => {
                                                                    if (l.isNew) {
                                                                        setLocations(prev => prev.filter(loc => loc.id !== l.id));
                                                                    } else {
                                                                        const original = l.id ? originalLocations.get(l.id) : undefined;
                                                                        setLocations(prev => prev.map(loc =>
                                                                            loc.id === l.id
                                                                                ? { ...loc, name: original?.name || '', address: original?.address || '', isEditing: false, error: null }
                                                                                : loc
                                                                        ));
                                                                    }
                                                                }}
                                                            >
                                                                <X className="h-4 w-4" />
                                                            </Button>
                                                        </>
                                                    ) : null}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                                        onClick={() => handleDeleteClick(l)}
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    <div className="flex items-center space-x-6 lg:space-x-8">
                        <div className="text-muted-foreground flex-1 text-sm">
                            Page  {pagination.page} of {pagination.totalPages} ({pagination.total})
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handlePageChange(pagination.page - 1)}
                                disabled={pagination.page <= 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={() => handlePageChange(pagination.page + 1)}
                                disabled={pagination.page >= pagination.totalPages}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>


            <LocationAddForm
                onSuccess={() => {
                    fetchLocations();
                    setAddModalOpen(false);
                    onSuccess?.();
                }}
                addModalOpen={addModalOpen}
                setAddModalOpen={setAddModalOpen}
                onClose={() => setAddModalOpen(false)}
            />


            <Dialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                    </DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to delete{' '}
                        <strong>{deleteItem?.name}</strong>?
                    </DialogDescription>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setDeleteItem(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmDelete} disabled={deleteLoading}>
                            {deleteLoading ? 'Deleting...' : 'Delete'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}

function LocationAddForm({ onSuccess, addModalOpen, setAddModalOpen, onClose }: any) {
    const formik = useFormik({
        initialValues: {
            name: '',
            address: '',
        },
        validationSchema: Yup.object({
            name: Yup.string().trim().required('Location name is required'),
            address: Yup.string().optional(),
        }),
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            try {
                await axios.post('/api/locations', { name: values.name.trim(), address: values.address.trim() || undefined });
                toast.success('Location created successfully');
                resetForm();
                onSuccess();
            } catch (err: any) {
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to create location');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const progress = useMemo(() => {
        let filled = 0;
        let total = 0;
        const allFields = [
            { value: formik.values.name },
            { value: formik.values.address },
        ];
        allFields.forEach(field => {
            total++;
            if (field.value && field.value.toString().trim() !== '') {
                filled++;
            }
        });
        return total > 0 ? Math.round((filled / total) * 100) : 0;
    }, [formik.values.name, formik.values.address]);

    const handleClose = () => {
        formik.resetForm();
        onClose();
    };

    return (
        <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
            <DialogContent className="sm:max-w-md">
                <div className="-mx-6 -mt-6">
                    <div className="w-full h-1.5 bg-muted rounded-full bg-red-500 overflow-hidden">
                        <div
                            className="h-full bg-blue-600 transition-all  duration-300"
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
                <DialogHeader>
                    <DialogTitle>Add Location</DialogTitle>
                </DialogHeader>

                <form onSubmit={formik.handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Input
                            name="name"
                            value={formik.values.name}
                            onChange={(e) => formik.setFieldValue('name', e.target.value.toUpperCase())}
                            onBlur={formik.handleBlur}
                            placeholder="Enter location name"
                            autoFocus
                            style={{ textTransform: 'uppercase' }}
                        />
                        {formik.touched.name && formik.errors.name && (
                            <p className="text-sm text-destructive">{formik.errors.name}</p>
                        )}
                        <Input
                            name="address"
                            value={formik.values.address}
                            onChange={(e) => formik.setFieldValue('address', e.target.value.toUpperCase())}
                            onBlur={formik.handleBlur}
                            placeholder="Enter address (optional)"
                            style={{ textTransform: 'uppercase' }}
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={handleClose}>
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                        </Button>
                        <Button type="submit" size="sm" disabled={formik.isSubmitting || !formik.values.name.trim()}>
                            {formik.isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Check className="h-4 w-4 mr-1" />
                                    Save
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
