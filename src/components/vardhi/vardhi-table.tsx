'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { DataTableFilter } from '@/components/common/DataTableFilter';
import {
    Vardhi,
    VardhiFilters
} from '@/types/vardhi';
import { useRouter } from "next/navigation"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { formatIndianCurrency } from '@/lib/financial-year';
import { useSession } from 'next-auth/react';

export function VardhiClient() {
    const { data: session } = useSession();
    const isSuperAdmin = (session?.user as any)?.role === "SuperAdmin";
    const [data, setData] = useState<Vardhi[]>([]);
    const [zones, setZones] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [limit, setLimit] = useState(10);
    const [deleteItem, setDeleteItem] = useState<Vardhi | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const router = useRouter();
    const [workTypes, setWorkTypes] = useState<any[]>([]);
    const [filters, setFilters] = useState<VardhiFilters>({});
    const [pagination, setPagination] = useState({
        page: 1,
        totalPages: 1,
    });
    const [selectedItems, setSelectedItems] = useState<Vardhi[]>([]);
    const [selectedYear, setSelectedYear] = useState<any>();
    const [validationMessage, setValidationMessage] = useState<string>('');

    const fetchData = useCallback(async (
        page = 1,
        searchValue = search,
        sort = sortField,
        order = sortOrder,
        pageLimit = limit,
        currentFilters = filters,
        year = selectedYear
    ) => {
        try {
            setLoading(true);

            const params = new URLSearchParams({
                page: page.toString(),
                limit: pageLimit.toString(),
                ...(searchValue && { search: searchValue }),
                ...(sort && { sortField: sort }),
                ...(order && { sortOrder: order }),
                ...(currentFilters.zone_id && currentFilters.zone_id.length > 0 && {
                    zone_id: currentFilters.zone_id.join(',')
                }),
                ...(currentFilters.item_id && currentFilters.item_id.length > 0 && {
                    item_id: currentFilters.item_id.join(',')
                }),
                ...(currentFilters.date_from && { date_from: currentFilters.date_from }),
                ...(currentFilters.date_to && { date_to: currentFilters.date_to }),
                ...(currentFilters.start_date_from && { start_date_from: currentFilters.start_date_from }),
                ...(currentFilters.start_date_to && { start_date_to: currentFilters.start_date_to }),
                ...(currentFilters.end_date_from && { end_date_from: currentFilters.end_date_from }),
                ...(currentFilters.end_date_to && { end_date_to: currentFilters.end_date_to }),
                ...(currentFilters.month && { month: currentFilters.month }),
                ...(year && { year: year.toString() }),
            });

            const response = await axios.get(`/api/vardhi?${params}`);
            setData(response.data.data);

            setPagination({
                page: response.data.pagination.page,
                totalPages: response.data.pagination.pages,
            });
        } catch (error) {
            toast.error('Failed to fetch vardhi records');
        } finally {
            setLoading(false);
        }
    }, [search, sortField, sortOrder, limit, filters, selectedYear]);

    const fetchZones = async () => {
        try {
            const response = await axios.get('/api/zone-masters?limit=999999');
            setZones(response.data.data || []);
        } catch {
            toast.error('Failed to fetch zones');
        }
    };

    const fetchItems = async () => {
        try {
            const response = await axios.get('/api/item-management?limit=999999');
            setItems(response.data.data || []);
        } catch {
            toast.error('Failed to fetch items');
        }
    };

    const fetchWorkTypes = useCallback(async () => {
        try {
            const response = await axios.get('/api/work-type?limit=9999');
            setWorkTypes(response.data.data || []);
        } catch {
            console.error('Failed to fetch work types');
        }
    }, []);

    useEffect(() => {
        const loadInitialData = async () => {
            await fetchWorkTypes();   // wait
            await fetchData();        // then fetch items

            fetchZones();
            fetchItems();
        };

        loadInitialData();
    }, []);

    useEffect(() => {
        fetchData(1, search, sortField, sortOrder, limit, filters, selectedYear);
    }, [search, sortField, sortOrder, limit, filters, selectedYear]);

    const handleEdit = (item: Vardhi) => {
        router.push(`/vardhi/edit/${item.id}`);
    };

    const handleDelete = (item: Vardhi) => {
        setDeleteItem(item);
    };

    const confirmDelete = async () => {
        if (!deleteItem) return;

        try {
            setDeleteLoading(true);
            await axios.delete(`/api/vardhi/${deleteItem.id}`);
            toast.success('Vardhi deleted successfully');
            fetchData(pagination.page);
            setDeleteItem(null);
        } catch (error: any) {
            toast.error(error.response?.data?.error || 'Failed to delete vardhi');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleAdd = () => {
        router.push(`/vardhi/add`);
    };

    const workTypeMap = useMemo(() => {
        const map: Record<string, string> = {};


        workTypes.forEach(wt => {
            map[String(wt.id)] = wt.name;
        });

        return map;
    }, [workTypes]);


    // const columns: Column<Vardhi>[] = [
    const columns = useMemo<Column<Vardhi>[]>(() => {
        return [
            {
                header: 'Vardhi No',
                accessorKey: 'vardhi_number',
                sortable: true,
                cell: (item) => (
                    <div className='flex flex-col gap-0.5'>
                        <Badge variant="outline" className="font-mono text-xs w-fit">
                            {item.vardhi_number}
                        </Badge>
                        {item.zone_sequence != null && (
                            <Badge variant="outline" className="font-mono text-xs w-fit">
                                {item.zone_sequence}
                            </Badge>
                        )}
                    </div>
                ),
            },
            {
                header: 'Zone / Location',
                accessorKey: 'zone_id',
                sortable: true,
                cellClassName: 'whitespace-normal break-all',
                cell: (item) => (
                    <div className="text-xs">
                        <div className="font-medium">{item.zone?.name || '-'}</div>
                        <div className="text-muted-foreground whitespace-normal">{item.location}</div>
                    </div>
                ),
            },
            {
                header: 'Work Type',
                accessorKey: 'work_type',
                sortable: true,
                cell: (item) => {
                    const wtName = workTypeMap[item.work_type] ?? 'Unknown';
                    return (
                        <Badge variant={'secondary'} className="text-xs">
                            {wtName}
                        </Badge>
                    );
                },
            },
            {
                header: 'Date',
                accessorKey: 'date',
                sortable: true,
                cell: (item) => new Date(item.date).toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                })
            },
            {
                header: 'Items Total',
                accessorKey: 'existing_items_total',
                sortable: true,
                cell: (item) => `₹${formatIndianCurrency(Number(item.existing_items_total))}`,
                hidden: true, // Commented out from list view
            },
            {
                header: 'Additional Total',
                accessorKey: 'additional_items_total',
                sortable: true,
                cell: (item) => `₹${formatIndianCurrency(Number(item.additional_items_total))}`,
                hidden: true, // Commented out from list view
            },
            // {
            //     header: 'Difference',
            //     accessorKey: 'difference_total',
            //     sortable: true,
            //     cell: (item) => {
            //         const diff = parseFloat(item.difference_total || '0');
            //         return (
            //             <span className={diff >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
            //                 {diff >= 0 ? '+' : ''}₹{formatIndianCurrency(Number(diff))}
            //             </span>
            //         );
            //     },
            //     hidden: true, // Commented out from list view
            // },
            {
                header: 'Final Total',
                accessorKey: 'grand_total',
                sortable: true,
                cell: (item) => (
                    <span className="font-semibold">
                        ₹{formatIndianCurrency(Number(item.grand_total))}
                    </span>
                ),
            },
        ];
    }, [workTypeMap, isSuperAdmin]);

    const handleFilterChange = (newFilters: VardhiFilters) => {
        setFilters(newFilters);
    };

    const clearFilters = () => {
        setFilters({});
        setSelectedYear("");
        setValidationMessage('');
    };

    const hasActiveFilters =
        filters.zone_id?.length ||
        filters.item_id?.length ||
        filters.date_from ||
        filters.date_to ||
        filters.start_date_from ||
        filters.start_date_to ||
        filters.end_date_from ||
        filters.end_date_to ||
        filters.month ||
        selectedYear;

    const handleSelectionChange = (items: Vardhi[]) => {
        setSelectedItems(items);
    };

    const handleVardhiEstimation = () => {
        if (selectedItems.length === 0) return;
        const vardhiIds = selectedItems.map(item => item.id).join(',');
        router.push(`/bill-generated/new?vardhi_ids=${vardhiIds}`);
    };
    const months = [
        { value: "January", label: "January" },
        { value: "February", label: "February" },
        { value: "March", label: "March" },
        { value: "April", label: "April" },
        { value: "May", label: "May" },
        { value: "June", label: "June" },
        { value: "July", label: "July" },
        { value: "August", label: "August" },
        { value: "September", label: "September" },
        { value: "October", label: "October" },
        { value: "November", label: "November" },
        { value: "December", label: "December" },
    ];

    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 10 }, (_, i) => ({
        value: String(currentYear - i),
        label: String(currentYear - i),
    }));

    const selectedZone = filters.zone_id?.[0] || '';
    const selectedMonth = filters.month || '';

    const isFormValid = Boolean(selectedZone && selectedMonth);

    const handleGenerateReport = () => {
        if (!selectedZone) {
            setValidationMessage('Please select a Zone');
            return;
        }
        if (!selectedMonth) {
            setValidationMessage('Please select a Month');
            return;
        }

        const yearToUse = selectedYear || currentYear;
        const queryParams = new URLSearchParams({
            zone: selectedZone,
            month: selectedMonth,
            year: String(yearToUse),
        });

        router.push(`/bill-generated/new?${queryParams.toString()}`);
    };

    const handleZoneChange = (values: string[]) => {
        setValidationMessage('');
        handleFilterChange({ ...filters, zone_id: values });
    };

    return (
        <>
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Vardhi
                    </h2>
                </div>
            </div>
            <DataTable
                key={Object.keys(workTypeMap).length}
                data={data}
                columns={columns}
                loading={loading}
                pagination={pagination}
                onPageChange={(page) => fetchData(page)}
                onSearch={(value) => setSearch(value)}
                onSortChange={(field, order) => {
                    setSortField(field);
                    setSortOrder(order);
                }}
                onLimitChange={(newLimit) => setLimit(newLimit)}
                onAdd={(session?.user as any)?.role !== 'Zone' ? handleAdd : undefined}
                onEdit={handleEdit}
                onDelete={(session?.user as any)?.role !== 'Zone' ? handleDelete : undefined}
                filters={
                    <div className="flex flex-wrap items-center gap-2 order-[3] w-full sm:w-auto">
                        <DataTableFilter
                            title="Zone"
                            options={zones.map((zone) => ({
                                label: zone.name,
                                value: zone.id,
                            }))}
                            selectedValues={filters.zone_id || []}
                            onChange={handleZoneChange}
                        />
                        <Select
                            value={String(filters.month ? filters.month : '')}
                            onValueChange={(values) => {
                                setValidationMessage('');
                                handleFilterChange({ ...filters, month: String(values) });
                            }}
                        >
                            <SelectTrigger className="w-max inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5">
                                <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent>
                                {months.map((month) => (
                                    <SelectItem key={month.value} value={month.value}>
                                        {month.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select
                            value={selectedYear}
                            onValueChange={(value) => {
                                setValidationMessage('');
                                setSelectedYear(String(value));
                            }}
                        >
                            <SelectTrigger className="w-max inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5">
                                <SelectValue placeholder="Year" />
                            </SelectTrigger>
                            <SelectContent>
                                {yearOptions.map((year) => (
                                    <SelectItem key={year.value} value={year.value}>
                                        {year.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {validationMessage && (
                            <span className="text-xs text-red-500">{validationMessage}</span>
                        )}

                        {hasActiveFilters && (
                            <Button variant="outline" size="sm" onClick={clearFilters}>
                                Clear Filters
                            </Button>
                        )}
                    </div>
                }
                onEditCondition={(item) => !item.is_in_billing}
                // onEditCondition={(item) => item.is_in_billing  = true}
            />
            <Dialog
                open={!!deleteItem}
                onOpenChange={(open) => {
                    if (!open) setDeleteItem(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                    </DialogHeader>

                    <DialogDescription className="py-4">
                        Are you sure you want to delete{' '}
                        <strong>{deleteItem?.vardhi_number}</strong>?
                        This action cannot be undone and will also delete all associated items.
                    </DialogDescription>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteItem(null)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDelete}
                            disabled={deleteLoading}
                        >
                            {deleteLoading ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
