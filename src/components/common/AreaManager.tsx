'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { Plus, Trash2, Search, Loader2, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { AddModal } from './AddModal';

interface Area {
    id: string;
    title: string;
    createdAt: string;
}

interface AreaFormData {
    id: string;
    name: string;
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

interface AreaManagerProps {
    onSuccess?: () => void;
}

export function AreaManager({ onSuccess }: AreaManagerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
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

    const [areas, setAreas] = useState<AreaFormData[]>([]);
    const [originalAreas, setOriginalAreas] = useState<Map<string, string>>(new Map());
    const [deleteItem, setDeleteItem] = useState<AreaFormData | null>(null);
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

    const fetchAreas = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/project-areas', {
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

            const formData: AreaFormData[] = data.map((d: Area) => ({
                id: d.id,
                name: d.title,
                isNew: false,
                isEditing: false,
                error: null,
            }));

            const originalMap = new Map<string, string>();
            data.forEach((d: Area) => originalMap.set(d.id, d.title));

            setAreas(formData);
            setOriginalAreas(originalMap);
            setPagination({
                page: paginationData.page || 1,
                totalPages: paginationData.pages || 1,
                total: paginationData.total || 0,
                limit: paginationData.limit || 10,
            });
        } catch (error) {
            toast.error('Failed to fetch areas');
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit, debouncedSearch, sortField, sortOrder]);

    useEffect(() => {
        if (isOpen) {
            fetchAreas();
        }
    }, [isOpen, fetchAreas]);

    const validateName = useCallback((name: string, excludeId?: string): string | null => {
        if (!name.trim()) {
            return 'Area name is required';
        }
        const isDuplicate = areas.some(d =>
            d.name.toLowerCase() === name.toLowerCase() &&
            d.id !== excludeId
        );
        if (isDuplicate) {
            return 'Area name already exists';
        }
        return null;
    }, [areas]);

    const handleAddNewClick = () => {
        setAddModalOpen(true);
    };

    const handleEditField = (id: string, value: string) => {
        setAreas(prev => prev.map(d => {
            if (d.id === id) {
                const error = value ? validateName(value, id) : 'Area name is required';
                const originalName = id ? originalAreas.get(id) : undefined;
                return {
                    ...d,
                    name: value,
                    isEditing: true,
                    error: d.isNew ? (value ? null : error) : (originalName && value !== originalName ? null : d.error),
                };
            }
            return d;
        }));
    };

    const handleDeleteClick = (item: AreaFormData) => {
        setDeleteItem(item);
    };

    const confirmDelete = async () => {
        if (!deleteItem || deleteItem.isNew) {
            if (deleteItem?.isNew) {
                setAreas(prev => prev.filter(d => d.id !== deleteItem.id));
            }
            setDeleteItem(null);
            return;
        }

        try {
            setDeleteLoading(true);
            await axios.delete(`/api/project-areas/${deleteItem.id}`);
            toast.success('Area deleted successfully');
            fetchAreas();
        } catch (error: unknown) {
            const err = error as any;
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete area');
        } finally {
            setDeleteLoading(false);
            setDeleteItem(null);
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
                Area
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Area Management</DialogTitle>
                    </DialogHeader>

                    <div className="flex items-center gap-4 pt-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search areas..."
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
                                        Area Name {sortField === 'name' && (sortOrder === 'asc' ? '↑' : '↓')}
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
                                ) : areas.length === 0 ? (
                                    <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors">
                                        <TableCell colSpan={2} className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-center">
                                            No areas found. Click &quot;Add&quot; to create one.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    areas.map((d) => (
                                        <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors" key={d.id}>
                                            <TableCell className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]">
                                                {d.isEditing || d.isNew ? (
                                                    <div className="space-y-1">
                                                        <Input
                                                            value={d.name}
                                                            onChange={(e) => handleEditField(d.id, e.target.value)}
                                                            placeholder="Enter area name"
                                                            className={d.error ? 'border-destructive' : ''}
                                                            autoFocus={d.isNew}
                                                        />
                                                        {d.error && (
                                                            <p className="text-xs text-destructive">{d.error}</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span>{d.name}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {d.isEditing || d.isNew ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => {
                                                                if (d.isNew) {
                                                                    setAreas(prev => prev.filter(dep => dep.id !== d.id));
                                                                } else {
                                                                    const original = d.id ? originalAreas.get(d.id) : undefined;
                                                                    setAreas(prev => prev.map(dep =>
                                                                        dep.id === d.id
                                                                            ? { ...dep, name: original || '', isEditing: false, error: null }
                                                                            : dep
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
                                                        onClick={() => handleDeleteClick(d)}
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

            <AddModal
                isOpen={addModalOpen}
                onClose={() => setAddModalOpen(false)}
                onSuccess={() => {
                    fetchAreas();
                    onSuccess?.();
                }}
                title="Area"
                placeholder="Enter area name"
                apiEndpoint="/api/project-areas"
                fieldName="name"
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
