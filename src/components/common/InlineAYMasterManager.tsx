'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ExcelGrid, InlineRow, ColumnDef } from './ExcelGrid';

interface AYMaster {
    id: string;
    ay_no: string;
    company_id: string;
    createdAt: string;
    updatedAt: string;
}

interface AYMasterFormData extends InlineRow<AYMasterFormData> {
    ay_no: string;
    isNew?: boolean;
}

interface PaginationInfo {
    page: number;
    totalPages: number;
    total: number;
    limit: number;
}

interface InlineAYMasterManagerProps {
    onSuccess?: () => void;
}

export function InlineAYMasterManager({ onSuccess }: InlineAYMasterManagerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1,
        totalPages: 1,
        total: 0,
        limit: 20,
    });

    const [ayMasters, setAyMasters] = useState<AYMasterFormData[]>([]);

    const fetchAyMasters = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/ay-masters', {
                params: {
                    page: pagination.page,
                    limit: pagination.limit,
                    sortField: 'ay_no',
                    sortOrder: 'asc',
                },
            });

            const data = response.data.data || [];
            const paginationData = response.data.pagination || {};

            const formData: AYMasterFormData[] = data.map((a: AYMaster) => ({
                id: a.id,
                ay_no: a.ay_no,
                isNew: false,
            }));

            const hasEmptyRow = formData.length > 0 &&
                formData[formData.length - 1].isNew &&
                !formData[formData.length - 1].ay_no?.trim();

            if (!hasEmptyRow) {
                formData.push(createEmptyRow());
            }

            setAyMasters(formData);
            setPagination({
                page: paginationData.page || 1,
                totalPages: paginationData.pages || 1,
                total: paginationData.total || 0,
                limit: paginationData.limit || 20,
            });
        } catch {
            toast.error('Failed to fetch AY masters');
        } finally {
            setLoading(false);
        }
    }, [pagination.page, pagination.limit]);

    useEffect(() => {
        if (isOpen) {
            fetchAyMasters();
        }
    }, [isOpen, fetchAyMasters]);

    const createEmptyRow = useCallback((): AYMasterFormData => {
        return {
            id: `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            ay_no: '',
            isNew: true,
        };
    }, []);

    const validateAyMaster = useCallback((ayMaster: AYMasterFormData, allData: AYMasterFormData[]): string | null => {
        const name = ayMaster.ay_no?.toString().trim() || '';
        if (!name) return null;

        const isDuplicate = allData.some(a =>
            a.ay_no?.toLowerCase() === name.toLowerCase() &&
            a.id !== ayMaster.id
        );
        if (isDuplicate) return 'Duplicate';
        return null;
    }, []);

    const handleSaveRow = useCallback(async (row: AYMasterFormData): Promise<AYMasterFormData | null> => {
        const name = row.ay_no?.toString().trim();
        if (!name) return null;

        try {
            if (row.isNew) {
                const response = await axios.post('/api/ay-masters', { ay_no: name });
                onSuccess?.();
                return { ...row, ...response.data, isNew: false };
            } else {
                const response = await axios.put(`/api/ay-masters/${row.id}`, { ay_no: name });
                onSuccess?.();
                return { ...row, ...response.data };
            }
        } catch (error: unknown) {
            const err = error as any;
            const status = err.response?.status;
            if (status === 409) {
                throw new Error('DUPLICATE');
            } else if (status === 400) {
                throw new Error(err.response?.data?.error || err.response?.data?.message || 'Invalid');
            } else {
                throw new Error('Failed');
            }
        }
    }, [onSuccess]);

    const handleDeleteRow = useCallback(async (row: AYMasterFormData) => {
        if (row.isNew) return;
        await axios.delete(`/api/ay-masters/${row.id}`);
        onSuccess?.();
    }, [onSuccess]);

    const handlePageChange = useCallback((newPage: number) => {
        setPagination(prev => ({ ...prev, page: newPage }));
    }, []);

    const handleLimitChange = useCallback((newLimit: number) => {
        setPagination(prev => ({ ...prev, limit: newLimit, page: 1 }));
    }, []);

    const columns: ColumnDef<AYMasterFormData>[] = [
        {
            key: 'ay_no',
            header: 'AY Number',
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
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                Manage AY
            </Button>

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    <div
                        className="absolute inset-0 bg-black/40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="relative bg-white rounded-lg shadow-xl w-[500px] max-w-[95vw] max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between px-4 py-3 border-b bg-slate-50 rounded-t-lg">
                            <h2 className="text-sm font-semibold text-slate-800">AY Master Management</h2>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-1 hover:bg-slate-200 rounded transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                            </button>
                        </div>

                        <div className="flex-1 min-h-0 overflow-hidden">
                            <ExcelGrid
                                columns={columns}
                                data={ayMasters}
                                onDataChange={setAyMasters}
                                fetchData={fetchAyMasters}
                                saveRow={handleSaveRow}
                                deleteRow={handleDeleteRow}
                                validateRow={validateAyMaster}
                                createEmptyRow={createEmptyRow}
                                primaryKey="id"
                                editFieldName="ay_no"
                                placeholder="Enter AY number"
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
