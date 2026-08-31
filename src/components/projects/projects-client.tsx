'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Column, DataTable, DataTableFilter } from '../common';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ProjectForm } from '@/components/projects/project-form';
import { SORManager } from '@/components/common/SORManager';
import { DepartmentManager } from '@/components/common/DepartmentManager';
import { AreaManager } from '@/components/common/AreaManager';
import { WorkTypeManager } from '@/components/common/WorkTypeManager';
import { LocationManager } from '@/components/common/LocationManager';
import { NumberRangeFilter } from '@/components/common/NumberRangeFilter';
import { Plus, MapPin, Edit3, ImagePlus, Printer } from 'lucide-react';
import { formatIndianCurrency } from '@/lib/financial-year';
import { STATUS_LABELS, STATUS_OPTIONS } from '@/lib/constants';
import { ProjectDetailsModal } from '@/components/projects/ProjectDetailsModal';
import { Form3AEditModal } from '@/components/projects/Form3AEditModal';
import { ProjectPhotoUpload } from '@/components/projects/ProjectPhotoUpload';
import { ProjectPhotoPrint } from '@/components/projects/ProjectPhotoPrint';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useSession } from 'next-auth/react';

interface ProjectProgress {
    percentage: number;
    totalQty: number;
    purchasedQty: number;
    totalAmount: number;
    progressiveAmount: number;
    itemName: string;
    uom: string;
    trackedItemsCount?: number;
    hasQtyOverrun?: boolean;
    hasTrackedQtyOverrun?: boolean;
}

interface Project {
    id: string;
    name: string;
    description: string | null;
    location: string | null;
    start_date: string | null;
    end_date: string | null;
    budget: number;
    unique_name: string | null;
    status: string;
    createdAt: string;
    year: string | null;
    tender_notice_no: string | null;
    project_no: string | null;
    work_type: string | null;
    work_type_name?: string | null;
    no_of_locations: number | null;
    time_limit: string | null;
    project_estimation_cost: number | null;
    project_approved_amount: number | null;
    department: string | null;
    loa_approved_no: string | null;
    loa_approved_date: string | null;
    project_end_date: string | null;
    time_limit_unit: string | null;
    work_order_date: string | null;
    main_item_execution_qty: string | null;
    is_completed: boolean;
    retention_money_details: string | null;
    retention_money_details_no: string | null;
    retention_money_details_start_date: string | null;
    retention_money_details_end_date: string | null;
    sd_amount: number | null;
    sd_no: string | null;
    sd_start_date: string | null;
    sd_end_date: string | null;
    locations?: Array<{ id: string; location_id: string; location?: { id: string; name: string } }>;
    documents?: Array<{ id: string; document_type: string; file_url: string; file_name: string; file_size?: number | null }>;
    wizard_step?: number;
    progress_item_id: string | null;
    tender_premium_id: string | null;
    tender_premium_value: string | null;
    tender_premium_type: string | null;
    negotiation_price_id: string | null;
    negotiation_price_value: string | null;
    negotiation_type: string | null;
    negotiationPrice?: { id: string; name: string } | null;
    supervisor: string | null;
    officer: string | null;
    company_name?: string | null;
    work_completion_date?: string | null;
    total_amount: number | null;
    _count?: {
        purchaseEntries: number;
        bankTransactions: number;
        cashTransactions: number;
    };
    sqm: number | null;
    brs: number | null;
    form3a_work_done_figure?: string | null;
    progress?: ProjectProgress | null;
    created_by?: string | null;
    items?: Array<{
        id: string;
        capital_sor_id: string;
        size: string;
        rate: string | number;
        capitalSOR?: {
            id: string;
            item_name: string;
            uom: string;
            currentPrice: string;
        } | null;
    }>;
}

interface Department {
    id: string;
    name: string;
}

