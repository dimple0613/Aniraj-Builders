'use client';

import { useState, useCallback, useRef, useEffect, KeyboardEvent, ReactNode } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export interface InlineRow<T> {
    id: string;
    [key: string]: unknown;
    isNew?: boolean;
    isSaving?: boolean;
    error?: string | null;
}

export interface ColumnDef<T> {
    key: string;
    header: string;
    width?: string;
    editable?: boolean;
    render?: (row: T) => ReactNode;
}

interface PaginationInfo {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
}

interface ExcelGridProps<T extends InlineRow<T>> {
    columns: ColumnDef<T>[];
    data: T[];
    onDataChange: (data: T[]) => void;
    fetchData: () => Promise<void>;
    saveRow: (row: T) => Promise<T | null>;
    deleteRow: (row: T) => Promise<void>;
    validateRow: (row: T, allData: T[]) => string | null;
    createEmptyRow: () => T;
    primaryKey?: string;
    editFieldName: string;
    placeholder?: string;
    pagination: PaginationInfo;
    onPageChange: (page: number) => void;
    onLimitChange: (limit: number) => void;
    loading?: boolean;
}

export function ExcelGrid<T extends InlineRow<T>>({
    columns,
    data,
    onDataChange,
    fetchData,
    saveRow,
    deleteRow,
    validateRow,
    createEmptyRow,
    primaryKey = 'id',
    editFieldName,
    placeholder = 'Enter value',
    pagination,
    onPageChange,
    onLimitChange,
    loading = false,
}: ExcelGridProps<T>) {
    const [editingCell, setEditingCell] = useState<{ id: string; key: string } | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const tableRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (editingCell && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingCell]);

    const getRowId = useCallback((row: T): string => {
        return String(row[primaryKey]);
    }, [primaryKey]);

    const getRowIndex = useCallback((rowId: string): number => {
        return data.findIndex(r => getRowId(r) === rowId);
    }, [data, getRowId]);

    const getEditableColumns = useCallback((): ColumnDef<T>[] => {
        return columns.filter(c => c.editable !== false && c.key !== 'actions');
    }, [columns]);

    const getColumnIndex = useCallback((key: string): number => {
        return getEditableColumns().findIndex(c => c.key === key);
    }, [getEditableColumns]);

    const startEditing = useCallback((id: string, key: string) => {
        setEditingCell({ id, key });
    }, []);

    const focusCell = useCallback((rowIndex: number, colIndex: number) => {
        const editableCols = getEditableColumns();
        if (rowIndex >= 0 && rowIndex < data.length && colIndex >= 0 && colIndex < editableCols.length) {
            const row = data[rowIndex];
            const col = editableCols[colIndex];
            if (row && col) {
                startEditing(getRowId(row), col.key);
            }
        }
    }, [data, getEditableColumns, getRowId, startEditing]);

    const handleKeyDown = useCallback((
        e: KeyboardEvent<HTMLInputElement>,
        row: T,
        cellIndex: number
    ) => {
        const rowId = getRowId(row);
        const rowIndex = getRowIndex(rowId);
        const editableCols = getEditableColumns();
        
        if (e.key === 'Enter' || (e.key === 'Enter' && e.ctrlKey)) {
            e.preventDefault();
            handleSave(row);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            if (e.shiftKey) {
                if (cellIndex > 0) {
                    focusCell(rowIndex, cellIndex - 1);
                } else if (rowIndex > 0) {
                    focusCell(rowIndex - 1, editableCols.length - 1);
                }
            } else {
                if (cellIndex < editableCols.length - 1) {
                    focusCell(rowIndex, cellIndex + 1);
                } else {
                    handleSave(row).then(saved => {
                        if (saved && rowIndex < data.length - 1) {
                            focusCell(rowIndex + 1, 0);
                        } else if (saved) {
                            const newRow = createEmptyRow();
                            onDataChange([...data.filter(r => !r.isNew), newRow]);
                            setTimeout(() => focusCell(data.length, 0), 50);
                        }
                    });
                }
            }
        } else if (e.key === 'Escape') {
            const rowId = getRowId(row);
            if (row.isNew && !String(row[editFieldName] || '').trim()) {
                onDataChange(data.filter(r => getRowId(r) !== rowId));
            }
            setEditingCell(null);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (rowIndex < data.length - 1) {
                focusCell(rowIndex + 1, cellIndex);
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (rowIndex > 0) {
                focusCell(rowIndex - 1, cellIndex);
            }
        } else if (e.key === 'ArrowRight') {
            if (cellIndex < editableCols.length - 1) {
                e.preventDefault();
                focusCell(rowIndex, cellIndex + 1);
            }
        } else if (e.key === 'ArrowLeft') {
            if (cellIndex > 0) {
                e.preventDefault();
                focusCell(rowIndex, cellIndex - 1);
            }
        }
    }, [columns, data, getRowId, getRowIndex, getEditableColumns, focusCell, createEmptyRow, onDataChange, editFieldName]);

    const handleSave = async (row: T): Promise<boolean> => {
        const value = String(row[editFieldName] || '').trim();
        if (!value) {
            if (row.isNew) {
                const rowId = getRowId(row);
                onDataChange(data.filter(r => getRowId(r) !== rowId));
            }
            setEditingCell(null);
            return false;
        }

        const error = validateRow(row, data);
        if (error) {
            toast.error(error);
            return false;
        }

        const rowId = getRowId(row);
        onDataChange(data.map(r => getRowId(r) === rowId ? { ...r, isSaving: true } : r));

        try {
            const saved = await saveRow(row);
            if (saved) {
                await fetchData();
                setEditingCell(null);
                return true;
            }
        } catch (error: unknown) {
            const err = error as { message?: string };
            let errorMsg = err.message || 'Failed to save';
            if (errorMsg === 'DUPLICATE') errorMsg = 'Duplicate entry';
            toast.error(errorMsg);
        } finally {
            onDataChange(data.map(r => getRowId(r) === rowId ? { ...r, isSaving: false } : r));
        }
        return false;
    };

    const handleFieldChange = useCallback((id: string, value: string) => {
        onDataChange(data.map(r => {
            if (getRowId(r) === id) {
                return { ...r, [editFieldName]: value };
            }
            return r;
        }));
    }, [data, editFieldName, onDataChange, getRowId]);

    const handleDelete = async (row: T) => {
        const rowId = getRowId(row);
        
        if (row.isNew) {
            onDataChange(data.filter(r => getRowId(r) !== rowId));
            return;
        }

        onDataChange(data.map(r => getRowId(r) === rowId ? { ...r, isSaving: true } : r));
        
        try {
            await deleteRow(row);
            toast.success('Deleted successfully');
            onDataChange(data.filter(r => getRowId(r) !== rowId));
        } catch {
            toast.error('Failed to delete');
            onDataChange(data.map(r => getRowId(r) === rowId ? { ...r, isSaving: false } : r));
        }
    };

    const handleBlur = useCallback((row: T, value: string) => {
        if (row.isNew && !value.trim()) {
            const rowId = getRowId(row);
            onDataChange(data.filter(r => getRowId(r) !== rowId));
            setEditingCell(null);
        }
    }, [data, onDataChange, getRowId]);

    const editableColumns = columns.filter(c => c.editable !== false && c.key !== 'actions');

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-auto" ref={tableRef}>
                <table className="w-full border-collapse text-sm">
                    <thead className="sticky top-0 bg-slate-50 z-10">
                        <tr>
                            {columns.map(col => (
                                <th
                                    key={col.key}
                                    className="text-left px-2 py-2 font-semibold text-xs border-b border-r bg-slate-100 text-slate-700"
                                    style={{ width: col.width, minWidth: col.width }}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {loading && data.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="h-64 text-center">
                                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-slate-400" />
                                </td>
                            </tr>
                        ) : data.length === 0 ? (
                            <tr>
                                <td colSpan={columns.length} className="h-64 text-center text-slate-400 text-xs">
                                    Type in the last row to add new
                                </td>
                            </tr>
                        ) : (
                            data.map((row) => {
                                const rowId = getRowId(row);
                                const cellIndex = editableColumns.findIndex(c => c.key === editFieldName);

                                return (
                                    <tr
                                        key={rowId}
                                        className={`hover:bg-slate-50 ${row.isNew ? 'bg-slate-50' : ''} ${row.isSaving ? 'opacity-50' : ''}`}
                                    >
                                        {columns.map(col => {
                                            const isEditing = editingCell?.id === rowId && editingCell?.key === col.key;
                                            const value = row[col.key];

                                            if (col.key === 'actions') {
                                                return (
                                                    <td
                                                        key={col.key}
                                                        className="border-b border-r p-0 align-middle text-center"
                                                        style={{ width: '40px', minWidth: '40px' }}
                                                    >
                                                        {row.isSaving ? (
                                                            <div className="flex items-center justify-center h-8">
                                                                <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />
                                                            </div>
                                                        ) : (
                                                            <button
                                                                className="h-8 w-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDelete(row);
                                                                }}
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                                    <path d="M3 6h18"/>
                                                                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                                                                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                                                                </svg>
                                                            </button>
                                                        )}
                                                    </td>
                                                );
                                            }

                                            return (
                                                <td
                                                    key={col.key}
                                                    className="border-b border-r p-0 align-middle"
                                                    style={{ width: col.width, minWidth: col.width }}
                                                >
                                                    {isEditing ? (
                                                        <Input
                                                            ref={inputRef}
                                                            value={value?.toString() || ''}
                                                            onChange={(e) => handleFieldChange(rowId, e.target.value)}
                                                            onKeyDown={(e) => handleKeyDown(e, row, cellIndex)}
                                                            onBlur={() => handleBlur(row, value?.toString() || '')}
                                                            placeholder={placeholder}
                                                            className="h-8 border-0 rounded-none focus:ring-2 focus:ring-blue-500 px-2 text-xs bg-white text-slate-700"
                                                            disabled={row.isSaving}
                                                        />
                                                    ) : (
                                                        <div
                                                            className="px-2 py-1.5 cursor-text min-h-[32px] flex items-center hover:bg-slate-100 text-xs text-slate-700"
                                                            onClick={() => !row.isSaving && startEditing(rowId, col.key)}
                                                        >
                                                            {value ? String(value) : <span className="text-slate-300 italic">Empty</span>}
                                                        </div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <div className="flex items-center justify-between px-3 py-2 border-t bg-slate-50 text-xs">
                <div className="flex items-center gap-2">
                    <select
                        value={pagination.limit}
                        onChange={(e) => onLimitChange(parseInt(e.target.value))}
                        className="h-7 px-2 border rounded text-xs bg-white text-slate-700"
                    >
                        <option value="5">5</option>
                        <option value="10">10</option>
                        <option value="20">20</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                    </select>
                    <span className="text-slate-500">
                        {pagination.page}/{pagination.totalPages} · {pagination.total} rows
                    </span>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => onPageChange(pagination.page - 1)}
                        disabled={pagination.page <= 1}
                        className="h-7 px-2 border rounded text-xs bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-700"
                    >
                        ← Prev
                    </button>
                    <button
                        onClick={() => onPageChange(pagination.page + 1)}
                        disabled={pagination.page >= pagination.totalPages}
                        className="h-7 px-2 border rounded text-xs bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-700"
                    >
                        Next →
                    </button>
                </div>
            </div>
        </div>
    );
}
