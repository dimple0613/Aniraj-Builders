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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Save, X, Search, Loader2, Check, ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { AddModal } from './AddModal';


interface Unit {
    id: string;
    unit_name: string;
    company_id: string;
    _count?: {
        itemManagements: number;
        materials: number;
    };
}

interface UnitFormData {
    id: string;
    unit_name: string;
    isNew: boolean;
    isEditing: boolean;
    error: string | null;
    _count?: {
        itemManagements: number;
        materials: number;
    };
}

interface PaginationInfo {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
}

interface UnitManagerProps {
    onSuccess?: () => void;
}

export function UnitManager({ onSuccess }: UnitManagerProps) {
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
    const [sortField, setSortField] = useState<'unit_name' | 'createdAt'>('unit_name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const [units, setUnits] = useState<UnitFormData[]>([]);
    const [originalUnits, setOriginalUnits] = useState<Map<string, string>>(new Map());
    const [deleteItem, setDeleteItem] = useState<UnitFormData | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [addModalOpen, setAddModalOpen] = useState(false);

    const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const hasChanges = useMemo(() => {
        return units.some(u => u.isNew || u.isEditing);
    }, [units]);

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

    const fetchUnits = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/units', {
                params: {
                    page: pagination.page,
                    limit: pagination.limit,
                    search: debouncedSearch,
                    sortField,
                    sortOrder,
                },
            });

            const data = response.data.data || [];
            const paginationData = response.data.pagination || {};

            const formData: UnitFormData[] = data.map((u: Unit) => ({
                id: u.id,
                unit_name: u.unit_name,
                isNew: false,
                isEditing: false,
                error: null,
                _count: u._count,
            }));

            const originalMap = new Map<string, string>();
            data.forEach((u: Unit) => originalMap.set(u.id, u.unit_name));

            setUnits(formData);
            setOriginalUnits(originalMap);
            setPagination({
                page: paginationData.page || 1,
                totalPages: paginationData.pages || 1,
                total: paginationData.total || 0,
                limit: paginationData.limit || 10,
            });
        } catch (error) {
            toast.error('Failed to fetch units');
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit, debouncedSearch, sortField, sortOrder]);

    useEffect(() => {
        if (isOpen) {
            fetchUnits();
        }
    }, [isOpen, fetchUnits]);

    const validateUnit = useCallback((name: string, excludeId?: string): string | null => {
        if (!name.trim()) {
            return 'Unit name is required';
        }
        const isDuplicate = units.some(u =>
            u.unit_name.toLowerCase() === name.toLowerCase() &&
            u.id !== excludeId
        );
        if (isDuplicate) {
            return 'Unit name already exists';
        }
        return null;
    }, [units]);

    const handleAddNewClick = () => {
        setAddModalOpen(true);
    };

    const handleEditField = (id: string, value: string) => {
        setUnits(prev => prev.map(u => {
            if (u.id === id) {
                const error = value ? validateUnit(value, id) : 'Unit name is required';
                const originalName = id ? originalUnits.get(id) : undefined;
                return {
                    ...u,
                    unit_name: value,
                    isEditing: true,
                    error: u.isNew ? (value ? null : error) : (originalName && value !== originalName ? null : u.error),
                };
            }
            return u;
        }));
    };

    const handleDeleteClick = (unit: UnitFormData) => {
        setDeleteItem(unit);
    };

    const confirmDelete = async () => {
        if (!deleteItem || deleteItem.isNew) {
            if (deleteItem?.isNew) {
                setUnits(prev => prev.filter(u => u.id !== deleteItem.id));
            }
            setDeleteItem(null);
            return;
        }

        try {
            setDeleteLoading(true);
            await axios.delete(`/api/units/${deleteItem.id}`);
            toast.success('Unit deleted successfully');
            fetchUnits();
        } catch (error: unknown) {
            const err = error as any;
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete unit');
        } finally {
            setDeleteLoading(false);
            setDeleteItem(null);
        }
    };

    const handleSave = async () => {
        const unitsToSave = units.filter(u => u.isEditing && u.unit_name.trim());

        for (const unit of unitsToSave) {
            const error = validateUnit(unit.unit_name, unit.id);
            if (error) {
                toast.error(error);
                return;
            }
        }

        try {
            setSaving(true);

            for (const unit of unitsToSave) {
                const originalName = unit.id ? originalUnits.get(unit.id) : undefined;
                if (unit.isNew) {
                    await axios.post('/api/units', { unit_name: unit.unit_name });
                } else if (unit.id && originalName && unit.unit_name !== originalName) {
                    await axios.put(`/api/units/${unit.id}`, { unit_name: unit.unit_name });
                }
            }

            toast.success('Units saved successfully');
            fetchUnits();
            onSuccess?.();
        } catch (error: unknown) {
            const err = error as any;
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save units');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        fetchUnits();
    };

    const handleSort = (field: 'unit_name' | 'createdAt') => {
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
                Manage Units
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Unit Management</DialogTitle>
                    </DialogHeader>

                    <div className="flex items-center gap-4 pt-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search units..."
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
                                        onClick={() => handleSort('unit_name')}
                                    >
                                        <div className="flex items-center gap-1">
                                            Unit Name {sortField === 'unit_name' && (sortOrder === 'asc' ? <ArrowUpDown className="h-3 w-3" /> : <ArrowUpDown className="h-3 w-3" />)}
                                        </div>
                                    </TableHead>
                                    <TableHead className="text-foreground h-[40px] px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody className='[&_tr:last-child]:border-0'>
                                {loading ? (
                                    <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors">
                                        <TableCell colSpan={2} className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]">
                                            <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                        </TableCell>
                                    </TableRow>
                                ) : units.length === 0 ? (
                                    <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors">
                                        <TableCell colSpan={2} className="p-4 md:p-8 align-middle text-center [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]">
                                            No units found. Click &quot;Add New&quot; to create one.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    units.map((unit) => (
                                        <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors" key={unit.id}>
                                            <TableCell className='p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]'>
                                                {unit.isEditing || unit.isNew ? (
                                                    <div className="space-y-1">
                                                        <Input
                                                            value={unit.unit_name}
                                                            onChange={(e) => handleEditField(unit.id, e.target.value)}
                                                            placeholder="Enter unit name"
                                                            className={unit.error ? 'border-destructive' : ''}
                                                            autoFocus={unit.isNew}
                                                        />
                                                        {unit.error && (
                                                            <p className="text-xs text-destructive">{unit.error}</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span>{unit.unit_name}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {unit.isEditing || unit.isNew ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => {
                                                                if (unit.isNew) {
                                                                    setUnits(prev => prev.filter(u => u.id !== unit.id));
                                                                } else {
                                                                    const original = unit.id ? originalUnits.get(unit.id) : undefined;
                                                                    setUnits(prev => prev.map(u =>
                                                                        u.id === unit.id
                                                                            ? { ...u, unit_name: original || '', isEditing: false, error: null }
                                                                            : u
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
                                                        onClick={() => handleDeleteClick(unit)}
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
                </DialogContent>
            </Dialog>

            <AddModal
                isOpen={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                onSuccess={() => {
                    fetchUnits();
                    onSuccess?.();
                }}
                title="Unit"
                placeholder="Enter unit name (e.g., Piece, Kg, Meter)"
                apiEndpoint="/api/units"
                fieldName="unit_name"
            />

            <Dialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                    </DialogHeader>
                    <DialogDescription className="py-4">
                        <p>
                            Are you sure you want to delete{' '}
                            <strong>{deleteItem?.unit_name}</strong>?
                        </p>
                        {deleteItem && !deleteItem.isNew && deleteItem._count && (
                            <p className="mt-2 text-sm text-muted-foreground">
                                This will affect {deleteItem._count.itemManagements} related records.
                            </p>
                        )}
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