export function ProjectsClient() {
    const { data: session } = useSession();
    const currentUserId = (session?.user as any)?.id;
    const [data, setData] = useState<Project[]>([]);
    const [departments, setDepartments] = useState<Department[]>([]);
    const [sorItems, setSorItems] = useState<Array<{ id: string; name: string }>>([]);
    const [areas, setAreas] = useState<Array<{ id: string; title: string }>>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingProject, setEditingProject] = useState<Project | null>(null);
    const [formProgress, setFormProgress] = useState(0);
    const [uniqueName, setUniqueName] = useState('');
    const [uniqueNameError, setUniqueNameError] = useState<string | null>(null);
    const [tenderNoticeNo, setTenderNoticeNo] = useState('');
    const [tenderNoticeNoError, setTenderNoticeNoError] = useState<string | null>(null);
    const [projectName, setProjectName] = useState('');
    const [projectNameError, setProjectNameError] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string[]>([]);
    const [filterSor, setFilterSor] = useState<string[]>([]);
    const [filterDepartment, setFilterDepartment] = useState<string[]>([]);
    const [filterArea, setFilterArea] = useState<string[]>([]);
    const [filterWorkType, setFilterWorkType] = useState<string[]>([]);
    const [filterLocation, setFilterLocation] = useState<string[]>([]);
    const [filterNegotiationPrice, setFilterNegotiationPrice] = useState<string[]>([]);
    const [rangeNegotiationPrice, setRangeNegotiationPrice] = useState<{ min: string; max: string }>({ min: '', max: '' });
    const [workTypes, setWorkTypes] = useState<Array<{ id: string; title: string }>>([]);
    const [negotiationPrices, setNegotiationPrices] = useState<any[]>([]);
    const [locations, setLocations] = useState<any[]>([]);
    const [deleteProject, setDeleteProject] = useState<Project | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [viewLocations, setViewLocations] = useState<string | null>(null);
    const [viewProject, setViewProject] = useState<Project | null>(null);
    const [form3AEditProject, setForm3AEditProject] = useState<Project | null>(null);
    const [existingDraft, setExistingDraft] = useState<Project | null>(null);
    const [photoUploadProject, setPhotoUploadProject] = useState<Project | null>(null);
    const [photoPrintProject, setPhotoPrintProject] = useState<Project | null>(null);

    const [pagination, setPagination] = useState({
        page: 1,
        totalPages: 1,
        total: 0,
    });

    const fetchData = useCallback(async (
        page = 1,
        searchValue = search,
        sort = sortField,
        order = sortOrder,
        pageLimit = limit,
        statusFilter = filterStatus,
        sorFilter = filterSor,
        deptFilter = filterDepartment,
        areaFilter = filterArea,
        workTypeFilter = filterWorkType,
        locationFilter = filterLocation,
        negotiationPriceFilter = filterNegotiationPrice,
        negotiationPriceRange = rangeNegotiationPrice
    ) => {
        try {
            setLoading(true);

            const params = new URLSearchParams();
            params.append('page', page.toString());
            params.append('limit', pageLimit.toString());
            if (searchValue) params.append('search', searchValue);
            if (sort) params.append('sortField', sort);
            if (order) params.append('sortOrder', order);
            if (statusFilter.length > 0) params.append('status', statusFilter.join(','));
            if (sorFilter.length > 0) params.append('sor_id', sorFilter.join(','));
            if (deptFilter.length > 0) params.append('department', deptFilter.join(','));
            if (areaFilter.length > 0) params.append('area', areaFilter.join(','));
            if (workTypeFilter.length > 0) params.append('workType', workTypeFilter.join(','));
            if (locationFilter.length > 0) params.append('location_ids', locationFilter.join(','));
            if (negotiationPriceFilter.length > 0) params.append('negotiation_price_id', negotiationPriceFilter.join(','));
            if (negotiationPriceRange.min) params.append('negotiation_price_min', negotiationPriceRange.min);
            if (negotiationPriceRange.max) params.append('negotiation_price_max', negotiationPriceRange.max);

            const response = await axios.get(`/api/projects?${params.toString()}`);
            setData(response.data.data);
            setPagination({
                page: response.data.pagination.page,
                totalPages: response.data.pagination.pages,
                total: response.data.pagination.total,
            });
        } catch {
            toast.error('Failed to fetch projects');
        } finally {
            setLoading(false);
        }
    }, [search, sortField, sortOrder, limit, filterStatus, filterSor, filterDepartment, filterArea, filterWorkType, filterLocation, filterNegotiationPrice, rangeNegotiationPrice]);

    const fetchWorkTypes = useCallback(async () => {
        try {
            const response = await axios.get('/api/project-work-types?limit=9999');
            if (response.data.success) {
                setWorkTypes(response.data.data);
            }
        } catch {
            console.error('Failed to fetch work types');
        }
    }, []);

    const fetchNegotiationPrices = useCallback(async () => {
        try {
            const response = await axios.get('/api/negotiation-prices?limit=9999');
            if (response.data.success) {
                setNegotiationPrices(response.data.data);
            }
        } catch {
            console.error('Failed to fetch negotiation prices');
        }
    }, []);

    const fetchLocations = useCallback(async () => {
        try {
            const response = await axios.get('/api/locations?limit=9999');
            if (response.data.success) {
                setLocations(response.data.data);
            }
        } catch {
            console.error('Failed to fetch locations');
        }
    }, []);

    const fetchDepartments = useCallback(async () => {
        try {
            const response = await axios.get('/api/departments?limit=9999');
            if (response.data.success) {
                setDepartments(response.data.data);
            }
        } catch {
            console.error('Failed to fetch departments');
        }
    }, []);

    const fetchSorItems = useCallback(async () => {
        try {
            const response = await axios.get('/api/sor-items?limit=9999');
            if (response.data.success) {
                setSorItems(response.data.data);
            }
        } catch {
            console.error('Failed to fetch SOR items');
        }
    }, []);

    const fetchAreas = useCallback(async () => {
        try {
            const response = await axios.get('/api/project-areas?limit=9999');
            if (response.data.success) {
                setAreas(response.data.data);
            }
        } catch {
            console.error('Failed to fetch areas');
        }
    }, []);

    const checkExistingDraft = useCallback(async () => {
        try {
            const response = await axios.get('/api/projects?status=DRAFT&limit=1&sortOrder=asc');
            if (response.data.success && response.data.data && response.data.data.length > 0) {
                const draft = response.data.data[0];
                // Persist the draft ID so handleAdd can use it directly
                // (avoids race between auto-save POST and status-based query)
                localStorage.setItem('project-draft-id', draft.id);
                const fullResponse = await axios.get(`/api/projects/${draft.id}`);
                if (fullResponse.data.success && fullResponse.data.data) {
                    setExistingDraft(fullResponse.data.data);
                } else {
                    setExistingDraft(draft);
                }
            } else {
                setExistingDraft(null);
            }
        } catch {
            setExistingDraft(null);
        }
    }, []);

    useEffect(() => {
        fetchData(1);
    }, [search, sortField, sortOrder, limit, filterStatus, filterSor, filterDepartment, filterArea, filterWorkType, filterLocation, filterNegotiationPrice, rangeNegotiationPrice]);

    useEffect(() => {
        checkExistingDraft();
    }, [checkExistingDraft]);

    useEffect(() => {
        fetchWorkTypes();
        fetchSorItems();
        fetchDepartments();
        fetchAreas();
        fetchNegotiationPrices();
        fetchLocations();
    }, [fetchWorkTypes, fetchNegotiationPrices, fetchLocations]);

    useEffect(() => {
        setUniqueName(editingProject?.unique_name || '');
    }, [editingProject]);

    const handleEdit = async (project: Project) => {
        try {
            const response = await axios.get(`/api/projects/${project.id}`);
            if (response.data.success && response.data.data) {
                setEditingProject(response.data.data);
            } else {
                setEditingProject({ ...project, items: project.items || [] });
            }
        } catch {
            setEditingProject({ ...project, items: project.items || [] });
        }
        setFormProgress(0);
        setModalOpen(true);
    };

    const handleAdd = async () => {
        // Fast path: use existingDraft from checkExistingDraft if already loaded
        if (existingDraft?.status === 'DRAFT') {
            setEditingProject(existingDraft);
            setFormProgress(0);
            setModalOpen(true);
            toast.info('Resuming existing draft project');
            return;
        }
        // Always query API first for the oldest draft
        try {
            const draftResponse = await axios.get('/api/projects?status=DRAFT&limit=1&sortOrder=asc');
            if (draftResponse.data.success && draftResponse.data.data && draftResponse.data.data.length > 0) {
                const draft = draftResponse.data.data[0];
                let draftProject;
                try {
                    const fullResponse = await axios.get(`/api/projects/${draft.id}`);
                    draftProject = fullResponse.data.success ? fullResponse.data.data : draft;
                } catch {
                    draftProject = draft;
                }
                localStorage.setItem('project-draft-id', draft.id);
                setExistingDraft(draftProject);
                setEditingProject(draftProject);
                setFormProgress(0);
                setModalOpen(true);
                toast.info('Resuming existing draft project');
                return;
            }
        } catch {}
        // Fallback: use stored draft ID in case API failed
        const storedDraftId = localStorage.getItem('project-draft-id');
        if (storedDraftId) {
            try {
                const fullResponse = await axios.get(`/api/projects/${storedDraftId}`);
                if (fullResponse.data.success && fullResponse.data.data && fullResponse.data.data.status === 'DRAFT') {
                    setExistingDraft(fullResponse.data.data);
                    setEditingProject(fullResponse.data.data);
                    setFormProgress(0);
                    setModalOpen(true);
                    toast.info('Resuming existing draft project');
                    return;
                }
            } catch {}
            localStorage.removeItem('project-draft-id');
        }
        // Last-resort: auto-save POST might still be in-flight; wait briefly
        // and check localStorage one more time before opening an empty form.
        await new Promise(resolve => setTimeout(resolve, 400));
        const lateId = localStorage.getItem('project-draft-id');
        if (lateId) {
            try {
                const fullResponse = await axios.get(`/api/projects/${lateId}`);
                if (fullResponse.data.success && fullResponse.data.data && fullResponse.data.data.status === 'DRAFT') {
                    setExistingDraft(fullResponse.data.data);
                    setEditingProject(fullResponse.data.data);
                    setFormProgress(0);
                    setModalOpen(true);
                    toast.info('Resuming existing draft project');
                    return;
                }
            } catch {}
            localStorage.removeItem('project-draft-id');
        }
        setExistingDraft(null);
        setEditingProject(null);
        setFormProgress(0);
        setModalOpen(true);
        toast.info('No draft found. Starting new project.');
    };

    const handleView = async (project: Project) => {
        try {
            const response = await axios.get(`/api/projects/${project.id}`);
            if (response.data.success && response.data.data) {
                setViewProject(response.data.data);
            } else {
                setViewProject(project);
            }
        } catch {
            setViewProject(project);
        }
    };

    const handleDelete = (project: Project) => {
        setDeleteProject(project);
    };

    const confirmDelete = async () => {
        if (!deleteProject) return;

        try {
            setDeleteLoading(true);
            await axios.delete(`/api/projects/${deleteProject.id}`);
            toast.success('Project deleted successfully');
            fetchData(pagination.page);
            setDeleteProject(null);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete project');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleClose = () => {
        setModalOpen(false);
        setEditingProject(null);
        fetchData(pagination.page);
        checkExistingDraft();
    };

    const handleSuccess = () => {
        localStorage.removeItem('project-draft-id');
        setModalOpen(false);
        setEditingProject(null);
        setExistingDraft(null);
        fetchData(pagination.page);
        checkExistingDraft();
    };

    const handleProjectUpdate = (updatedProject: any) => {
        setEditingProject(updatedProject);
    };
    const workTypeMap = useMemo(() => {
        const map = new Map<string, string>();
        workTypes.forEach(w => {
            map.set(w.id, w.title);
        });
        return map;
    }, [workTypes]);

    const getWorkTypeName = useCallback(
        (workTypeId: string | null | undefined) => {
            if (!workTypeId) return '-';
            return workTypeMap.get(workTypeId) || workTypeId;
        },
        [workTypeMap]
    );
    const getLocationNames = (locations: any[] | undefined) => {
        if (!locations || locations.length === 0) return '-';
        return locations.map(l => l.location?.name).filter(Boolean);
    };

    const viewLocationsData = viewLocations ? JSON.parse(viewLocations) : null;

    const columns = useMemo<Column<Project>[]>(() => {
        return [
            {
                header: 'Unique Name',
                cell: (project: Project) => (
                    <span className="text-sm min-w-[220px] font-bold">
                        {project.unique_name || '-'}
                    </span>
                ),
            },
            //     accessorKey: 'department',
            //     sortable: true,
            //     cell: (project: Project) => project.department || '-',
            // },
            {
                header: 'Location',
                cell: (project: Project) => {
                    const locNames = getLocationNames(project.locations);
                    if (locNames === '-') return '-';
                    return (
                        <div className="flex flex-col">
                            <span className="text-xs flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                <span>{locNames.length} location(s)</span>
                            </span>
                            <button
                                onClick={() => setViewLocations(JSON.stringify(project.locations))}
                                className="text-xs text-blue-500 hover:text-blue-700 underline text-left"
                            >
                                View
                            </button>
                        </div>
                    );
                },
            },
            {
                header: 'Progress',
                cell: (project: Project) => {
                    if (!project.progress || project.progress.trackedItemsCount === 0) {
                        return (
                            <span className="text-xs text-muted-foreground">-</span>
                        );
                    }
                    const { percentage } = project.progress;
                    const totalSegments = 20;
                    const filled = Math.round((percentage / 100) * totalSegments);
                    return (
                        <div className="flex items-center gap-2 min-w-[120px]">
                            <div className="flex gap-[2px]">
                                {Array.from({ length: totalSegments }).map((_, i) => (
                                    <div
                                        key={i}
                                        className={`h-3 w-3 rounded-[2px] ${i < filled ? 'bg-blue-800' : 'bg-blue-200'}`}
                                    />
                                ))}
                            </div>
                            <span className="text-xs font-medium text-green-600">{percentage}%</span>
                        </div>
                    );
                },
            },
            {
                header: 'Qty',
                cell: (project: Project) => {
                    const totalQty = project.main_item_execution_qty || project.progress?.totalQty?.toString() || '0';
                    const purchasedQty = project.progress?.purchasedQty || 0;
                    const hasOverrun = project.progress?.hasTrackedQtyOverrun;
                    const displayText = `${purchasedQty.toLocaleString('en-IN')} / ${parseFloat(totalQty).toLocaleString('en-IN')}`;
                    return hasOverrun ? (
                        <span className="text-xs tabular-nums rounded-full px-2 py-0.5 bg-red-100 text-red-700">
                            {displayText}
                        </span>
                    ) : (
                        <span className="text-xs tabular-nums rounded-full bg-muted px-2 py-0.5">
                            {displayText}
                        </span>
                    );
                },
            },
            {
                header: 'Supervisor',
                cell: (project: Project) => (
                    <span className="text-xs">{project.supervisor || '-'}</span>
                ),
            },
            {
                header: 'Officer',
                cell: (project: Project) => (
                    <span className="text-xs">{project.officer || '-'}</span>
                ),
            },
            {
                header: 'Financial Summary',
                cell: (project: Project) => {
                    const isCompleted = project.status === 'COMPLETED';
                    const workDoneFigure = project.form3a_work_done_figure;
                    const approvedAmount = project.project_approved_amount ?? 0;
                    const progressiveAmount = project.progress?.progressiveAmount ?? 0;
                    const hasPurchaseEntries = (project._count?.purchaseEntries ?? 0) > 0;
                    return (
                        <div className="flex flex-row items-start justify-between min-w-[160px]">
                            <div className="flex flex-col">
                                {isCompleted && workDoneFigure ? (
                                    <span className="text-xs">
                                        {workDoneFigure}
                                    </span>
                                ) : (
                                    <>
                                        <span className="text-xs">
                                            ₹{formatIndianCurrency(Number(approvedAmount))}
                                        </span>
                                        <span className="text-xs">
                                            ₹{formatIndianCurrency(Number(progressiveAmount))}
                                        </span>
                                    </>
                                )}
                            </div>
                            {hasPurchaseEntries && !isCompleted && (
                                <TooltipProvider>
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <Button
                                                variant="outline"
                                                size="icon"
                                                className="h-6 w-6 flex-shrink-0"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setForm3AEditProject(project);
                                                }}
                                            >
                                                <Edit3 className="h-3 w-3" />
                                            </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>Edit GENERATE 3(A)</p>
                                        </TooltipContent>
                                    </Tooltip>
                                </TooltipProvider>
                            )}
                        </div>
                    );
                },
            },
            {
                header: 'Time Line',
                cell: (project: Project) => {
                    if (!project.project_end_date) return '-';
                    const endDate = new Date(project.project_end_date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    endDate.setHours(0, 0, 0, 0);
                    const diffTime = endDate.getTime() - today.getTime();
                    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

                    const formattedDate = endDate.toLocaleDateString('en-GB').replace(/\//g, '.');

                    let daysText: string;
                    let daysColor: string;
                    if (diffDays < 0) {
                        daysText = `Expired by ${Math.abs(diffDays)} Days`;
                        daysColor = 'text-red-600';
                    } else if (diffDays <= 30) {
                        daysText = `${diffDays} Days Left`;
                        daysColor = 'text-red-600';
                    } else {
                        daysText = `${diffDays} Days Left`;
                        daysColor = 'text-blue-600';
                    }

                    return (
                        <div className="flex flex-col items-center">
                            <span className="text-xs">{formattedDate}</span>
                            <span className={`text-xs ${daysColor}`}>{daysText}</span>
                        </div>
                    );
                },
            },
            {
                header: 'Qty Overrun Status',
                cell: (project: Project) => {
                    const hasOverrun = project.progress?.hasQtyOverrun;
                    return (
                        <span className="text-xs">
                            {hasOverrun ? (
                                <span className="inline-flex flex-col items-center justify-center px-2 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700 text-center leading-tight whitespace-normal">
                                    <span>Purchase quantity exceeds</span>
                                    <span>the estimated project quantity.</span>
                                </span>
                            ) : '-'}
                        </span>
                    );
                },
            },
        ];
    }, [getWorkTypeName]);



    return (
        <div className="flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Projects
                    </h2>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <SORManager onSuccess={fetchSorItems} />
                    <DepartmentManager onSuccess={fetchDepartments} />
                    <AreaManager onSuccess={fetchAreas} />
                    <WorkTypeManager onSuccess={fetchWorkTypes} />
                    <LocationManager onSuccess={fetchLocations} />
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
                onView={handleView}
                onDelete={handleDelete}
                extraActions={(item) => [
                    ...((!item.created_by || item.created_by === currentUserId) ? [{
                        label: 'Upload Project Photos',
                        icon: <ImagePlus className="mr-2 h-4 w-4" />,
                        onClick: () => setPhotoUploadProject(item),
                    }] : []),
                    {
                        label: 'Print Project Images',
                        icon: <Printer className="mr-2 h-4 w-4" />,
                        onClick: () => setPhotoPrintProject(item),
                    },
                ]}
                searchPlaceholder="Search projects..."
                addLabel="Add Project"
                emptyMessage="No projects found."
                getRowClassName={(item) => item.status === 'COMPLETED' ? 'bg-green-100' : item.status === 'NOT_STARTED' ? 'bg-yellow-100' : ''}
                filters={(
                    <div className="flex flex-wrap items-center gap-2 order-[3] w-full sm:w-auto">
                        <DataTableFilter
                            title="Status"
                            options={STATUS_OPTIONS}
                            selectedValues={filterStatus}
                            onChange={(values) => setFilterStatus(values)}
                        />

                        <DataTableFilter
                            title="SOR"
                            options={sorItems.map((sor: any) => ({
                                label: sor.name,
                                value: sor.id,
                            }))}
                            selectedValues={filterSor}
                            onChange={(values) => setFilterSor(values)}
                        />

                        <DataTableFilter
                            title="Department"
                            options={departments.map((dept: any) => ({
                                label: dept.name,
                                value: dept.id,
                            }))}
                            selectedValues={filterDepartment}
                            onChange={(values) => setFilterDepartment(values)}
                        />

                        <DataTableFilter
                            title="Area"
                            options={areas.map((area: any) => ({
                                label: area.title,
                                value: area.id,
                            }))}
                            selectedValues={filterArea}
                            onChange={(values) => setFilterArea(values)}
                        />

                        <DataTableFilter
                            title="Work Type"
                            options={workTypes.map((wt: any) => ({
                                label: wt.title,
                                value: wt.id,
                            }))}
                            selectedValues={filterWorkType}
                            onChange={(values) => setFilterWorkType(values)}
                        />

                        <DataTableFilter
                            title="Location"
                            options={locations.map((loc: any) => ({
                                label: loc.name,
                                value: loc.id,
                            }))}
                            selectedValues={filterLocation}
                            onChange={(values) => setFilterLocation(values)}
                        />

                        {(filterStatus.length > 0 || filterSor.length > 0 || filterDepartment.length > 0 || filterArea.length > 0 || filterWorkType.length > 0 || filterLocation.length > 0) && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setFilterStatus([]);
                                    setFilterSor([]);
                                    setFilterDepartment([]);
                                    setFilterArea([]);
                                    setFilterWorkType([]);
                                    setFilterLocation([]);
                                }}
                                className='inline-flex items-center justify-center whitespace-nowrap font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground rounded-md px-3 text-xs h-[32px] border gap-1.5'
                            >
                                Clear All
                            </Button>
                        )}
                    </div>
                )}
            />

            <Dialog open={modalOpen} onOpenChange={(open) => {
                if (!open) handleClose();
            }}>
                <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto">
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
                            {editingProject ? 'Edit Project' : 'Add New Project'}
                        </DialogTitle>
                        {/* <DialogDescription>
                            {editingProject
                                ? 'Update the project details below.'
                                : 'Fill in the details to create a new project.'}
                        </DialogDescription> */}
                    </DialogHeader>
                    <ProjectForm
                        key={editingProject?.id || 'new'}
                        project={editingProject as any}
                        onSuccess={handleSuccess}
                        onCancel={handleClose}
                        onProjectUpdate={handleProjectUpdate}
                        onProgress={setFormProgress}
                        uniqueName={uniqueName}
                        onUniqueNameChange={setUniqueName}
                        onUniqueNameError={setUniqueNameError}
                        tenderNoticeNo={tenderNoticeNo}
                        onTenderNoticeNoChange={setTenderNoticeNo}
                        onTenderNoticeNoError={setTenderNoticeNoError}
                        projectName={projectName}
                        onProjectNameChange={setProjectName}
                        onProjectNameError={setProjectNameError}
                        allFieldsDisabled={!editingProject && !uniqueName.trim()}
                        initialWizardStep={editingProject?.wizard_step}
                    />
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!deleteProject}
                onOpenChange={(open) => !open && setDeleteProject(null)}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                    </DialogHeader>

                    <DialogDescription className="py-4">
                        Are you sure you want to delete{' '}
                        <strong>{deleteProject?.name}</strong>?
                    </DialogDescription>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteProject(null)}
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

            {/* View Locations Dialog */}
            <Dialog open={!!viewLocations} onOpenChange={() => setViewLocations(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Project Locations</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        {viewLocationsData && viewLocationsData.length > 0 ? (
                            <ul className="space-y-2">
                                {viewLocationsData.map((loc: any, index: number) => (
                                    <li key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                                        <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">
                                            {index + 1}
                                        </span>
                                        <span>{loc.location?.name || 'Unknown'}</span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-muted-foreground">No locations found.</p>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setViewLocations(null)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Project Details Modal */}
            <ProjectDetailsModal
                open={!!viewProject}
                onClose={() => setViewProject(null)}
                project={viewProject as any}
            />
            {form3AEditProject && (
                <Form3AEditModal
                    open
                    onClose={() => setForm3AEditProject(null)}
                    project={form3AEditProject}
                />
            )}

            {photoUploadProject && (
                <ProjectPhotoUpload
                    project={photoUploadProject}
                    onClose={() => setPhotoUploadProject(null)}
                />
            )}

            {photoPrintProject && (
                <ProjectPhotoPrint
                    project={photoPrintProject}
                    onClose={() => setPhotoPrintProject(null)}
                />
            )}
        </div>
    );
}
