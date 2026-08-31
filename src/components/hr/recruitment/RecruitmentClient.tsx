'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { DataTable, Column } from '@/components/common/DataTable';
import { FormModal } from '@/components/common/FormModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Job {
    id: string;
    title: string;
    department: string | null;
    vacancy: number;
    experience: string | null;
    salary_range: string | null;
    location: string | null;
    status: 'OPEN' | 'CLOSED' | 'DRAFT';
    createdAt: string;
    updatedAt: string;
}

interface Candidate {
    id: string;
    name: string;
    job_id: string | null;
    email: string | null;
    phone: string | null;
    resume: string | null;
    status: 'APPLIED' | 'NEW' | 'REVIEWING' | 'SHORTLISTED' | 'INTERVIEWED' | 'OFFERED' | 'HIRED' | 'REJECTED';
    createdAt: string;
    updatedAt: string;
    job?: {
        id: string;
        title: string;
    };
}

interface PaginationInfo {
    page: number;
    pages: number;
    total: number;
    limit: number;
}

const jobValidationSchema = Yup.object({
    title: Yup.string().trim().required('Title is required'),
    department: Yup.string().nullable(),
    vacancy: Yup.number().integer().min(1).default(1),
    experience: Yup.string().nullable(),
    salary_range: Yup.string().nullable(),
    location: Yup.string().nullable(),
    status: Yup.string().oneOf(['OPEN', 'CLOSED', 'DRAFT']).default('OPEN'),
});

const candidateValidationSchema = Yup.object({
    name: Yup.string().trim().required('Name is required'),
    job_id: Yup.string().nullable(),
    email: Yup.string().email('Invalid email').nullable(),
    phone: Yup.string().nullable(),
    status: Yup.string().oneOf(['APPLIED', 'NEW', 'REVIEWING', 'SHORTLISTED', 'INTERVIEWED', 'OFFERED', 'HIRED', 'REJECTED']).default('APPLIED'),
});

const statusBadgeClass = (status: string) => {
    switch (status) {
        case 'OPEN':
        case 'HIRED':
            return 'bg-green-100 text-green-800 hover:bg-green-100';
        case 'CLOSED':
        case 'REJECTED':
            return 'bg-red-100 text-red-800 hover:bg-red-100';
        case 'DRAFT':
        case 'APPLIED':
            return 'bg-gray-100 text-gray-800 hover:bg-gray-100';
        case 'REVIEWING':
        case 'INTERVIEWED':
            return 'bg-blue-100 text-blue-800 hover:bg-blue-100';
        case 'SHORTLISTED':
        case 'OFFERED':
            return 'bg-purple-100 text-purple-800 hover:bg-purple-100';
        case 'NEW':
            return 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100';
        default:
            return '';
    }
};

interface RecruitmentClientProps {
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
}

