'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
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
import { Plus, Trash2, Save, X, Search, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { AddModal } from './AddModal';
import { naturalCompare } from '@/lib/utils/sortEstimateItems';

interface AYMaster {
    id: string;
    ay_no: string;
    company_id: string;
    _count?: {
        itemManagements: number;
    };
}

interface AYMasterFormData {
    id: string;
    ay_no: string;
    isNew: boolean;
    isEditing: boolean;
    error: string | null;
    _count?: {
        itemManagements: number;
    };
}

interface PaginationInfo {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
}

interface AYMasterManagerProps {
    onSuccess?: () => void;
}

export function AYMasterManager({ onSuccess }: AYMasterManagerProps) {
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
    const [sortField, setSortField] = useState<'ay_no' | 'createdAt'>('ay_no');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const [ayMasters, setAyMasters] = useState<AYMasterFormData[]>([]);
    const [originalAyMasters, setOriginalAyMasters] = useState<Map<string, string>>(new Map());
    const [deleteItem, setDeleteItem] = useState<AYMasterFormData | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [addModalOpen, setAddModalOpen] = useState(false);

    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const hasChanges = useMemo(() => {
        return ayMasters.some(a => a.isNew || a.isEditing);
    }, [ayMasters]);

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

    const fetchAyMasters = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/ay-masters', {
                params: {
                    page: pagination.page,
                    limit: pagination.limit,
                    search: debouncedSearch,
                    sortField: 'createdAt',  // Always fetch sorted by date for consistent pagination
                    sortOrder: 'desc',
                },
            });

            let data = response.data.data || [];
            const paginationData = response.data.pagination || {};

            // Apply client-side natural sorting for ay_no field
            if (sortField === 'ay_no') {
                data = [...data].sort((a: AYMaster, b: AYMaster) => {
                    const result = naturalCompare(a.ay_no || '', b.ay_no || '');
                    return sortOrder === 'asc' ? result : -result;
                });
            }

            const formData: AYMasterFormData[] = data.map((a: AYMaster) => ({
                id: a.id,
                ay_no: a.ay_no,
                isNew: false,
                isEditing: false,
                error: null,
                _count: a._count,
            }));

            const originalMap = new Map<string, string>();
            data.forEach((a: AYMaster) => originalMap.set(a.id, a.ay_no));

            setAyMasters(formData);
            setOriginalAyMasters(originalMap);
            setPagination({
                page: paginationData.page || 1,
                totalPages: paginationData.pages || 1,
                total: paginationData.total || 0,
                limit: paginationData.limit || 10,
            });
        } catch (error) {
            toast.error('Failed to fetch Item Number');
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit, debouncedSearch, sortField, sortOrder]);

    useEffect(() => {
        if (isOpen) {
            fetchAyMasters();
        }
    }, [isOpen, fetchAyMasters]);

    const validateAyNo = useCallback((ayNo: string, excludeId?: string): string | null => {
        if (!ayNo.trim()) {
            return 'Item Number is required';
        }
        const isDuplicate = ayMasters.some(a =>
            a.ay_no.toLowerCase() === ayNo.toLowerCase() &&
            a.id !== excludeId
        );
        if (isDuplicate) {
            return 'Item Number already exists';
        }
        return null;
    }, [ayMasters]);

    const handleAddNewClick = () => {
        setAddModalOpen(true);
    };

    const handleEditField = (id: string, value: string) => {
        setAyMasters(prev => prev.map(a => {
            if (a.id === id) {
                const error = value ? validateAyNo(value, id) : 'AY No is required';
                const originalName = id ? originalAyMasters.get(id) : undefined;
                return {
                    ...a,
                    ay_no: value,
                    isEditing: true,
                    error: a.isNew ? (value ? null : error) : (originalName && value !== originalName ? null : a.error),
                };
            }
            return a;
        }));
    };

    const handleDeleteClick = (item: AYMasterFormData) => {
        setDeleteItem(item);
    };

    const confirmDelete = async () => {
        if (!deleteItem || deleteItem.isNew) {
            if (deleteItem?.isNew) {
                setAyMasters(prev => prev.filter(a => a.id !== deleteItem.id));
            }
            setDeleteItem(null);
            return;
        }

        try {
            setDeleteLoading(true);
            await axios.delete(`/api/ay-masters/${deleteItem.id}`);
            toast.success('AY Master deleted successfully');
            fetchAyMasters();
        } catch (error: unknown) {
            const err = error as any;
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete AY Master');
        } finally {
            setDeleteLoading(false);
            setDeleteItem(null);
        }
    };

    const handleSave = async () => {
        const ayToSave = ayMasters.filter(a => a.isEditing && a.ay_no.trim());

        for (const ay of ayToSave) {
            const error = validateAyNo(ay.ay_no, ay.id);
            if (error) {
                toast.error(error);
                return;
            }
        }

        try {
            setSaving(true);

            for (const ay of ayToSave) {
                const originalName = ay.id ? originalAyMasters.get(ay.id) : undefined;
                if (ay.isNew) {
                    await axios.post('/api/ay-masters', { ay_no: ay.ay_no });
                } else if (ay.id && originalName && ay.ay_no !== originalName) {
                    await axios.put(`/api/ay-masters/${ay.id}`, { ay_no: ay.ay_no });
                }
            }

            toast.success('AY Masters saved successfully');
            fetchAyMasters();
            onSuccess?.();
        } catch (error: unknown) {
            const err = error as any;
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save AY Masters');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        fetchAyMasters();
    };

    const handleSort = (field: 'ay_no' | 'createdAt') => {
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

    const handleLimitChange = (newLimit: number) => {
        setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
    };

    return (
        <>
            <Button variant="outline" size="sm" onClick={() => setIsOpen(true)}>
                <Plus className="h-4 w-4" />
                Manage Item Number
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Item Number Management</DialogTitle>
                    </DialogHeader>

                    <div className="flex items-center gap-4 pt-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search AY..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input min-w-0 rounded-md border bg-transparent px-3 py-1 shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive h-8 w-[150px] lg:w-[250px] pl-10"
                            />
                        </div>
                        <Button className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-primary text-primary-foreground hover:bg-primary/90 h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5" size="sm" onClick={handleAddNewClick}>
                            <Plus className="h-4 w-4" /> Add
                        </Button>
                    </div>

                    <div className="flex-1 overflow-auto border rounded-md min-h-[200px] max-h-[400px]">
                        <Table className='min-w-full'>
                            <TableHeader className="sticky top-0  [&_tr]:border-b">
                                <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors">
                                    <TableHead
                                        className="text-foreground h-[40px] px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]"
                                        onClick={() => handleSort('ay_no')}
                                    >
                                        Item Number {sortField === 'ay_no' && (sortOrder === 'asc' ? '↑' : '↓')}
                                    </TableHead>
                                    <TableHead className="text-foreground h-[40px] px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className='[&_tr:last-child]:border-0'>
                                {loading ? (
                                    <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors">
                                        <TableCell colSpan={2} className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-center">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                        </TableCell>
                                    </TableRow>
                                ) : ayMasters.length === 0 ? (
                                    <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors">
                                        <TableCell colSpan={2} className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-center">
                                            No Item Number ound. Click &quot;Add New&quot; to create one.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    ayMasters.map((ay) => (
                                        <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors" key={ay.id}>
                                            <TableCell className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]">
                                                {ay.isEditing || ay.isNew ? (
                                                    <div className="space-y-1">
                                                        <Input
                                                            value={ay.ay_no}
                                                            onChange={(e) => handleEditField(ay.id, e.target.value)}
                                                            placeholder="Enter AY No"
                                                            className={ay.error ? 'border-destructive' : ''}
                                                            autoFocus={ay.isNew}
                                                        />
                                                        {ay.error && (
                                                            <p className="text-xs text-destructive">{ay.error}</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span>{ay.ay_no}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {ay.isEditing || ay.isNew ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => {
                                                                if (ay.isNew) {
                                                                    setAyMasters(prev => prev.filter(a => a.id !== ay.id));
                                                                } else {
                                                                    const original = ay.id ? originalAyMasters.get(ay.id) : undefined;
                                                                    setAyMasters(prev => prev.map(a =>
                                                                        a.id === ay.id
                                                                            ? { ...a, ay_no: original || '', isEditing: false, error: null }
                                                                            : a
                                                                    ));
                                                                }
                                                            }}
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    ) : null}
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                                        onClick={() => handleDeleteClick(ay)}
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
                        <div className="flex items-center space-x-6 lg:space-x-8">
                            {/* <div className="flex items-center space-x-2">
                                <span className="text-sm font-medium">
                                    Rows per page
                                </span>
                                <Select
                                    value={pagination.limit.toString()}
                                    onValueChange={(value) => handleLimitChange(parseInt(value))}
                                >
                                    <SelectTrigger className="border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:bg-input/30 dark:hover:bg-input/50 flex items-center justify-between gap-2 rounded-md border bg-transparent px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-2 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 h-8 w-[70px]">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="5">5</SelectItem>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="25">25</SelectItem>
                                    </SelectContent>
                                </Select>

                            </div> */}
                            <div className="flex items-center space-x-2">
                                <Button
                                    variant="outline"
                                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 size-8"
                                    size="icon"
                                    onClick={() => handlePageChange(pagination.page - 1)}
                                    disabled={pagination.page <= 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50 size-8"
                                    size="icon"
                                    onClick={() => handlePageChange(pagination.page + 1)}
                                    disabled={pagination.page >= pagination.totalPages}
                                >
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* <div className="flex justify-end gap-2 pt-3 border-t">
                        <Button variant="outline" onClick={handleCancel} disabled={saving || !hasChanges}>
                            Cancel
                        </Button>
                        <Button onClick={handleSave} disabled={saving || !hasChanges}>
                            {saving ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    Save Changes
                                </>
                            )}
                        </Button>
                    </div> */}
                </DialogContent>
            </Dialog>

            <AddModal
                isOpen={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                onSuccess={() => {
                    fetchAyMasters();
                    onSuccess?.();
                }}
                title="AY Master"
                placeholder="Enter AY No (e.g., 2024-25)"
                apiEndpoint="/api/ay-masters"
                fieldName="ay_no"
            />

            <Dialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                    </DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to delete{' '}
                        <strong>{deleteItem?.ay_no}</strong>?
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
