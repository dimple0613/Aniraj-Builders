'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Column, DataTable, DataTableFilter } from '../common';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { AttendanceForm } from '@/components/attendance/attendance-form';

interface Attendance {
    id: string;
    sr_no: number;
    attendance_date: string;
    project_id: string | null;
    project?: {
        id: string;
        name: string;
    } | null;
    employees: Array<{
        id: string;
        employee_id: string;
        is_overtime: boolean;
        overtime_hours: string | null;
        wages: number;
        employee: {
            id: string;
            name: string;
        };
    }>;
}

interface Project {
    id: string;
    name: string;
    unique_name?: string | null;
}

interface Employee {
    id: string;
    name: string;
}

export function AttendanceClient() {
    const [data, setData] = useState<Attendance[]>([]);
    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null);
    const [filterProject, setFilterProject] = useState<string[]>([]);
    const [filterEmployee, setFilterEmployee] = useState<string[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [deleteAttendance, setDeleteAttendance] = useState<Attendance | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [formProgress, setFormProgress] = useState(0);

    const [pagination, setPagination] = useState({
        page: 1,
        totalPages: 1,
        total: 0,
    });

    const fetchData = useCallback(async (
        pageNum = 1,
        searchValue = search,
        sort = sortField,
        order = sortOrder,
        pageLimit = limit,
        projectFilter = filterProject,
        employeeFilter = filterEmployee
    ) => {
        try {
            setLoading(true);

            const params = new URLSearchParams();
            params.append('page', pageNum.toString());
            params.append('limit', pageLimit.toString());
            if (searchValue) params.append('search', searchValue);
            if (sort) params.append('sortField', sort);
            if (order) params.append('sortOrder', order);
            if (projectFilter.length > 0) params.append('project_id', projectFilter.join(','));
            if (employeeFilter.length > 0) params.append('employee_id', employeeFilter.join(','));

            const response = await axios.get(`/api/attendance?${params.toString()}`);
            if (response.data.success) {
                setData(response.data.data);
                setPagination({
                    page: response.data.pagination.page,
                    totalPages: response.data.pagination.pages,
                    total: response.data.pagination.total,
                });
            }
        } catch {
            toast.error('Failed to fetch attendance');
        } finally {
            setLoading(false);
        }
    }, [search, sortField, sortOrder, limit, filterProject, filterEmployee]);

    const fetchProjects = useCallback(async () => {
        try {
            const response = await axios.get('/api/projects?limit=9999');
            if (response.data.success) {
                setProjects(response.data.data);
            }
        } catch {
            console.error('Failed to fetch projects');
        }
    }, []);

    const fetchEmployees = useCallback(async () => {
        try {
            const response = await axios.get('/api/employee-management?limit=9999');
            if (response.data.success) {
                setEmployees(response.data.data || []);
            }
        } catch {
            console.error('Failed to fetch employees');
        }
    }, []);

    useEffect(() => {
        fetchProjects();
        fetchEmployees();
    }, [fetchProjects, fetchEmployees]);

    useEffect(() => {
        fetchData(1);
    }, [search, sortField, sortOrder, limit, filterProject, filterEmployee]);

    const handleEdit = async (attendance: Attendance) => {
        try {
            const response = await axios.get(`/api/attendance/${attendance.id}`);
            if (response.data.success && response.data.data) {
                setEditingAttendance(response.data.data);
                setModalOpen(true);
            }
        } catch {
            toast.error('Failed to fetch attendance details');
        }
    };

    const handleAdd = () => {
        setEditingAttendance(null);
        setModalOpen(true);
    };

    const handleDelete = (attendance: Attendance) => {
        setDeleteAttendance(attendance);
    };

    const confirmDelete = async () => {
        if (!deleteAttendance) return;

        try {
            setDeleteLoading(true);
            const response = await axios.delete(`/api/attendance/${deleteAttendance.id}`);
            if (response.data.success) {
                toast.success('Attendance deleted successfully');
                fetchData(pagination.page);
            } else {
                toast.error(response.data.message);
            }
            setDeleteAttendance(null);
        } catch {
            toast.error('Failed to delete attendance');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleSuccess = () => {
        setModalOpen(false);
        setEditingAttendance(null);
        fetchData(pagination.page);
    };

    const handleModalClose = () => {
        setModalOpen(false);
        setEditingAttendance(null);
    };

    const columns = useMemo<Column<Attendance>[]>(() => {
        return [
            {
                header: 'SR No',
                accessorKey: 'sr_no',
                sortable: true,
                cell: (attendance: Attendance) => attendance.sr_no,
            },
            {
                header: 'Date',
                accessorKey: 'attendance_date',
                sortable: true,
                cell: (attendance: Attendance) => (
                    new Date(attendance.attendance_date).toLocaleDateString()
                ),
            },
            {
                header: 'Project',
                accessorKey: 'project',
                cell: (attendance: Attendance) => (<div>{attendance.project?.unique_name || attendance.project?.name || '-'}</div>),
            },
            {
                header: 'Employees',
                accessorKey: 'employees',
                cell: (attendance: Attendance) => (
                    <div className="truncate max-w-[200px]">
                      {attendance.employees?.map(e => e.employee?.name).join(', ') || '-'}
                    </div>
                ),
            },
            {
                header: 'Total Wages',
                accessorKey: 'totalWages',
                cell: (attendance: Attendance) => {
                    const total = attendance.employees?.reduce((sum, emp) => sum + (Number(emp.wages) || 0), 0) || 0;
                    return <span className="font-medium">₹{total.toLocaleString('en-IN')}</span>;
                },
            },
        ];
    }, []);

    return (
        <div className="flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Attendance
                    </h2>
                </div>
            </div>

            <DataTable
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
                onAdd={handleAdd}
                onEdit={handleEdit}
                onDelete={handleDelete}
                searchPlaceholder="Search..."
                addLabel="Add Attendance"
                emptyMessage="No attendance records found."
                filters={(
                    <div className="flex flex-wrap items-center gap-2 order-[3] w-full sm:w-auto">
                        <DataTableFilter
                            title="Project"
                            options={projects.map((p) => ({ label: p.unique_name || p.name, value: p.id }))}
                            selectedValues={filterProject}
                            onChange={(values) => setFilterProject(values)}
                        />
                        <DataTableFilter
                            title="Employee"
                            options={employees.map((e) => ({ label: e.name, value: e.id }))}
                            selectedValues={filterEmployee}
                            onChange={(values) => setFilterEmployee(values)}
                        />

                        {(filterProject.length > 0 || filterEmployee.length > 0) && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setFilterProject([]);
                                    setFilterEmployee([]);
                                }}
                                className='inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border gap-1.5'
                            >
                                Clear All
                            </Button>
                        )}
                    </div>
                )}
            />

            <Dialog open={modalOpen} onOpenChange={(open) => !open && handleModalClose()}>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                    {formProgress ? (
                        <div className="-mx-6">
                            <div className="w-full h-1.5 bg-muted rounded-full bg-red-500 overflow-hidden -mt-[24px]">
                                <div
                                    className="h-full bg-blue-600 transition-all duration-300"
                                    style={{ width: `${formProgress}%` }}
                                />
                            </div>
                        </div>
                    ) : null}
                    <DialogHeader>
                        <DialogTitle>
                            {editingAttendance ? 'Edit Attendance' : 'Add Attendance'}
                        </DialogTitle>
                        <DialogDescription>
                            {editingAttendance
                                ? 'Update the attendance details below.'
                                : 'Fill in the details to mark attendance.'}
                        </DialogDescription>
                    </DialogHeader>
                    <AttendanceForm
                        attendance={editingAttendance}
                        projects={projects}
                        employees={employees}
                        onSuccess={handleSuccess}
                        onCancel={handleModalClose}
                        onProgress={setFormProgress}
                    />
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!deleteAttendance}
                onOpenChange={(open) => !open && setDeleteAttendance(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                    </DialogHeader>

                   <DialogDescription className="py-4">
                        Are you sure you want to delete this attendance record?
                    </DialogDescription>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteAttendance(null)}
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
        </div>
    );
}
