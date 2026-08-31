'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ExcelGrid, InlineRow, ColumnDef } from './ExcelGrid';

interface Unit {
    id: string;
    unit_name: string;
    company_id: string;
    createdAt: string;
    updatedAt: string;
}

interface UnitFormData extends InlineRow<UnitFormData> {
    unit_name: string;
    isNew?: boolean;
}

interface PaginationInfo {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
}

interface InlineUnitManagerProps {
    onSuccess?: () => void;
}

export function InlineUnitManager({ onSuccess }: InlineUnitManagerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1,
        totalPages: 1,
        total: 0,
        limit: 20,
    });

    const [units, setUnits] = useState<UnitFormData[]>([]);

    const fetchUnits = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/units', {
                params: {
                    page: pagination.page,
                    limit: pagination.limit,
                    sortField: 'unit_name',
                    sortOrder: 'asc',
                },
            });

            const data = response.data.data || [];
            const paginationData = response.data.pagination || {};

            const formData: UnitFormData[] = data.map((u: Unit) => ({
                id: u.id,
                unit_name: u.unit_name,
                isNew: false,
            }));

            const hasEmptyRow = formData.length > 0 && 
                formData[formData.length - 1].isNew && 
                !formData[formData.length - 1].unit_name?.trim();

            if (!hasEmptyRow) {
                formData.push(createEmptyRow());
            }

            setUnits(formData);
            setPagination({
                page: paginationData.page || 1,
                totalPages: paginationData.pages || 1,
                total: paginationData.total || 0,
                limit: paginationData.limit || 20,
            });
        } catch {
            toast.error('Failed to fetch units');
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit]);

    useEffect(() => {
        if (isOpen) {
            fetchUnits();
        }
    }, [isOpen, fetchUnits]);

    const createEmptyRow = useCallback((): UnitFormData => {
        return {
            id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            unit_name: '',
            isNew: true,
        };
    }, []);

    const validateUnit = useCallback((unit: UnitFormData, allData: UnitFormData[]): string | null => {
        const name = unit.unit_name?.toString().trim() || '';
        if (!name) return null;
        
        const isDuplicate = allData.some(u => 
            u.unit_name?.toLowerCase() === name.toLowerCase() && 
            u.id !== unit.id
        );
        if (isDuplicate) return 'Duplicate';
        return null;
    }, []);

    const handleSaveRow = useCallback(async (row: UnitFormData): Promise<UnitFormData | null> => {
        const name = row.unit_name?.toString().trim();
        if (!name) return null;

        try {
            if (row.isNew) {
                const response = await axios.post('/api/units', { unit_name: name });
                onSuccess?.();
                return { ...row, ...response.data, isNew: false };
            } else {
                const response = await axios.put(`/api/units/${row.id}`, { unit_name: name });
                onSuccess?.();
                return { ...row, ...response.data };
            }
        } catch (error: unknown) {
            const err = error as any;
            const status = err.response?.status;
            if (status === 409) {
                throw new Error('DUPLICATE');
            } else if (status === 400) {
                throw new Error(err.response?.data?.error || err.response?.data?.message ||  'Invalid');
            } else {
                throw new Error('Failed');
            }
        }
    }, [onSuccess]);

    const handleDeleteRow = useCallback(async (row: UnitFormData) => {
        if (row.isNew) return;
        await axios.delete(`/api/units/${row.id}`);
        onSuccess?.();
    }, [onSuccess]);

    const handlePageChange = useCallback((newPage: number) => {
        setPagination(prev => ({ ...prev, page: newPage }));
    }, []);

    const handleLimitChange = useCallback((newLimit: number) => {
        setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
    }, []);

    const columns: ColumnDef<UnitFormData>[] = [
        {
            key: 'unit_name',
            header: 'Unit Name',
            width: '100%',
            editable: true,
        },
    ];

    return (
        <>
            <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsOpen(true)}
                className="gap-1.5"
            >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                Manage Units
            </Button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div 
                        className="absolute inset-0 bg-black/40" 
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="relative bg-white rounded-lg shadow-xl w-[500px] max-w-[95vw] max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50 rounded-t-lg">
                            <h2 className="text-sm font-semibold text-slate-800">Unit Management</h2>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-slate-200 rounded transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                        </div>
                        
                        <div className="flex-1 min-h-0 overflow-hidden">
                            <ExcelGrid
                                columns={columns}
                                data={units}
                                onDataChange={setUnits}
                                fetchData={fetchUnits}
                                saveRow={handleSaveRow}
                                deleteRow={handleDeleteRow}
                                validateRow={validateUnit}
                                createEmptyRow={createEmptyRow}
                                primaryKey="id"
                                editFieldName="unit_name"
                                placeholder="Enter unit name"
                                pagination={pagination}
                                onPageChange={handlePageChange}
                                onLimitChange={handleLimitChange}
                                loading={loading}
                            />
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
