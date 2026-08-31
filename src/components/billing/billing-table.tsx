'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { DataTable, Column } from '@/components/common/DataTable';
import { Button } from '@/components/ui/button';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

interface Zone {
    id: string;
    name: string;
}

interface BillingData {
    id: string;
    estimation_no: string;
    created_at: string;
    zone_no?: string;
    zoneName?: string;
    oldExpense: number;
    currentExpense: number;
    total_amount: number;
    difference: number;
}

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

export function BillingClient() {
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<BillingData[]>([]);
    const [zones, setZones] = useState<Zone[]>([]);
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [limit, setLimit] = useState(10);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 10 }, (_, i) => ({
        value: String(currentYear - 5 + i),
        label: String(currentYear - 5 + i),
    }));

    const [month, setMonth] = useState<any>();
    const [year, setYear] = useState<any>();
    const [zone, setZone] = useState<any>();

    const fetchBilling = useCallback(async (
        page = 1,
        searchValue = search,
        sort = sortField,
        order = sortOrder,
        pageLimit = limit,
        monthParam = month,
        yearParam = year,
        zoneParam = zone
    ) => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: pageLimit.toString(),
                ...(monthParam && { month: monthParam }),
                ...(yearParam && { year: yearParam }),
                ...(searchValue && { search: searchValue }),
                ...(sort && { sortField: sort }),
                ...(order && { sortOrder: order }),
                ...(zoneParam && { zone: zoneParam }),
            });

            const response = await axios.get(`/api/billing?${params}`);
            if (response.data.success) {
                setData(response.data.data || []);
                setPagination({
                    page: response.data.pagination.page,
                    totalPages: response.data.pagination.pages,
                });
            } else {
                toast.error(response.data.message || 'Failed to fetch billing data');
            }
        } catch (error: any) {
            console.error('Billing fetch error:', error);
            toast.error(error.response?.data?.message || 'Failed to fetch billing data');
        } finally {
            setLoading(false);
        }
    }, [search, sortField, sortOrder, limit, month, year, zone]);

    const fetchZones = useCallback(async () => {
        try {
            const response = await axios.get('/api/zone-masters?limit=999999');
            if (response.data.data) {
                setZones(response.data.data);
            }
        } catch (error) {
            console.error('Failed to fetch zones:', error);
        }
    }, []);

    useEffect(() => {
        fetchZones();
    }, [fetchZones]);

    useEffect(() => {
        fetchBilling(1, search, sortField, sortOrder, limit, month, year, zone);
    }, [month, year, zone]);

    const handleMonthChange = (value: any) => {
        setMonth(value);
    };

    const handleYearChange = (value: any) => {
        setYear(value);
    };

    const handleZoneChange = (value: any) => {
        setZone(value);
    };

    const formatCurrency = (num: number) => {
        return num.toLocaleString("en-IN", { minimumFractionDigits: 2 });
    };

    const columns: Column<BillingData>[] = useMemo(() => [
        {
            header: "Bill Tracking No",
            accessorKey: "estimation_no",
            cell: (item) => (
                <Badge variant="outline" className="font-mono px-1.5 py-0">
                    {item.estimation_no}
                </Badge>
            ),
        },
        {
            header: "Month",
            accessorKey: "created_at",
            cell: (item) => (
                <span className="font-medium">
                    {new Date(item.created_at).toLocaleString("en-US", { month: "long" })}
                </span>
            ),
        },
        {
            header: "Year",
            accessorKey: "created_at",
            cell: (item) => (
                <span>{new Date(item.created_at).getFullYear()}</span>
            ),
        },
        {
            header: 'Zone',
            accessorKey: 'zoneName',
            cell: (item) => <span className="">{item.zone_no || "—"}</span>,
        },
        {
            header: 'Actual',
            accessorKey: 'oldExpense',
            cell: (item) => (
                <span className="text-left block text-muted-foreground">
                    ₹ {formatCurrency(item.oldExpense)}
                </span>
            ),
        },
        {
            header: 'Additional',
            accessorKey: 'currentExpense',
            cell: (item) => (
                <span className="text-left block font-medium">
                    ₹ {formatCurrency(Number(item.total_amount))}
                </span>
            ),
        },
        {
            header: 'Difference',
            accessorKey: 'difference',
            cell: (item) => {
                const diff = item.difference;
                const isPositive = diff > 0;
                const isZero = diff === 0;

                return (
                    <div className="flex items-center justify-start gap-1">
                        {isPositive && <TrendingUp className="h-4 w-4 text-green-500" />}
                        {isZero && <Minus className="h-4 w-4 text-gray-400" />}
                        {diff < 0 && <TrendingDown className="h-4 w-4 text-red-500" />}
                        <span className={`text-right block font-semibold ${isPositive ? 'text-green-600' :
                            isZero ? 'text-gray-500' : 'text-red-600'
                            }`}>
                            {isZero ? '₹ 0.00' : `${isPositive ? '+' : ''}₹ ${formatCurrency(diff)}`}
                        </span>
                    </div>
                );
            },
        },
    ], []);

    const totals = useMemo(() => {
        return data.reduce((acc, item) => ({
            oldExpense: acc.oldExpense + item.oldExpense,
            currentExpense: acc.currentExpense + item.currentExpense,
            difference: acc.difference + item.difference,
        }), { oldExpense: 0, currentExpense: 0, difference: 0 });
    }, [data]);

    const handleClearFilters = () => {
        setMonth("");
        setYear("");
        setZone("");
    };

    const hasActiveFilters = month || year || zone;

    return (
        <div className="flex-1 flex flex-col gap-6">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Billing List</h2>
                </div>
            </div>

            <DataTable
                data={data}
                columns={columns}
                loading={loading}
                pagination={pagination}
                onPageChange={(page) => fetchBilling(page)}
                onSearch={(value) => setSearch(value)}
                onSortChange={(field, order) => {
                    setSortField(field);
                    setSortOrder(order);
                }}
                onLimitChange={(newLimit) => setLimit(newLimit)}
                emptyMessage="No billing data found for the selected filters"
                searchPlaceholder="Search..."
                filters={
                    <div className="flex flex-wrap items-center gap-2 order-[3] w-full sm:w-auto">
                        <Select value={zone} onValueChange={handleZoneChange}>
                            <SelectTrigger className="w-max inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5">
                                <SelectValue placeholder="Zones" />
                            </SelectTrigger>
                            <SelectContent>
                                {zones.map((z) => (
                                    <SelectItem key={z.id} value={z.id}>
                                        {z.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={month} onValueChange={handleMonthChange}>
                            <SelectTrigger className="w-max inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5">
                                <SelectValue placeholder="Month" />
                            </SelectTrigger>
                            <SelectContent>
                                {months.map((m: any) => (
                                    <SelectItem key={m.value} value={m.value}>
                                        {m.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        <Select value={year} onValueChange={handleYearChange}>
                            <SelectTrigger className="w-max inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5">
                                <SelectValue placeholder="Year" />
                            </SelectTrigger>
                            <SelectContent>
                                {yearOptions.map((y) => (
                                    <SelectItem key={y.value} value={y.value}>
                                        {y.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {hasActiveFilters && (
                            <Button variant="outline" size="sm" onClick={handleClearFilters}>
                                Clear Filters
                            </Button>
                        )}
                    </div>
                }
            />
        </div>
    );
}
