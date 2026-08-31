'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Eye, FileText, CheckCircle, ChevronDown, ChevronUp, Image, ChevronLeft, ChevronRight, Camera, Pencil, Printer, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface Vardhi {
    id: string;
    vardhi_number: string;
    location: string;
    date: string;
    zone_id: string;
    zone_name?: string;
    work_type?: string;
    vardhi_start_date: string;
    vardhi_end_date: string;
    existing_items_total: string;
    additional_items_total: string;
    grand_total: string;
    difference_total: string;
    is_in_billing?: boolean;
    expenses_total?: string;
    employees_total?: string;
    site_photography?: string | null;
    site_clear_photo?: string | null;
    attachments?: Array<{
        id: string;
        type: string;
        file_path: string;
        file_name: string;
        file_size: number | null;
        mime_type: string | null;
        created_at: string;
    }>;
    groupedAttachments?: Record<string, Array<{
        id: string;
        file_path: string;
        file_name: string;
        file_size: number | null;
        mime_type: string | null;
        created_at: string;
    }>>;
    is_approved?: boolean;
}

interface ZoneSummary {
    zone_id: string;
    zone_name: string;
    zone_file_no: number;
    vardhi_count: number;
    start_date: string;
    end_date: string;
    existing_items_total: string;
    additional_items_total: string;
    difference_total: string;
    grand_total: string;
    expenses_total?: string;
    employees_total?: string;
    is_zone_approved: boolean;
    approved_vardhi_ids: string[];
    vardhis: Vardhi[];
}

const formatDate = (date: Date | string): string => {
    const d = new Date(date);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate().toString().padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
};

const formatCurrency = (value: string | number): string => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? '0.00' : num.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

const buildSequenceNumberMap = (vardhis: Vardhi[]): Record<string, number> => {
    const sequence: Record<string, number> = {};
    const byYear = new Map<number, Vardhi[]>();

    vardhis.forEach(v => {
        const year = new Date(v.date).getFullYear();
        if (!byYear.has(year)) byYear.set(year, []);
        byYear.get(year)!.push(v);
    });

    byYear.forEach(group => {
        group.sort((a, b) => {
            const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return String(a.vardhi_number).localeCompare(String(b.vardhi_number));
        });
        group.forEach((v, index) => {
            sequence[v.id] = index + 1;
        });
    });

    return sequence;
};

