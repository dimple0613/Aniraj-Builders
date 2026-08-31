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
import { AddModal } from '../common/AddModal';

interface GroupItem {
    id: string;
    name: string;
    createdAt: string;
}

interface GroupFormData {
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

export function GroupManager() {
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
    const [sortField, setSortField] = useState<'item_name' | 'createdAt'>('item_name');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    const [items, setItems] = useState<GroupFormData[]>([]);
    const [originalItems, setOriginalItems] = useState<Map<string, string>>(new Map());
    const [deleteItem, setDeleteItem] = useState<GroupFormData | null>(null);
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

    const fetchItems = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/sor-groups', {
                params: {
                    page: pagination.page,
                    limit: pagination.limit,
                    search: debouncedSearch,
                },
            });

            const data = response.data.data || [];
            const formData: GroupFormData[] = data.map((item: GroupItem) => ({
                id: item.id,
                name: item.name,
                isNew: false,
                isEditing: false,
                error: null,
            }));

            const originalMap = new Map<string, string>();
            data.forEach((item: GroupItem) => originalMap.set(item.id, item.name));

            setItems(formData);
            setOriginalItems(originalMap);
            setPagination(prev => ({
                ...prev,
                totalPages: response.data.pagination?.pages || 1,
                total: response.data.pagination?.total || 0,
            }));
        } catch (error) {
            toast.error('Failed to fetch groups');
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit, debouncedSearch, sortField, sortOrder]);

    useEffect(() => {
        if (isOpen) {
            fetchItems();
        }
    }, [isOpen, fetchItems]);

    const validateName = useCallback((name: string, excludeId?: string): string | null => {
        if (!name.trim()) {
            return 'Name is required';
        }
        const isDuplicate = items.some(item =>
            item.name.toLowerCase() === name.toLowerCase() &&
            item.id !== excludeId
        );
        if (isDuplicate) {
            return 'Name already exists';
        }
        return null;
    }, [items]);

    const handleEditField = (id: string, value: string) => {
        setItems(prev => prev.map(item => {
            if (item.id === id) {
                const error = value ? validateName(value, id) : 'Name is required';
                const originalName = id ? originalItems.get(id) : undefined;
                return {
                    ...item,
                    name: value,
                    isEditing: true,
                    error: item.isNew ? (value ? null : error) : (originalName && value !== originalName ? null : item.error),
                };
            }
            return item;
        }));
    };

    const handleEditBlur = async (item: GroupFormData) => {
        if (item.name !== originalItems.get(item.id)) {
            try {
                await axios.put(`/api/sor-groups/${item.id}`, {
                    id: item.id,
                    name: item.name,
                });
                toast.success('Group updated successfully');
                const newOriginalMap = new Map(originalItems);
                newOriginalMap.set(item.id, item.name);
                setOriginalItems(newOriginalMap);
                setItems(prev => prev.map(i =>
                    i.id === item.id ? { ...i, isEditing: false, error: null } : i
                ));
            } catch (error: any) {
                toast.error(error.response?.data?.message || 'Failed to update group');
                setItems(prev => prev.map(i =>
                    i.id === item.id
                        ? { ...i, name: originalItems.get(i.id) || '', isEditing: false, error: null }
                        : i
                ));
            }
        } else {
            setItems(prev => prev.map(i =>
                i.id === item.id ? { ...i, isEditing: false } : i
            ));
        }
    };

    const handleEditKeyDown = (e: React.KeyboardEvent, item: GroupFormData) => {
        if (e.key === 'Enter') {
            handleEditBlur(item);
        } else if (e.key === 'Escape') {
            setItems(prev => prev.map(i =>
                i.id === item.id
                    ? { ...i, name: originalItems.get(i.id) || '', isEditing: false, error: null }
                    : i
            ));
        }
    };

    const handleDeleteClick = (item: GroupFormData) => {
        setDeleteItem(item);
    };

    const confirmDelete = async () => {
        if (!deleteItem || deleteItem.isNew) {
            if (deleteItem?.isNew) {
                setItems(prev => prev.filter(item => item.id !== deleteItem.id));
            }
            setDeleteItem(null);
            return;
        }

        try {
            setDeleteLoading(true);
            await axios.delete(`/api/sor-groups/${deleteItem.id}`);
            toast.success('Group deleted successfully');
            fetchItems();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete group');
        } finally {
            setDeleteLoading(false);
            setDeleteItem(null);
        }
    };

    const handleSort = (field: 'item_name' | 'createdAt') => {
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
                Group
            </Button>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Group Management</DialogTitle>
                    </DialogHeader>

                    <div className="flex items-center gap-4 pt-3">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search groups..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-10 pr-10"
                            />
                            {search && (
                                <button
                                    onClick={() => setSearch('')}
                                    className="absolute right-3 top-1/2 -translate-y-1/2"
                                >
                                    <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                                </button>
                            )}
                        </div>
                        <Button size="sm" onClick={() => setAddModalOpen(true)}>
                            <Plus className="h-4 w-4" /> Add
                        </Button>
                    </div>

                    <div className="flex-1 overflow-auto border rounded-md min-h-[200px] max-h-[400px]">
                        <Table className='min-w-full'>
                            <TableHeader className="sticky top-0 [&_tr]:border-b">
                                <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors">
                                    <TableHead
                                        className="text-foreground h-[40px] px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]"
                                        onClick={() => handleSort('item_name')}
                                    >
                                        Group Name {sortField === 'item_name' && (sortOrder === 'asc' ? '↑' : '↓')}
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
                                ) : items.length === 0 ? (
                                    <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors">
                                        <TableCell colSpan={2} className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-center">
                                            No groups found. Click "Add" to create one.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    items.map((item) => (
                                        <TableRow className="hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors" key={item.id}>
                                            <TableCell className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]">
                                                {item.isEditing || item.isNew ? (
                                                    <div className="space-y-1">
                                                        <Input
                                                            value={item.name}
                                                            onChange={(e) => handleEditField(item.id, e.target.value)}
                                                            onBlur={() => handleEditBlur(item)}
                                                            onKeyDown={(e) => handleEditKeyDown(e, item)}
                                                            placeholder="Enter group name"
                                                            className={item.error ? 'border-destructive' : ''}
                                                            autoFocus={item.isNew}
                                                        />
                                                        {item.error && (
                                                            <p className="text-xs text-destructive">{item.error}</p>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span>{item.name}</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px] text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    {item.isEditing || item.isNew ? (
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => {
                                                                if (item.isNew) {
                                                                    setItems(prev => prev.filter(i => i.id !== item.id));
                                                                } else {
                                                                    const original = originalItems.get(item.id);
                                                                    setItems(prev => prev.map(i =>
                                                                        i.id === item.id
                                                                            ? { ...i, name: original || '', isEditing: false, error: null }
                                                                            : i
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
                                                        onClick={() => handleDeleteClick(item)}
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
                            Page {pagination.page} of {pagination.totalPages} ({pagination.total})
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
                    fetchItems();
                }}
                title="Group"
                placeholder="Enter group name"
                apiEndpoint="/api/sor-groups"
                fieldName="name"
            />

            <Dialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                    </DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to delete <strong>{deleteItem?.name}</strong>? This action cannot be undone.
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