export function RecruitmentClient({ canCreate = true, canEdit = true, canDelete = true }: RecruitmentClientProps) {
    const [activeSection, setActiveSection] = useState<'jobs' | 'candidates'>('jobs');

    // Jobs state
    const [jobs, setJobs] = useState<Job[]>([]);
    const [jobsLoading, setJobsLoading] = useState(false);
    const [jobsSearch, setJobsSearch] = useState('');
    const [jobsLimit, setJobsLimit] = useState(10);
    const [jobsPagination, setJobsPagination] = useState<PaginationInfo>({ page: 1, pages: 1, total: 0, limit: 10 });
    const [jobModalOpen, setJobModalOpen] = useState(false);
    const [editingJob, setEditingJob] = useState<Job | null>(null);
    const [deleteJob, setDeleteJob] = useState<Job | null>(null);
    const [deleteJobLoading, setDeleteJobLoading] = useState(false);

    // Candidates state
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [candidatesLoading, setCandidatesLoading] = useState(false);
    const [candidatesSearch, setCandidatesSearch] = useState('');
    const [candidatesLimit, setCandidatesLimit] = useState(10);
    const [candidatesPagination, setCandidatesPagination] = useState<PaginationInfo>({ page: 1, pages: 1, total: 0, limit: 10 });
    const [candidateModalOpen, setCandidateModalOpen] = useState(false);
    const [editingCandidate, setEditingCandidate] = useState<Candidate | null>(null);
    const [deleteCandidate, setDeleteCandidate] = useState<Candidate | null>(null);
    const [deleteCandidateLoading, setDeleteCandidateLoading] = useState(false);

    // Dropdown data
    const [jobsForDropdown, setJobsForDropdown] = useState<Job[]>([]);

    const fetchDropdownData = useCallback(async () => {
        try {
            const res = await axios.get('/api/hr/jobs?limit=100');
            setJobsForDropdown(res.data.data || []);
        } catch {
            toast.error('Failed to load jobs');
        }
    }, []);

    useEffect(() => {
        fetchDropdownData();
    }, [fetchDropdownData]);

    // Job formik
    const jobFormik = useFormik({
        initialValues: {
            title: '',
            department: '',
            vacancy: 1,
            experience: '',
            salary_range: '',
            location: '',
            status: 'OPEN' as string,
        },
        validationSchema: jobValidationSchema,
        validateOnChange: true,
        validateOnBlur: true,
        enableReinitialize: true,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            try {
                if (editingJob) {
                    await axios.put(`/api/hr/jobs/${editingJob.id}`, values);
                    toast.success('Job updated successfully');
                } else {
                    await axios.post('/api/hr/jobs', values);
                    toast.success('Job created successfully');
                }
                setJobModalOpen(false);
                setEditingJob(null);
                resetForm();
                fetchJobs(jobsPagination.page);
                fetchDropdownData();
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save job');
            } finally {
                setSubmitting(false);
            }
        },
    });

    // Candidate formik
    const candidateFormik = useFormik({
        initialValues: {
            name: '',
            job_id: '',
            email: '',
            phone: '',
            status: 'APPLIED' as string,
        },
        validationSchema: candidateValidationSchema,
        validateOnChange: true,
        validateOnBlur: true,
        enableReinitialize: true,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            try {
                if (editingCandidate) {
                    await axios.put(`/api/hr/candidates/${editingCandidate.id}`, values);
                    toast.success('Candidate updated successfully');
                } else {
                    await axios.post('/api/hr/candidates', values);
                    toast.success('Candidate created successfully');
                }
                setCandidateModalOpen(false);
                setEditingCandidate(null);
                resetForm();
                fetchCandidates(candidatesPagination.page);
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save candidate');
            } finally {
                setSubmitting(false);
            }
        },
    });

    const fetchJobs = useCallback(async (page = 1, searchValue = jobsSearch, pageLimit = jobsLimit) => {
        try {
            setJobsLoading(true);
            const response = await axios.get('/api/hr/jobs', {
                params: { page, limit: pageLimit, search: searchValue },
            });
            setJobs(response.data.data);
            setJobsPagination(response.data.pagination);
        } catch {
            toast.error('Failed to fetch jobs');
        } finally {
            setJobsLoading(false);
        }
    }, [jobsSearch, jobsLimit]);

    const fetchCandidates = useCallback(async (page = 1, searchValue = candidatesSearch, pageLimit = candidatesLimit) => {
        try {
            setCandidatesLoading(true);
            const response = await axios.get('/api/hr/candidates', {
                params: { page, limit: pageLimit, search: searchValue },
            });
            setCandidates(response.data.data);
            setCandidatesPagination(response.data.pagination);
        } catch {
            toast.error('Failed to fetch candidates');
        } finally {
            setCandidatesLoading(false);
        }
    }, [candidatesSearch, candidatesLimit]);

    useEffect(() => { fetchJobs(); }, [fetchJobs]);
    useEffect(() => { fetchCandidates(); }, [fetchCandidates]);

    const jobProgress = useMemo(() => {
        const fields = [jobFormik.values.title, jobFormik.values.department, jobFormik.values.vacancy, jobFormik.values.experience, jobFormik.values.salary_range, jobFormik.values.location, jobFormik.values.status];
        const filled = fields.filter((v) => v && String(v).trim() !== '').length;
        return Math.round((filled / fields.length) * 100);
    }, [jobFormik.values]);

    const candidateProgress = useMemo(() => {
        const fields = [candidateFormik.values.name, candidateFormik.values.job_id, candidateFormik.values.email, candidateFormik.values.phone, candidateFormik.values.status];
        const filled = fields.filter((v) => v && String(v).trim() !== '').length;
        return Math.round((filled / fields.length) * 100);
    }, [candidateFormik.values]);

    const handleEditJob = (item: Job) => {
        setEditingJob(item);
        jobFormik.resetForm({
            values: {
                title: item.title,
                department: item.department || '',
                vacancy: item.vacancy,
                experience: item.experience || '',
                salary_range: item.salary_range || '',
                location: item.location || '',
                status: item.status,
            },
        });
        setJobModalOpen(true);
    };

    const handleDeleteJob = async () => {
        if (!deleteJob) return;
        try {
            setDeleteJobLoading(true);
            const response = await axios.delete(`/api/hr/jobs/${deleteJob.id}`);
            toast.success(response.data.message || 'Job deleted successfully');
            setDeleteJob(null);
            fetchJobs(jobsPagination.page);
            fetchDropdownData();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete job');
        } finally {
            setDeleteJobLoading(false);
        }
    };

    const handleAddJob = () => {
        setEditingJob(null);
        jobFormik.resetForm({
            values: { title: '', department: '', vacancy: 1, experience: '', salary_range: '', location: '', status: 'OPEN' },
        });
        setJobModalOpen(true);
    };

    const handleEditCandidate = (item: Candidate) => {
        setEditingCandidate(item);
        candidateFormik.resetForm({
            values: {
                name: item.name,
                job_id: item.job_id || '',
                email: item.email || '',
                phone: item.phone || '',
                status: item.status,
            },
        });
        setCandidateModalOpen(true);
    };

    const handleDeleteCandidate = async () => {
        if (!deleteCandidate) return;
        try {
            setDeleteCandidateLoading(true);
            const response = await axios.delete(`/api/hr/candidates/${deleteCandidate.id}`);
            toast.success(response.data.message || 'Candidate deleted successfully');
            setDeleteCandidate(null);
            fetchCandidates(candidatesPagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete candidate');
        } finally {
            setDeleteCandidateLoading(false);
        }
    };

    const handleAddCandidate = () => {
        setEditingCandidate(null);
        candidateFormik.resetForm({
            values: { name: '', job_id: '', email: '', phone: '', status: 'APPLIED' },
        });
        setCandidateModalOpen(true);
    };

    const jobColumns: Column<Job>[] = [
        { header: 'Title', accessorKey: 'title', sortable: true },
        {
            header: 'Department',
            accessorKey: 'department',
            cell: (item) => item.department || '-',
        },
        { header: 'Vacancy', accessorKey: 'vacancy' },
        {
            header: 'Location',
            accessorKey: 'location',
            cell: (item) => item.location || '-',
        },
        {
            header: 'Status',
            accessorKey: 'status',
            cell: (item) => (
                <Badge variant="outline" className={statusBadgeClass(item.status)}>
                    {item.status}
                </Badge>
            ),
        },
    ];

    const candidateColumns: Column<Candidate>[] = [
        { header: 'Name', accessorKey: 'name', sortable: true },
        {
            header: 'Job',
            accessorKey: 'job',
            cell: (item) => item.job?.title || '-',
        },
        { header: 'Email', accessorKey: 'email', cell: (item) => item.email || '-' },
        { header: 'Phone', accessorKey: 'phone', cell: (item) => item.phone || '-' },
        {
            header: 'Status',
            accessorKey: 'status',
            cell: (item) => (
                <Badge variant="outline" className={statusBadgeClass(item.status)}>
                    {item.status}
                </Badge>
            ),
        },
    ];

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 p-2 md:p-6 w-full overflow-hidden">
            <div className="shrink-0">
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Recruitment</h2>
                <p className="text-muted-foreground text-sm">Manage job postings and candidates</p>
            </div>

            <div className="flex gap-2 border-b pb-2">
                <Button
                    variant={activeSection === 'jobs' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveSection('jobs')}
                >
                    Jobs
                </Button>
                <Button
                    variant={activeSection === 'candidates' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setActiveSection('candidates')}
                >
                    Candidates
                </Button>
            </div>

            {activeSection === 'jobs' && (
                <DataTable
                    data={jobs}
                    columns={jobColumns}
                    loading={jobsLoading}
                    pagination={{
                        page: jobsPagination.page,
                        totalPages: jobsPagination.pages,
                        total: jobsPagination.total,
                        limit: jobsPagination.limit,
                    }}
                    onPageChange={(page) => fetchJobs(page, jobsSearch, jobsLimit)}
                    onSearch={(value) => setJobsSearch(value)}
                    onLimitChange={(newLimit) => {
                        setJobsLimit(newLimit);
                        fetchJobs(1, jobsSearch, newLimit);
                    }}
                    onAdd={canCreate ? handleAddJob : undefined}
                    onEdit={canEdit ? handleEditJob : undefined}
                    onDelete={canDelete ? (item) => setDeleteJob(item) : undefined}
                    searchPlaceholder="Search jobs..."
                    addLabel="Add Job"
                />
            )}

            {activeSection === 'candidates' && (
                <DataTable
                    data={candidates}
                    columns={candidateColumns}
                    loading={candidatesLoading}
                    pagination={{
                        page: candidatesPagination.page,
                        totalPages: candidatesPagination.pages,
                        total: candidatesPagination.total,
                        limit: candidatesPagination.limit,
                    }}
                    onPageChange={(page) => fetchCandidates(page, candidatesSearch, candidatesLimit)}
                    onSearch={(value) => setCandidatesSearch(value)}
                    onLimitChange={(newLimit) => {
                        setCandidatesLimit(newLimit);
                        fetchCandidates(1, candidatesSearch, newLimit);
                    }}
                    onAdd={canCreate ? handleAddCandidate : undefined}
                    onEdit={canEdit ? handleEditCandidate : undefined}
                    onDelete={canDelete ? (item) => setDeleteCandidate(item) : undefined}
                    searchPlaceholder="Search candidates..."
                    addLabel="Add Candidate"
                />
            )}

            {/* Job Modal */}
            <FormModal
                title={editingJob ? 'Edit Job' : 'Add Job'}
                isOpen={jobModalOpen}
                onClose={() => {
                    setJobModalOpen(false);
                    setEditingJob(null);
                    jobFormik.resetForm();
                }}
                loading={jobFormik.isSubmitting}
                submitLabel={editingJob ? 'Update' : 'Create'}
                size="lg"
                progress={jobProgress}
            >
                <form onSubmit={jobFormik.handleSubmit} className="space-y-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="job_title">Title *</Label>
                        <Input id="job_title" {...jobFormik.getFieldProps('title')} placeholder="e.g., Software Engineer" />
                        {jobFormik.touched.title && jobFormik.errors.title && (
                            <p className="text-sm text-destructive">{jobFormik.errors.title}</p>
                        )}
                    </div>

                    <div className="space-y-2 relative">
                        <Label htmlFor="job_department">Department</Label>
                        <Input id="job_department" {...jobFormik.getFieldProps('department')} placeholder="e.g., Engineering" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="job_vacancy">Vacancies *</Label>
                            <Input id="job_vacancy" type="number" min={1} {...jobFormik.getFieldProps('vacancy')} />
                            {jobFormik.touched.vacancy && jobFormik.errors.vacancy && (
                                <p className="text-sm text-destructive">{jobFormik.errors.vacancy}</p>
                            )}
                        </div>

                        <div className="space-y-2 relative">
                            <Label htmlFor="job_location">Location</Label>
                            <Input id="job_location" {...jobFormik.getFieldProps('location')} placeholder="e.g., Remote" />
                        </div>
                    </div>

                    <div className="space-y-2 relative">
                        <Label htmlFor="job_experience">Experience</Label>
                        <Input id="job_experience" {...jobFormik.getFieldProps('experience')} placeholder="e.g., 2-3 years" />
                    </div>

                    <div className="space-y-2 relative">
                        <Label htmlFor="job_salary_range">Salary Range</Label>
                        <Input id="job_salary_range" {...jobFormik.getFieldProps('salary_range')} placeholder="e.g., $50k-$70k" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="job_status">Status *</Label>
                        <Select
                            value={jobFormik.values.status}
                            onValueChange={(value) => jobFormik.setFieldValue('status', value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="OPEN">Open</SelectItem>
                                <SelectItem value="CLOSED">Closed</SelectItem>
                                <SelectItem value="DRAFT">Draft</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    </div>
                    <Button type="submit" disabled={jobFormik.isSubmitting} className="w-full">
                        {jobFormik.isSubmitting ? 'Saving...' : editingJob ? 'Update' : 'Create'}
                    </Button>
                </form>
            </FormModal>

            {/* Candidate Modal */}
            <FormModal
                title={editingCandidate ? 'Edit Candidate' : 'Add Candidate'}
                isOpen={candidateModalOpen}
                onClose={() => {
                    setCandidateModalOpen(false);
                    setEditingCandidate(null);
                    candidateFormik.resetForm();
                }}
                loading={candidateFormik.isSubmitting}
                submitLabel={editingCandidate ? 'Update' : 'Create'}
                size="lg"
                progress={candidateProgress}
            >
                <form onSubmit={candidateFormik.handleSubmit} className="space-y-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="candidate_name">Name *</Label>
                        <Input id="candidate_name" {...candidateFormik.getFieldProps('name')} placeholder="Full name" />
                        {candidateFormik.touched.name && candidateFormik.errors.name && (
                            <p className="text-sm text-destructive">{candidateFormik.errors.name}</p>
                        )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="candidate_job_id">Job</Label>
                        <Select
                            value={candidateFormik.values.job_id}
                            onValueChange={(value) => candidateFormik.setFieldValue('job_id', value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select job" />
                            </SelectTrigger>
                            <SelectContent>
                                {jobsForDropdown.map((job) => (
                                    <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="candidate_email">Email</Label>
                            <Input id="candidate_email" type="email" {...candidateFormik.getFieldProps('email')} placeholder="email@example.com" />
                            {candidateFormik.touched.email && candidateFormik.errors.email && (
                                <p className="text-sm text-destructive">{candidateFormik.errors.email}</p>
                            )}
                        </div>

                        <div className="space-y-2 relative">
                            <Label htmlFor="candidate_phone">Phone</Label>
                            <Input id="candidate_phone" {...candidateFormik.getFieldProps('phone')} placeholder="Phone number" />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="candidate_status">Status *</Label>
                        <Select
                            value={candidateFormik.values.status}
                            onValueChange={(value) => candidateFormik.setFieldValue('status', value)}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="APPLIED">Applied</SelectItem>
                                <SelectItem value="NEW">New</SelectItem>
                                <SelectItem value="REVIEWING">Reviewing</SelectItem>
                                <SelectItem value="SHORTLISTED">Shortlisted</SelectItem>
                                <SelectItem value="INTERVIEWED">Interviewed</SelectItem>
                                <SelectItem value="OFFERED">Offered</SelectItem>
                                <SelectItem value="HIRED">Hired</SelectItem>
                                <SelectItem value="REJECTED">Rejected</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    </div>
                    <Button type="submit" disabled={candidateFormik.isSubmitting} className="w-full">
                        {candidateFormik.isSubmitting ? 'Saving...' : editingCandidate ? 'Update' : 'Create'}
                    </Button>
                </form>
            </FormModal>

            {/* Delete Job Dialog */}
            <Dialog open={!!deleteJob} onOpenChange={(open: boolean) => !open && setDeleteJob(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Delete Job</DialogTitle></DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to delete <strong>{deleteJob?.title}</strong>?
                    </DialogDescription>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteJob(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDeleteJob} disabled={deleteJobLoading}>
                            {deleteJobLoading ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Candidate Dialog */}
            <Dialog open={!!deleteCandidate} onOpenChange={(open: boolean) => !open && setDeleteCandidate(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Delete Candidate</DialogTitle></DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to delete <strong>{deleteCandidate?.name}</strong>?
                    </DialogDescription>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteCandidate(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDeleteCandidate} disabled={deleteCandidateLoading}>
                            {deleteCandidateLoading ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
