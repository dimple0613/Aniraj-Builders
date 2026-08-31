'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Column, DataTable, DataTableFilter } from '../common';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Printer, Download } from 'lucide-react';

interface ProjectCostEntry {
    projectId: string;
    projectName: string;
    totalDebit: number;
    totalCredit: number;
    netCost: number;
}

export function ProjectCostReport() {
    const [data, setData] = useState<ProjectCostEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [limit, setLimit] = useState(10);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedProject, setSelectedProject] = useState<string[]>([]);
    const [projectOptions, setProjectOptions] = useState<Array<{ label: string; value: string }>>([]);

    const fetchProjects = useCallback(async () => {
        try {
            const response = await axios.get('/api/projects?limit=9999');
            const projects = response.data.data || response.data;
            setProjectOptions(
                (Array.isArray(projects) ? projects : []).map((p: any) => ({
                    label: p.name,
                    value: p.id,
                }))
            );
        } catch {
            toast.error('Failed to fetch projects');
        }
    }, []);

    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]);

    const fetchReport = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.append('type', 'project-cost');
            params.append('page', page.toString());
            params.append('limit', limit.toString());
            if (search) params.append('search', search);
            if (sortField) params.append('sortField', sortField);
            if (sortOrder) params.append('sortOrder', sortOrder);
            if (startDate) params.append('start_date', startDate);
            if (endDate) params.append('end_date', endDate);
            if (selectedProject.length > 0) params.append('project_ids', selectedProject.join(','));

            const response = await axios.get(`/api/reports?${params.toString()}`);
            setData(response.data.data || []);
            if (response.data.pagination) {
                setPagination({
                    page: response.data.pagination.page,
                    totalPages: response.data.pagination.pages,
                    total: response.data.pagination.total,
                });
            }
        } catch {
            toast.error('Failed to fetch report');
        } finally {
            setLoading(false);
        }
    }, [startDate, endDate, selectedProject, search, sortField, sortOrder, limit]);

    useEffect(() => {
        fetchReport(1);
    }, [startDate, endDate, selectedProject]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchReport(1);
        }, 300);
        return () => clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        fetchReport(1);
    }, [sortField, sortOrder]);

    const handleSearch = (value: string) => {
        setSearch(value);
    };

    const handleSortChange = (field: string, order: 'asc' | 'desc') => {
        setSortField(field);
        setSortOrder(order);
    };

    const handlePageChange = (page: number) => {
        fetchReport(page);
    };

    const handleLimitChange = (newLimit: number) => {
        setLimit(newLimit);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleExport = () => {
        const csvContent = generateCSV();
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `project-cost-report-${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const generateCSV = () => {
        if (data.length === 0) return '';
        const headers = ['Project', 'Total Debit', 'Total Credit', 'Net Cost'];
        const rows = data.map((row) => [
            row.projectName,
            row.totalDebit.toString(),
            row.totalCredit.toString(),
            row.netCost.toString(),
        ].join(','));
        return [headers.join(','), ...rows].join('\n');
    };

    const columns = useMemo<Column<ProjectCostEntry>[]>(() => [
        {
            header: 'Project',
            accessorKey: 'projectName',
            sortable: true,
            cell: (item: ProjectCostEntry) => (
                <div className="flex flex-col">
                    <div className="font-medium truncate max-w-[200px]">{item.projectName}</div>
                </div>
            ),
        },
        {
            header: 'Total Debit',
            accessorKey: 'totalDebit',
            sortable: true,
            cell: (item: ProjectCostEntry) => (
                <span className="text-red-600 font-medium">
                    ₹{item.totalDebit.toLocaleString()}
                </span>
            ),
        },
        {
            header: 'Total Credit',
            accessorKey: 'totalCredit',
            sortable: true,
            cell: (item: ProjectCostEntry) => (
                <span className="text-green-600 font-medium">
                    ₹{item.totalCredit.toLocaleString()}
                </span>
            ),
        },
        {
            header: 'Net Cost',
            accessorKey: 'netCost',
            sortable: true,
            cell: (item: ProjectCostEntry) => (
                <span className={`font-bold ${item.netCost > 0 ? 'text-red-600' : 'text-green-600'}`}>
                    ₹{Math.abs(item.netCost).toLocaleString()}
                </span>
            ),
        },
    ], []);

    const totals = useMemo(() => ({
        totalDebit: data.reduce((sum, item) => sum + (item.totalDebit || 0), 0),
        totalCredit: data.reduce((sum, item) => sum + (item.totalCredit || 0), 0),
        netCost: data.reduce((sum, item) => sum + (item.netCost || 0), 0),
    }), [data]);

    return (
        <div className="flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Project Cost Report
                    </h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-end gap-2">
                        <Button variant="outline" className='inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3 text-xs' onClick={handleExport} disabled={loading || data.length === 0}>
                            <Download className="h-4 w-4" />
                            Export
                        </Button>
                        <Button variant="outline" className='inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground h-8 rounded-md px-3 text-xs' onClick={handlePrint} disabled={loading || data.length === 0}>
                            <Printer className="h-4 w-4" />
                            Print
                        </Button>
                        <Button className='!h-8 rounded-md px-3 text-xs' onClick={() => fetchReport(1)} disabled={loading}>
                            {loading ? 'Loading...' : 'Generate Report'}
                        </Button>
                    </div>
                </div>
            </div>

            {data.length > 0 && (
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-0">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Total Debit</p>
                                <p className="text-2xl font-bold text-red-600">
                                    ₹{totals.totalDebit.toLocaleString()}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Total Credit</p>
                                <p className="text-2xl font-bold text-green-600">
                                    ₹{totals.totalCredit.toLocaleString()}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Net Cost</p>
                                <p className={`text-2xl font-bold ${totals.netCost > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                    ₹{Math.abs(totals.netCost).toLocaleString()}
                                </p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-muted-foreground">Projects</p>
                                <p className="text-2xl font-bold">{pagination.total}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            <DataTable
                data={data as any}
                columns={columns as any}
                loading={loading}
                pagination={pagination}
                onPageChange={handlePageChange}
                onSearch={handleSearch}
                onSortChange={handleSortChange}
                onLimitChange={handleLimitChange}
                searchPlaceholder="Search project costs..."
                emptyMessage="No project cost entries found."
                filters={(
                    <div className="flex flex-wrap items-center gap-2 order-[3] w-full sm:w-auto">
                        <DataTableFilter
                            title="Project"
                            options={projectOptions}
                            selectedValues={selectedProject}
                            onChange={(values) => setSelectedProject(values)}
                        />
                        <div className="space-y-2">

                            <Input
                                type="date"
                                className='inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5'
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">

                            <Input
                                type="date"
                                className='inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5'
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                            />
                        </div>

                        {(selectedProject.length > 0 || startDate || endDate) && (
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedProject([]);
                                        setStartDate('');
                                        setEndDate('');
                                        fetchReport(1);
                                    }}
                                >
                                    Clear Filters
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            />

        </div>
    );
}