export default function VardhiSummaryPage() {
    const router = useRouter();
    const { data: session, status } = useSession();
    const isSuperAdmin = (session?.user as any)?.role === 'SuperAdmin';
    const userRole = (session?.user as any)?.role;
    const [data, setData] = useState<ZoneSummary[]>([]);
    const [workTypes, setWorkTypes] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [pagination, setPagination] = useState({
        page: 1,
        totalPages: 1,
    });

    const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
    const [selectedVardhis, setSelectedVardhis] = useState<Set<string>>(new Set());

    const [viewModalOpen, setViewModalOpen] = useState(false);
    const [viewingZone, setViewingZone] = useState<ZoneSummary | null>(null);

    const [generateModalOpen, setGenerateModalOpen] = useState(false);
    const [generatingZone, setGeneratingZone] = useState<ZoneSummary | null>(null);
    const [generateLoading, setGenerateLoading] = useState(false);

    const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [previewImages, setPreviewImages] = useState<Array<{ url: string; title: string }>>([]);
    const [downloading, setDownloading] = useState<string | null>(null);

    const workTypeMap = useMemo(() => {
        const map: Record<string, string> = {};
        workTypes.forEach(wt => {
            map[String(wt.id)] = wt.name;
        });
        return map;
    }, [workTypes]);

    const fetchWorkTypes = async () => {
        try {
            const response = await axios.get('/api/work-type?limit=9999');
            setWorkTypes(response.data.data || []);
        } catch {
            console.error('Failed to fetch work types');
        }
    };

    useEffect(() => {
        fetchWorkTypes();
    }, []);

    const fetchData = useCallback(async (page = 1) => {
        try {
            setLoading(true);
            const response = await axios.get('/api/vardhi-summary', {
                params: { page, limit: 50 },
            });

            const responseData = response.data.data || [];
            setData(responseData);
            setPagination({
                page: response.data.pagination?.page || 1,
                totalPages: response.data.pagination?.pages || 1,
            });

            if (response.data.success === false) {
                toast.error(response.data.message || 'Failed to fetch vardhi summary');
            }
        } catch (error: any) {
            const errorMsg = error.response?.data?.message || error.response?.data?.error || 'Failed to fetch vardhi summary';
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const toggleZone = (zoneId: string) => {
        const newExpanded = new Set(expandedZones);
        if (newExpanded.has(zoneId)) {
            newExpanded.delete(zoneId);
        } else {
            newExpanded.add(zoneId);
        }
        setExpandedZones(newExpanded);
    };

    const handleSelectAll = (zone: ZoneSummary, checked: boolean) => {
        const newSelected = new Set(selectedVardhis);
        if (checked) {
            zone.vardhis.forEach(v => newSelected.add(v.id));
        } else {
            zone.vardhis.forEach(v => newSelected.delete(v.id));
        }
        setSelectedVardhis(newSelected);
    };

    const handleSelectVardhi = (vardhiId: string, checked: boolean) => {
        const newSelected = new Set(selectedVardhis);
        if (checked) {
            newSelected.add(vardhiId);
        } else {
            newSelected.delete(vardhiId);
        }
        setSelectedVardhis(newSelected);
    };

    const handleView = (zone: ZoneSummary) => {
        setViewingZone(zone);
        setViewModalOpen(true);
    };

    const [approving, setApproving] = useState<string | null>(null);

    const handleApproveZone = async (zone: ZoneSummary) => {
        try {
            setApproving(zone.zone_id);
            const vardhiIds = zone.vardhis.map(v => v.id);
            const response = await axios.put('/api/vardhi/approve', {
                zone_id: zone.zone_id,
                vardhi_ids: vardhiIds,
            });

            if (response.data.success) {
                toast.success('Zone approved successfully');
                // Keep previously approved vardhi ids so existing approvals are never lost
                const mergedApprovedIds = Array.from(new Set([...(zone.approved_vardhi_ids || []), ...vardhiIds]));
                setData(prevData => prevData.map(z =>
                    z.zone_id === zone.zone_id
                        ? { ...z, is_zone_approved: true, approved_vardhi_ids: mergedApprovedIds }
                        : z
                ));
            } else {
                toast.error(response.data.message || 'Failed to approve zone');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to approve zone');
        } finally {
            setApproving(null);
        }
    };

    const handleViewSitePhotography = (vardhi: Vardhi) => {
        const images: Array<{ url: string; title: string }> = [];

        if (vardhi.groupedAttachments?.['site_photography']?.length > 0) {
            vardhi.groupedAttachments['site_photography'].forEach(att => {
                images.push({ url: att.file_path, title: 'Site Photography' });
            });
        } else {
            (vardhi.attachments?.filter(att => att.type === 'site_photography') || []).forEach(att => {
                images.push({ url: att.file_path, title: 'Site Photography' });
            });
        }

        if (images.length > 0) {
            setPreviewImages(images);
            setCurrentImageIndex(0);
            setImagePreviewOpen(true);
        }
    };

    const handleViewSiteClearPhoto = (vardhi: Vardhi) => {
        const images: Array<{ url: string; title: string }> = [];

        if (vardhi.groupedAttachments?.['site_clear_photo']?.length > 0) {
            vardhi.groupedAttachments['site_clear_photo'].forEach(att => {
                images.push({ url: att.file_path, title: 'Site Clear Photo' });
            });
        } else {
            (vardhi.attachments?.filter(att => att.type === 'site_clear_photo') || []).forEach(att => {
                images.push({ url: att.file_path, title: 'Site Clear Photo' });
            });
        }

        if (images.length > 0) {
            setPreviewImages(images);
            setCurrentImageIndex(0);
            setImagePreviewOpen(true);
        }
    };

    const handleGenerate = (zone: ZoneSummary) => {
        if (!zone.is_zone_approved) {
            toast.error('Zone must be approved by Zone Officer before generating billing');
            return;
        }
        setGeneratingZone(zone);
        setSelectedVardhis(new Set(zone.vardhis.map(v => v.id)));
        setGenerateModalOpen(true);
    };

    const confirmGenerate = async () => {
        if (!generatingZone || selectedVardhis.size === 0) {
            toast.error('Please select at least one vardhi');
            return;
        }

        // Verify zone is approved
        if (!generatingZone.is_zone_approved) {
            toast.error('Zone must be approved before generating billing');
            return;
        }

        try {
            setGenerateLoading(true);
            const response = await axios.post('/api/vardhi-summary', {
                zone_id: generatingZone.zone_id,
                vardhi_ids: Array.from(selectedVardhis),
            });
            const vardhiCount = response.data?.data?.vardhiCount || selectedVardhis.size;
            const estimationId = response.data?.data?.estimation?.id;
            toast.success(`Billing generated successfully (${vardhiCount} vardhis)`);
            setGenerateModalOpen(false);
            setSelectedVardhis(new Set());
            fetchData(pagination.page);

            router.push('/bill-generated');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to generate billing');
        } finally {
            setGenerateLoading(false);
        }
    };

    const handlePrintVardhiDetails = async (zone: ZoneSummary) => {
        try {
            setDownloading('vardhi-details');
            toast.info('Preparing Vardhi Details PDF...', {
                description: 'This may take a few seconds. Please do not close the window.'
            });
            const response = await axios.get(`/api/vardhi-summary/${zone.zone_id}/vardhi-details-pdf`, { responseType: 'blob' });
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const pdfUrl = URL.createObjectURL(blob);
            const printWindow = window.open(pdfUrl, '_blank');
            if (printWindow) {
                printWindow.onload = () => {
                    printWindow.focus();
                    setTimeout(() => {
                        printWindow.print();
                    }, 500);
                };
            } else {
                toast.error('Please allow popups to print');
            }
            toast.success('Vardhi Details PDF opened for printing');
        } catch {
            toast.error('Failed to print Vardhi Details');
        } finally {
            setDownloading(null);
        }
    };

    const filteredData = useMemo(() => {
        return data.filter((zone) => zone.vardhi_count > 0);
    }, [data]);

    const grandTotals = useMemo(() => {
        return filteredData.reduce(
            (acc, zone) => {
                acc.vardhiCount += zone.vardhi_count;
                acc.existingTotal += parseFloat(zone.existing_items_total || '0');
                acc.additionalTotal += parseFloat(zone.additional_items_total || '0');
                acc.differenceTotal += parseFloat(zone.difference_total || '0');
                acc.grandTotal += parseFloat(zone.grand_total || '0');
                if (isSuperAdmin) {
                    acc.expensesTotal += parseFloat(zone.expenses_total || '0') + parseFloat(zone.employees_total || '0');
                }
                return acc;
            },
            { vardhiCount: 0, existingTotal: 0, additionalTotal: 0, differenceTotal: 0, grandTotal: 0, expensesTotal: 0 }
        );
    }, [filteredData, isSuperAdmin]);

    const viewingZoneSequence = useMemo(() => {
        if (!viewingZone) return {} as Record<string, number>;
        return buildSequenceNumberMap(viewingZone.vardhis);
    }, [viewingZone]);

    return (
        <>
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Vardhi Summary
                    </h2>
                </div>
            </div>

            <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                {/* <TableHead className="w-[40px]"></TableHead> */}
                                <TableHead>Zone</TableHead>
                                <TableHead className="text-left">No. of Vardhi</TableHead>
                                <TableHead>Start Date</TableHead>
                                <TableHead>End Date</TableHead>
                                <TableHead className="text-right">Work Total</TableHead>
                                <TableHead className="text-right">Additional Total</TableHead>
                                {isSuperAdmin ? <TableHead className="text-right">Expenses</TableHead> : null}
                                <TableHead className="text-right">Final Total</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center">
                                        Loading...
                                    </TableCell>
                                </TableRow>
                            ) : filteredData.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                                        No zones found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                <>
                                    {filteredData.map((zone) => (
                                        <>{/* Using Fragment to avoid key warning */}
                                            <TableRow key={`header-${zone.zone_id}`} >
                                                {/* <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => toggleZone(zone.zone_id)}
                                                    >
                                                        {expandedZones.has(zone.zone_id) ? (
                                                            <ChevronUp className="h-4 w-4" />
                                                        ) : (
                                                            <ChevronDown className="h-4 w-4" />
                                                        )}
                                                    </Button>
                                                </TableCell> */}
                                                <TableCell className="font-medium">
                                                    {zone.zone_name}

                                                </TableCell>
                                                <TableCell className="text-left font-medium">
                                                    {zone.vardhi_count}
                                                </TableCell>
                                                <TableCell>
                                                    {zone.vardhi_count != 0 ? formatDate(zone.start_date) : "-"}
                                                </TableCell>
                                                <TableCell>
                                                    {zone.vardhi_count != 0 ? formatDate(zone.end_date) : "-"}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    ₹{formatCurrency(zone.existing_items_total)}
                                                </TableCell>
                                                <TableCell className="text-right font-medium">
                                                    ₹{formatCurrency(zone.additional_items_total)}
                                                </TableCell>
                                                {isSuperAdmin ? (
                                                    <TableCell className="text-right font-medium">
                                                        ₹{formatCurrency(((parseFloat(zone.expenses_total || '0')) + (parseFloat(zone.employees_total || '0'))).toString())}
                                                    </TableCell>
                                                ) : null}
                                                <TableCell className="text-right font-bold text-green-600">
                                                    ₹{formatCurrency(zone.grand_total)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleView(zone)}
                                                            title="View Details"
                                                        >
                                                            <Eye className="h-4 w-4" />
                                                        </Button>
                                                        {userRole === 'Zone' && !zone.is_zone_approved && zone.vardhi_count > 0 && (
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className={`!text-yellow-600 hover:!text-yellow-700 hover:!bg-yellow-50`}
                                                                onClick={() => handleApproveZone(zone)}
                                                                disabled={approving === zone.zone_id}
                                                                title="Approve Zone"
                                                            >
                                                                {approving === zone.zone_id ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    <CheckCircle className="h-4 w-4" />
                                                                )}
                                                            </Button>
                                                        )}
                                                        {userRole === 'Zone' && zone.is_zone_approved && (
                                                            <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium px-2">
                                                                <CheckCircle className="h-3.5 w-3.5" />
                                                                Approved
                                                            </span>
                                                        )}
                                                        {userRole !== 'Zone' && (
                                                            <TooltipProvider>
                                                                <Tooltip>
                                                                    <TooltipTrigger asChild>
                                                                        <span tabIndex={0} className="inline-flex">
                                                                            <Button
                                                                                variant="ghost"
                                                                                size="icon"
                                                                                onClick={() => handleGenerate(zone)}
                                                                                disabled={!zone.is_zone_approved}
                                                                            >
                                                                                <FileText className="h-4 w-4" />
                                                                            </Button>
                                                                        </span>
                                                                    </TooltipTrigger>
                                                                    <TooltipContent>
                                                                        <p>
                                                                            {zone.is_zone_approved
                                                                                ? 'Generate Billing'
                                                                                : 'Not approved yet'}
                                                                        </p>
                                                                    </TooltipContent>
                                                                </Tooltip>
                                                            </TooltipProvider>
                                                        )}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                            {/* {expandedZones.has(zone.zone_id) && (
                                                <TableRow key={`details-${zone.zone_id}`} className="bg-muted/30">
                                                    <TableCell colSpan={10} className="p-0">
                                                        <div className="p-4">
                                                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Vardhi No.</TableHead>
                                        <TableHead>Zone / Location</TableHead>
                                        <TableHead>Work Type</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Existing</TableHead>
                                        <TableHead className="text-right">Additional</TableHead>
                                        {isSuperAdmin && <TableHead className="text-right">Expenses</TableHead>}
                                        {isSuperAdmin && <TableHead className="text-right">Employees</TableHead>}
                                        <TableHead className="text-right">Difference</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {viewingZone.vardhis.map((vardhi) => (
                                         <TableRow key={vardhi.id}>
                                                 <TableCell className="flex items-center space-x-2">
                                                  <Badge variant="outline" className="font-mono text-xs">
                                                      {vardhi.vardhi_number}
                                                  </Badge>
                                                   {(vardhi.attachments?.some(att => ['site_photography', 'site_clear_photo'].includes(att.type)) || 
                                                     (vardhi.groupedAttachments && 
                                                      (vardhi.groupedAttachments['site_photography']?.length > 0 || 
                                                       vardhi.groupedAttachments['site_clear_photo']?.length > 0))) && (
                                                       <button
                                                           onClick={() => handleViewImages(vardhi)}
                                                           className="p-1 hover:bg-muted rounded"
                                                           title="View Images"
                                                       >
                                                           <Image className="h-4 w-4 text-muted-foreground hover:text-primary" />
                                                       </button>
                                                   )}
                                              </TableCell>
                                            <TableCell className="text-xs">
                                                <div className="font-medium">{vardhi.zone_name || '-'}</div>
                                                <div className="text-muted-foreground">{vardhi.location}</div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={'secondary'} className="text-xs">
                                                    {workTypeMap[vardhi.work_type || ''] || 'Unknown'}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{formatDate(vardhi.date)}</TableCell>
                                            <TableCell className="text-right">
                                                ₹{formatCurrency(vardhi.existing_items_total)}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                ₹{formatCurrency(vardhi.additional_items_total)}
                                            </TableCell>
                                            {isSuperAdmin && (
                                                <TableCell className="text-right">
                                                    ₹{formatCurrency(vardhi.expenses_total || '0')}
                                                </TableCell>
                                            )}
                                            {isSuperAdmin && (
                                                <TableCell className="text-right">
                                                    ₹{formatCurrency(vardhi.employees_total || '0')}
                                                </TableCell>
                                            )}
                                            <TableCell className={`text-right ${parseFloat(vardhi.difference_total) >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}`}>
                                                {parseFloat(vardhi.difference_total) >= 0 ? '+' : ''}₹{formatCurrency(vardhi.difference_total)}
                                            </TableCell>
                                            <TableCell className="text-right font-medium text-green-600">
                                                ₹{formatCurrency(vardhi.grand_total)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                                                            </Table>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            )} */}
                                        </>
                                    ))}
                                    {false && (
                                        <TableRow className="bg-muted/50 font-bold">
                                            <TableCell colSpan={2}>Grand Total</TableCell>
                                            <TableCell className="text-right">{grandTotals.vardhiCount}</TableCell>
                                            <TableCell colSpan={2}></TableCell>
                                            <TableCell className="text-right">₹{formatCurrency(grandTotals.existingTotal)}</TableCell>
                                            <TableCell className="text-right">₹{formatCurrency(grandTotals.additionalTotal)}</TableCell>
                                            <TableCell className="text-right">₹{formatCurrency(grandTotals.expensesTotal || 0)}</TableCell>
                                            <TableCell></TableCell>
                                        </TableRow>
                                    )}
                                </>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>

            <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
                <DialogContent className="max-w-7xl max-h-[80vh] flex flex-col">
                    <DialogHeader className="flex-shrink-0">
                        <DialogTitle>
                            Vardhi Details - {viewingZone?.zone_name}
                        </DialogTitle>
                    </DialogHeader>
                    {viewingZone && (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg flex-shrink-0">
                                <div>
                                    <p className="text-sm text-muted-foreground">Zone File No</p>
                                    <div className="flex items-center gap-2">
                                        <p className="font-medium">{viewingZone.zone_file_no}</p>
                                        {(session?.user as any)?.role === 'Zone' && (
                                            <TooltipProvider>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            onClick={() => handlePrintVardhiDetails(viewingZone)}
                                                            disabled={downloading !== null}
                                                            className="!p-2 !text-blue-500 hover:!text-blue-700 hover:!bg-blue-50 rounded-full transition-all  rounded-md transition-all !bg-blue-90 !text-blue-700 ml-auto mr-[90px]"
                                                          
                                                        >
                                                            {downloading === 'vardhi-details' ? (
                                                                <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                                                            ) : (
                                                                <Image className="h-6 w-6 text-blue-600" />
                                                            )}
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent>
                                                        <p>Photo College</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Vardhi Count</p>
                                    <p className="font-medium">{viewingZone.vardhi_count}</p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Start Date</p>
                                    <p className="font-medium">
                                        {viewingZone.vardhi_count > 0 ? formatDate(viewingZone.start_date) : '-'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">End Date</p>
                                    <p className="font-medium">
                                        {viewingZone.vardhi_count > 0 ? formatDate(viewingZone.end_date) : '-'}
                                    </p>
                                </div>
                            </div>
                            {viewingZone.vardhis.length > 0 ? (
                                <div className="flex-1 overflow-auto pr-2">
                                    <table className="w-full caption-bottom text-sm">
                                        <TableHeader className="sticky top-0 bg-background z-10">
                                            <TableRow>
                                                <TableHead>Vardhi No.</TableHead>
                                                <TableHead>Zone / Location</TableHead>
                                                <TableHead>Work Type</TableHead>
                                                <TableHead>Date</TableHead>
                                                <TableHead className="text-right">Existing</TableHead>
                                                <TableHead className="text-right">Additional</TableHead>
                                                {isSuperAdmin && <TableHead className="text-right">Expenses</TableHead>}
                                                {/* <TableHead className="text-right">Difference</TableHead> */}
                                                <TableHead className="text-right">Total</TableHead>
                                                <TableHead className="text-right">Action</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {viewingZone.vardhis.map((vardhi) => (
                                                <TableRow key={vardhi.id}>
                                                    <TableCell>
                                                        <div className="flex flex-col gap-0.5">
                                                            <div className="flex items-center gap-2">
                                                                <Badge variant="outline" className="font-mono text-xs w-fit">
                                                                    {vardhi.vardhi_number}
                                                                </Badge>
                                                                <div className="flex items-center gap-1">
                                                                    {(vardhi.attachments?.some(att => att.type === 'site_clear_photo') ||
                                                                        (vardhi.groupedAttachments?.['site_clear_photo']?.length > 0)) && (
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <button
                                                                                            onClick={() => handleViewSiteClearPhoto(vardhi)}
                                                                                            className="!p-2 !text-blue-500 hover:!text-blue-700 hover:!bg-blue-50 rounded-full transition-all  rounded-md transition-all !bg-blue-50 !text-blue-700 "
                                                                                        >
                                                                                            <Image className="w-4 h-4 text-blue-600" />
                                                                                        </button>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent>
                                                                                        <p>Site Clear Photo</p>
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        )}
                                                                    {(vardhi.attachments?.some(att => att.type === 'site_photography') ||
                                                                        (vardhi.groupedAttachments?.['site_photography']?.length > 0)) && (
                                                                            <TooltipProvider>
                                                                                <Tooltip>
                                                                                    <TooltipTrigger asChild>
                                                                                        <button
                                                                                            onClick={() => handleViewSitePhotography(vardhi)}
                                                                                            className="!p-2 !text-blue-500 hover:!text-blue-700 hover:!bg-blue-50 rounded-full transition-all  rounded-md transition-all !bg-blue-50 !text-blue-700 "
                                                                                        >
                                                                                            <Camera className="w-4 h-4 text-blue-600" />
                                                                                        </button>
                                                                                    </TooltipTrigger>
                                                                                    <TooltipContent>
                                                                                        <p>Site Photography</p>
                                                                                    </TooltipContent>
                                                                                </Tooltip>
                                                                            </TooltipProvider>
                                                                        )}
                                                                </div>
                                                            </div>
                                                            <Badge variant="outline" className="font-mono text-xs w-fit">
                                                                {viewingZoneSequence[vardhi.id] || '-'}
                                                            </Badge>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="text-xs">
                                                        <div className="font-medium">{vardhi.zone_name || '-'}</div>
                                                        <div className="text-muted-foreground">{vardhi.location}</div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className="text-xs">
                                                            {workTypeMap[vardhi.work_type || ''] || 'Unknown'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>{formatDate(vardhi.date)}</TableCell>
                                                    <TableCell className="text-right">
                                                        ₹{formatCurrency(vardhi.existing_items_total)}
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        ₹{formatCurrency(vardhi.additional_items_total)}
                                                    </TableCell>
                                                    {isSuperAdmin && (
                                                        <TableCell className="text-right">
                                                            ₹{formatCurrency(((parseFloat(vardhi.expenses_total || '0')) + (parseFloat(vardhi.employees_total || '0'))).toString())}
                                                        </TableCell>
                                                    )}
                                                    {/* <TableCell className={`text-right ${parseFloat(vardhi.difference_total) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                                    {parseFloat(vardhi.difference_total) >= 0 ? '+' : ''}₹{formatCurrency(vardhi.difference_total)}
                                                </TableCell> */}
                                                     <TableCell className="text-right font-medium text-green-600">
                                                         ₹{formatCurrency(vardhi.grand_total)}
                                                     </TableCell>
                                                      <TableCell className="text-right">
                                                          <div className="flex items-center justify-end gap-1">
                                                              {!vardhi.is_in_billing && (
                                                                  <Button
                                                                      variant="ghost"
                                                                      size="sm"
                                                                      className="!p-2 !text-blue-500 hover:!text-blue-700 hover:!bg-blue-50 rounded-full transition-all  rounded-md transition-all !bg-blue-50 !text-blue-700 "
                                                                      onClick={(e) => {
                                                                          e.stopPropagation();
                                                                          router.push(`/vardhi/edit/${vardhi.id}`);
                                                                      }}
                                                                  >
                                                                      <Pencil className="w-4 h-4" />
                                                                  </Button>
                                                              )}
                                                         </div>
                                                     </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </table>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    No vardhis available for this zone
                                </div>
                            )}
                        </>
                    )}
                    <DialogFooter className="flex-shrink-0">
                        <Button variant="outline" onClick={() => setViewModalOpen(false)}>
                            Close
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={generateModalOpen} onOpenChange={setGenerateModalOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Generate Billing</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-muted-foreground">
                            Zone: <strong>{generatingZone?.zone_name}</strong>
                        </p>
                        <p className="text-muted-foreground">
                            Selected: <strong>{selectedVardhis.size}</strong> vardhi records
                        </p>
                        <p className="text-sm text-yellow-600">
                            This will mark the selected vardhi records for billing.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setGenerateModalOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={confirmGenerate} disabled={generateLoading}>
                            {generateLoading ? (
                                <>
                                    <CheckCircle className="mr-2 h-4 w-4 animate-spin" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <FileText className="mr-2 h-4 w-4" />
                                    Generate Billing
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
                <DialogContent className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-semibold">Image Preview</h2>
                    </div>
                    {previewImages.length > 0 && (
                        <div className="relative">
                            <img
                                src={previewImages[currentImageIndex].url}
                                alt={previewImages[currentImageIndex].title}
                                className="w-full h-[400px] object-contain rounded-lg border"
                                draggable="false"
                            />
                            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-muted/80 text-black px-3 py-1 rounded text-sm">
                                {previewImages[currentImageIndex].title}
                            </div>
                            {previewImages.length > 1 && (
                                <>
                                    <button
                                        onClick={() => setCurrentImageIndex((prev) => (prev - 1 + previewImages.length) % previewImages.length)}
                                        className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full hover:bg-white/90 transition-colors"
                                        aria-label="Previous image"
                                    >
                                        <ChevronLeft className="h-5 w-5" />
                                    </button>
                                    <button
                                        onClick={() => setCurrentImageIndex((prev) => (prev + 1) % previewImages.length)}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/80 rounded-full hover:bg-white/90 transition-colors"
                                        aria-label="Next image"
                                    >
                                        <ChevronRight className="h-5 w-5" />
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                    {previewImages.length === 0 && (
                        <p className="text-center text-muted-foreground py-8">No images available</p>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
