'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { DataTable, Column } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { Download, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { formatDateDisplay } from '@/lib/date-utils';

interface Employee {
    id: string;
    name: string;
    employee_code: string;
}

interface PayrollRun {
    id: string;
    process_date: string;
    financial_year?: { name: string };
    period?: { name: string; month: number; year: number; start_date: string; end_date: string };
}

interface PayslipItem {
    id: string;
    payslip_number: string;
    employee_id: string;
    payroll_run_id: string;
    generated_date: string;
    employee?: Employee;
    payroll_run?: PayrollRun;
    payrollItem?: { net_pay: number; gross_salary: number };
    createdAt: string;
}

interface PaginationInfo {
    page: number;
    pages: number;
    total: number;
    limit: number;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export function PayslipsClient({ canCreate = true, canEdit = true, canDelete = true }: { canCreate?: boolean; canEdit?: boolean; canDelete?: boolean }) {
    const router = useRouter();
    const [data, setData] = useState<PayslipItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(10);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [payrollRuns, setPayrollRuns] = useState<PayrollRun[]>([]);
    const [selectedEmployee, setSelectedEmployee] = useState<string>('all');
    const [selectedRun, setSelectedRun] = useState<string>('all');
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1, pages: 1, total: 0, limit: 10,
    });

    const fetchFilters = useCallback(async () => {
        try {
            const [empRes, runRes] = await Promise.all([
                axios.get('/api/hr/employees', { params: { limit: 200 } }),
                axios.get('/api/hr/payroll-runs', { params: { limit: 50 } }),
            ]);
            setEmployees(empRes.data.data || []);
            setPayrollRuns(runRes.data.data || []);
        } catch {
            // non-critical
        }
    }, []);

    useEffect(() => { fetchFilters(); }, [fetchFilters]);

    const fetchData = useCallback(async (page = 1, searchValue = search, pageLimit = limit) => {
        try {
            setLoading(true);
            const params: Record<string, any> = { page, limit: pageLimit, search: searchValue };
            if (selectedEmployee !== 'all') params.employee_id = selectedEmployee;
            if (selectedRun !== 'all') params.payroll_run_id = selectedRun;
            const response = await axios.get('/api/hr/payslips', { params });
            setData(response.data.data);
            setPagination(response.data.pagination);
        } catch {
            toast.error('Failed to fetch payslips');
        } finally {
            setLoading(false);
        }
    }, [search, limit, selectedEmployee, selectedRun]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const formatCurrency = (val: number) => `₹${Number(val).toLocaleString()}`;

    const formatPeriodName = (p: PayrollRun['period']) => {
        if (!p) return '-';
        if (p.month && p.year) return `${MONTHS[p.month - 1]} ${p.year}`;
        return '-';
    };

    const hasFilters = selectedEmployee !== 'all' || selectedRun !== 'all';

    const filterControls = (
        <div className="flex flex-wrap items-center gap-2 order-[3] w-full sm:w-auto">
            <Select
                value={selectedEmployee}
                onValueChange={(value) => {
                    setSelectedEmployee(value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                }}
            >
                <SelectTrigger className="inline-flex items-left justify-start whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5 w-[140px]">
                    <SelectValue placeholder="All Employees" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Employees</SelectItem>
                    {employees.map(emp => (
                        <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                    ))}
                </SelectContent>
            </Select>

            <Select
                value={selectedRun}
                onValueChange={(value) => {
                    setSelectedRun(value);
                    setPagination(prev => ({ ...prev, page: 1 }));
                }}
            >
                <SelectTrigger className="inline-flex items-left justify-start whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border-dashed gap-1.5 w-[180px]">
                    <SelectValue placeholder="All Runs" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Runs</SelectItem>
                    {payrollRuns.map(run => (
                        <SelectItem key={run.id} value={run.id}>
                            {run.financial_year?.name} / {formatPeriodName(run.period)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>

            {hasFilters && (
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        setSelectedEmployee('all');
                        setSelectedRun('all');
                        setPagination(prev => ({ ...prev, page: 1 }));
                    }}
                    className="h-8 px-2 text-muted-foreground"
                >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                </Button>
            )}
        </div>
    );

    const handleDownloadPdf = async (item: PayslipItem) => {
        try {
            const response = await axios.get(`/api/hr/payslips/${item.id}/pdf`, {
                responseType: 'arraybuffer',
            });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `payslip-${item.payslip_number}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch {
            toast.error('Failed to download PDF');
        }
    };

    const columns: Column<PayslipItem>[] = [
        { header: 'Payslip #', accessorKey: 'payslip_number' },
        {
            header: 'Employee',
            accessorKey: 'employee',
            cell: (item) => item.employee?.name || '-',
        },
        {
            header: 'Period',
            accessorKey: 'payroll_run',
            cell: (item) => formatPeriodName(item.payroll_run?.period),
        },
        {
            header: 'Generated',
            accessorKey: 'generated_date',
            cell: (item) => formatDateDisplay(item.generated_date),
        },
        {
            header: 'Net Pay',
            accessorKey: 'payrollItem',
            cell: (item) => <span className="font-medium">{formatCurrency(item.payrollItem?.net_pay || 0)}</span>,
        },
    ];

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 p-2 w-full overflow-hidden">
            <div className="shrink-0">
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Payslips</h2>
                <p className="text-muted-foreground text-sm">View employee payslips</p>
            </div>

            <DataTable
                data={data}
                columns={columns}
                loading={loading}
                pagination={{ page: pagination.page, totalPages: pagination.pages, total: pagination.total, limit: pagination.limit }}
                onPageChange={(page) => fetchData(page, search, limit)}
                onSearch={(value) => setSearch(value)}
                onLimitChange={(newLimit) => { setLimit(newLimit); fetchData(1, search, newLimit); }}
                onView={(item) => router.push(`/hr/payslips/${item.id}`)}
                extraActions={(item) => [
                    { label: 'Download PDF', icon: <Download className="mr-2 h-4 w-4" />, onClick: () => handleDownloadPdf(item) },
                ]}
                searchPlaceholder="Search payslips..."
                filters={filterControls}
            />
        </div>
    );
}
