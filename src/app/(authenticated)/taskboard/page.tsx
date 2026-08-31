'use client';

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { ShoppingCart, Loader2, Edit, Eye, FileText } from 'lucide-react';
import { formatDateDisplay } from '@/lib/date-utils';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
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
    DialogDescription,
} from '@/components/ui/dialog';
import { PurchaseEntryForm } from '@/components/purchase-entries/purchase-entry-form';
import { ProjectForm } from '@/components/projects/project-form';

interface ListProject {
    id: string;
    unique_name: string;
    agreement_no: string | null;
    work_order_date: string | null;
    loa_approved_no: string | null;
    is_completed: boolean;
    correspondence_global_sr_no: number | null;
    _count: {
        purchaseEntries: number;
        correspondence: number;
    };
}

interface DocumentReminder {
    id: string;
    document_name: string;
    expire_date: string;
    reminder_date: string;
    reminder_days_before: number | null;
    reminder_enabled: boolean;
    file: string | null;
}

export default function TaskboardPage() {
    const router = useRouter();
    const [projects, setProjects] = useState<ListProject[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
    const [editingProject, setEditingProject] = useState<any>(null);
    const [editStep, setEditStep] = useState<number>(2);
    const [docReminders, setDocReminders] = useState<DocumentReminder[]>([]);

    const fetchProjects = async () => {
        try {
            const res = await axios.get('/api/projects?limit=9999');
            const data = res.data.data || res.data || [];
            const list = Array.isArray(data) ? data : data.projects || [];
            setProjects(list);
        } catch (err) {
            console.error('Failed to fetch projects', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchDocReminders = async () => {
        try {
            const res = await axios.get('/api/documents?limit=9999');
            const docs = res.data.data || [];
            const today = new Date().toISOString().split('T')[0];
            const active = docs.filter((d: DocumentReminder & { reminder_enabled?: boolean; reminder_date: string }) =>
                d.reminder_enabled !== false && d.reminder_date && d.reminder_date <= today
            );
            setDocReminders(active);
        } catch (err) {
            console.error('Failed to fetch document reminders', err);
        }
    };

    useEffect(() => {
        fetchProjects();
        fetchDocReminders();
    }, []);

    const noPurchaseEntries = useMemo(
        () => projects.filter((p) => p._count?.purchaseEntries === 0),
        [projects]
    );

    const agreementPending = useMemo(
        () =>
            projects.filter(
                (p) =>
                    p._count?.purchaseEntries > 0 &&
                    (!p.agreement_no || !p.work_order_date)
            ),
        [projects]
    );

    const correspondenceList = useMemo(
        () =>
            projects.filter(
                (p) =>
                    !p.is_completed &&
                    (p._count?.purchaseEntries ?? 0) > 0 &&
                    (p._count?.correspondence ?? 0) > 0
            ),
        [projects]
    );

    const handleEdit = async (project: ListProject) => {
        setEditStep(project.agreement_no ? 3 : 2);
        try {
            const res = await axios.get(`/api/projects/${project.id}`);
            if (res.data.success && res.data.data) {
                setEditingProject(res.data.data);
            } else {
                setEditingProject(project);
            }
        } catch {
            setEditingProject(project);
        }
    };

    const handleProjectEditSuccess = () => {
        fetchProjects();
        setEditingProject(null);
    };

    return (
        <div className="space-y-4">
            <h1 className="text-2xl font-bold tracking-tight">Taskboard</h1>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <section className="border rounded-lg p-3 space-y-2">
                        <h2 className="text-base font-semibold">Not Started</h2>
                        {noPurchaseEntries.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                All projects have at least one purchase entry.
                            </p>
                        ) : (
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-full">Unique Name</TableHead>
                                            <TableHead className="text-center">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {noPurchaseEntries.map((project) => (
                                            <TableRow key={project.id}>
                                                <TableCell className="font-medium">
                                                    {project.unique_name}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => setSelectedProjectId(project.id)}
                                                                >
                                                                    <ShoppingCart className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>Create Purchase Entry</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </section>

                    <section className="border rounded-lg p-3 space-y-2">
                        <h2 className="text-base font-semibold">Agreement Formality Pending</h2>
                        {agreementPending.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                All projects have agreement and Work order details are filled.
                            </p>
                        ) : (
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-full">Unique Name</TableHead>
                                            <TableHead className="text-center">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {agreementPending.map((project) => (
                                            <TableRow key={project.id}>
                                                <TableCell className="font-medium">
                                                    {project.unique_name}
                                                </TableCell>
                                                <TableCell className="text-center">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => handleEdit(project)}
                                                                >
                                                                    <Edit className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>Edit Project</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </section>

                    <section className="border rounded-lg p-3 space-y-2">
                        <h2 className="text-base font-semibold">Correspondence</h2>
                        {correspondenceList.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No projects with correspondence records.
                            </p>
                        ) : (
                            <div className="border rounded-lg overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-16 text-center">Sr. No.</TableHead>
                                            <TableHead>Unique Name</TableHead>
                                            <TableHead>Correspondence No.</TableHead>
                                            <TableHead className="text-center">Action</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {correspondenceList.map((project, idx) => (
                                            <TableRow key={project.id}>
                                                <TableCell className="text-center">{idx + 1}</TableCell>
                                                <TableCell className="font-medium">{project.unique_name}</TableCell>
                                                <TableCell>AB-OW/{project.loa_approved_no || '---'}/{project.correspondence_global_sr_no ?? '---'}</TableCell>
                                                <TableCell className="text-center">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => router.push(`/projects/${project.id}/correspondence`)}
                                                                >
                                                                    <Eye className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>View Correspondence</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                    </section>
                </div>

                <section className="space-y-3">
                    <h2 className="text-base font-semibold">Document Reminders</h2>
                    {docReminders.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            No document reminders available.
                        </p>
                    ) : (
                        <div className="border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow className="hover:bg-muted/50 border-b transition-colors">
                                        <TableHead className="h-[40px] px-2 text-left align-middle font-medium whitespace-nowrap">Document Name</TableHead>
                                        <TableHead className="h-[40px] px-2 text-left align-middle font-medium whitespace-nowrap">Expiry Date</TableHead>
                                        <TableHead className="h-[40px] px-2 text-left align-middle font-medium whitespace-nowrap">Reminder Days</TableHead>
                                        <TableHead className="h-[40px] px-2 text-left align-middle font-medium whitespace-nowrap">Remaining Days</TableHead>
                                        <TableHead className="h-[40px] px-2 text-left align-middle font-medium whitespace-nowrap">Status</TableHead>
                                        <TableHead className="h-[40px] px-2 text-center align-middle font-medium whitespace-nowrap">Action</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {docReminders.map((doc) => {
                                        const today = new Date();
                                        today.setHours(0, 0, 0, 0);
                                        const expiry = new Date(doc.expire_date);
                                        expiry.setHours(0, 0, 0, 0);
                                        const diffMs = expiry.getTime() - today.getTime();
                                        const remainingDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

                                        let statusText: string;
                                        if (remainingDays > 0) {
                                            statusText = `Expires in ${remainingDays} days`;
                                        } else if (remainingDays === 0) {
                                            statusText = 'Expires Today';
                                        } else {
                                            statusText = `Expired ${Math.abs(remainingDays)} days ago`;
                                        }

                                        return (
                                            <TableRow key={doc.id} className="hover:bg-muted/50 border-b transition-colors">
                                                <TableCell className="p-2 align-middle whitespace-nowrap font-medium">
                                                    {doc.document_name}
                                                </TableCell>
                                                <TableCell className="p-2 align-middle whitespace-nowrap">
                                                    {formatDateDisplay(doc.expire_date)}
                                                </TableCell>
                                                <TableCell className="p-2 align-middle whitespace-nowrap">
                                                    {doc.reminder_days_before ?? '-'}
                                                </TableCell>
                                                <TableCell className="p-2 align-middle whitespace-nowrap text-red-600 font-semibold">
                                                    {remainingDays}
                                                </TableCell>
                                                <TableCell className="p-2 align-middle whitespace-nowrap text-red-600 font-semibold">
                                                    {statusText}
                                                </TableCell>
                                                <TableCell className="p-2 align-middle whitespace-nowrap text-center">
                                                    <TooltipProvider>
                                                        <Tooltip>
                                                            <TooltipTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    size="icon"
                                                                    onClick={() => router.push(`/documents?edit=${doc.id}`)}
                                                                >
                                                                    <Edit className="h-4 w-4" />
                                                                </Button>
                                                            </TooltipTrigger>
                                                            <TooltipContent>
                                                                <p>Edit Document</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </section>
                </>
            )}

            <Dialog
                open={!!selectedProjectId}
                onOpenChange={(open) => !open && setSelectedProjectId(null)}
            >
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>Add New Purchase Entry</DialogTitle>
                        <DialogDescription>
                            Fill in the details to create a new purchase entry.
                        </DialogDescription>
                    </DialogHeader>
                    <PurchaseEntryForm
                        defaultProjectId={selectedProjectId || undefined}
                        onSuccess={() => {
                            setProjects((prev) =>
                                prev.map((p) =>
                                    p.id === selectedProjectId
                                        ? { ...p, _count: { ...p._count, purchaseEntries: p._count.purchaseEntries + 1 } }
                                        : p
                                )
                            );
                            setSelectedProjectId(null);
                        }}
                        onCancel={() => setSelectedProjectId(null)}
                    />
                </DialogContent>
            </Dialog>

            <Dialog
                open={!!editingProject}
                onOpenChange={(open) => !open && setEditingProject(null)}
            >
                <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Edit Project</DialogTitle>
                        <DialogDescription>
                            Update agreement details for this project.
                        </DialogDescription>
                    </DialogHeader>
                    {editingProject && (
                        <ProjectForm
                            key={editingProject.id}
                            project={editingProject}
                            onSuccess={handleProjectEditSuccess}
                            onCancel={() => setEditingProject(null)}
                            initialWizardStep={editStep}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
