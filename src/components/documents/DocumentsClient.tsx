'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import axios from 'axios';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { DataTable, Column } from '@/components/common/DataTable';
import { FormModal } from '@/components/common/FormModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { DocumentPreviewModal } from '@/components/hr/employees/DocumentPreviewModal';
import { toDateInputValue, formatDateDisplay } from '@/lib/date-utils';
import { Upload, Eye, X, Loader2, FileText, Image as ImageIcon } from 'lucide-react';
import { Labels } from '../ui/labels';

const REMINDER_DURATION_OPTIONS = [
    { label: '1 day before', value: 1 },
    { label: '2 days before', value: 2 },
    { label: '1 week before', value: 7 },
    { label: '2 weeks before', value: 14 },
    { label: '1 month before', value: 30 },
    { label: '2 months before', value: 60 },
    { label: '3 months before', value: 90 },
    { label: '6 months before', value: 180 },
];

interface DocumentRecord {
    id: string;
    document_name: string;
    expire_date: string;
    file: string | null;
    file_type: string | null;
    reminder_date: string;
    reminder_enabled: boolean;
    reminder_days_before: number | null;
    createdAt: string;
    updatedAt: string;
    sr_no?: number;
}

interface PaginationInfo {
    page: number;
    pages: number;
    total: number;
    limit: number;
}

interface UploadedFileInfo {
    url: string;
    name: string;
}

const NAME_MAX = 200;
const ALLOWED_FILE_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

const documentValidationSchema = Yup.object({
    document_name: Yup.string().trim().required('Document name is required').max(NAME_MAX, `Name must not exceed ${NAME_MAX} characters`),
    expire_date: Yup.string().required('Expire date is required'),
    reminder_enabled: Yup.boolean(),
    reminder_days_before: Yup.number().nullable().when('reminder_enabled', {
        is: true,
        then: (schema) => schema.required('Please select a reminder duration'),
        otherwise: (schema) => schema.nullable(),
    }),
    reminder_date: Yup.string().when('reminder_enabled', {
        is: true,
        then: (schema) => schema
            .required('Reminder date is required')
            .test(
                'reminder-before-expire',
                'Reminder date must be on or before the expire date',
                function (value) {
                    const { expire_date } = this.parent;
                    if (!value || !expire_date) return true;
                    return new Date(value) <= new Date(expire_date);
                }
            ),
        otherwise: (schema) => schema.nullable(),
    }),
});

function getFileExtension(nameOrUrl: string): string {
    const cleanName = nameOrUrl.split('?')[0];
    return cleanName.split('.').pop()?.toLowerCase() || '';
}

function getFileNameFromUrl(url: string): string {
    try {
        const cleanUrl = url.split('?')[0];
        return decodeURIComponent(cleanUrl.split('/').pop() || '') || 'document';
    } catch {
        return 'document';
    }
}

function isValidFileType(nameOrUrl: string): boolean {
    return ALLOWED_FILE_EXTENSIONS.includes(getFileExtension(nameOrUrl));
}

interface DocumentsClientProps {
    canCreate?: boolean;
    canEdit?: boolean;
    canDelete?: boolean;
}

export function DocumentsClient({ canCreate = true, canEdit = true, canDelete = true }: DocumentsClientProps) {
    const searchParams = useSearchParams();
    const editId = searchParams.get('edit');
    const [data, setData] = useState<DocumentRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<DocumentRecord | null>(null);
    const [deleteItem, setDeleteItem] = useState<DocumentRecord | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [uploadedFile, setUploadedFile] = useState<UploadedFileInfo | null>(null);
    const [uploading, setUploading] = useState(false);
    const [previewDoc, setPreviewDoc] = useState<{ url: string; name: string } | null>(null);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1,
        pages: 1,
        total: 0,
        limit: 10,
    });

    const fetchData = useCallback(async (page = 1, searchValue = search, pageLimit = limit) => {
        try {
            setLoading(true);
            const response = await axios.get('/api/documents', {
                params: { page, limit: pageLimit, search: searchValue },
            });
            const rows: DocumentRecord[] = response.data.data || [];
            setData(rows.map((row, index) => ({
                ...row,
                sr_no: (page - 1) * pageLimit + index + 1,
            })));
            setPagination(response.data.pagination);
        } catch {
            toast.error('Failed to fetch documents');
        } finally {
            setLoading(false);
        }
    }, [search, limit]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        if (editId && data.length > 0 && canEdit) {
            const doc = data.find((d) => d.id === editId);
            if (doc) {
                handleEdit(doc);
                window.history.replaceState({}, '', '/documents');
            }
        }
    }, [editId, data, canEdit]);

    const handleFileSelect = async (file: File) => {
        const ext = getFileExtension(file.name);
        if (!ALLOWED_FILE_EXTENSIONS.includes(ext)) {
            toast.error('Only PDF, JPG, JPEG and PNG files are allowed');
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            toast.error('File size must be less than 5MB');
            return;
        }
        try {
            setUploading(true);
            const formData = new FormData();
            formData.append('file', file);
            const res = await axios.post('/api/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            setUploadedFile({ url: res.data.url, name: file.name });
            toast.success(`${file.name} uploaded`);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string } } };
            toast.error(err.response?.data?.error || 'Failed to upload file');
        } finally {
            setUploading(false);
        }
    };

    const formik = useFormik({
        initialValues: {
            document_name: '',
            expire_date: '',
            reminder_date: '',
            reminder_enabled: true,
            reminder_days_before: null as number | null,
        },
        validationSchema: documentValidationSchema,
        validateOnChange: true,
        validateOnBlur: true,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            if (!editingItem && !uploadedFile) {
                toast.error('Please upload a document file');
                setSubmitting(false);
                return;
            }
            try {
                const payload = {
                    document_name: values.document_name.trim(),
                    expire_date: values.expire_date,
                    reminder_date: values.reminder_date || values.expire_date,
                    reminder_enabled: values.reminder_enabled,
                    reminder_days_before: values.reminder_enabled ? values.reminder_days_before : null,
                    file: uploadedFile?.url ?? null,
                };
                if (editingItem) {
                    await axios.put(`/api/documents/${editingItem.id}`, payload);
                    toast.success('Document updated successfully');
                } else {
                    await axios.post('/api/documents', payload);
                    toast.success('Document created successfully');
                }
                setModalOpen(false);
                setEditingItem(null);
                setUploadedFile(null);
                resetForm();
                fetchData(pagination.page);
            } catch (error: unknown) {
                const err = error as { response?: { data?: { error?: string; message?: string } } };
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save document');
            } finally {
                setSubmitting(false);
            }
        },
    });

    useEffect(() => {
        if (formik.values.reminder_enabled && formik.values.expire_date && formik.values.reminder_days_before) {
            const expireDate = new Date(formik.values.expire_date);
            expireDate.setDate(expireDate.getDate() - formik.values.reminder_days_before);
            const reminderDate = expireDate.toISOString().split('T')[0];
            formik.setFieldValue('reminder_date', reminderDate, false);
        } else if (!formik.values.reminder_enabled) {
            formik.setFieldValue('reminder_date', '', false);
        }
    }, [formik.values.expire_date, formik.values.reminder_days_before, formik.values.reminder_enabled]);

    const progress = useMemo(() => {
        const fields = [
            formik.values.document_name,
            formik.values.expire_date,
            formik.values.reminder_enabled ? formik.values.reminder_days_before : 'skipped',
            uploadedFile?.url,
        ];
        const filled = fields.filter((v) => v !== null && v !== undefined && v !== '').length;
        return Math.round((filled / fields.length) * 100);
    }, [formik.values, uploadedFile]);

    const handleEdit = (item: DocumentRecord) => {
        setEditingItem(item);
        const reminderEnabled = item.reminder_enabled !== false;
        formik.resetForm({
            values: {
                document_name: item.document_name,
                expire_date: toDateInputValue(item.expire_date),
                reminder_date: reminderEnabled ? toDateInputValue(item.reminder_date) : '',
                reminder_enabled: reminderEnabled,
                reminder_days_before: item.reminder_days_before ?? null,
            },
        });
        setUploadedFile(
            item.file
                ? { url: item.file, name: getFileNameFromUrl(item.file) }
                : null
        );
        setModalOpen(true);
    };

    const handleAdd = () => {
        setEditingItem(null);
        formik.resetForm({
            values: {
                document_name: '',
                expire_date: '',
                reminder_date: '',
                reminder_enabled: true,
                reminder_days_before: null,
            },
        });
        setUploadedFile(null);
        setModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            const response = await axios.delete(`/api/documents/${deleteItem.id}`);
            toast.success(response.data.message || 'Document deleted successfully');
            setDeleteItem(null);
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete document');
        } finally {
            setDeleteLoading(false);
        }
    };

    const columns: Column<DocumentRecord>[] = [
        {
            header: 'Sr. No.',
            accessorKey: 'sr_no',
        },
        {
            header: 'Document Name',
            accessorKey: 'document_name',
            sortable: true,
        },
        {
            header: 'Expire Date',
            accessorKey: 'expire_date',
            cell: (item) => formatDateDisplay(item.expire_date),
        },
        {
            header: 'Document File',
            accessorKey: 'file',
            cell: (item) => {
                if (!item.file) return '-';
                const isPdf = getFileExtension(item.file) === 'pdf';
                return (
                    <button
                        type="button"
                        onClick={() => setPreviewDoc({ url: item.file as string, name: item.document_name })}
                        className="inline-flex max-w-[220px] items-center gap-1.5 text-sm text-primary underline-offset-4 hover:underline"
                        title={`View ${getFileNameFromUrl(item.file)}`}
                    >
                        {isPdf ? (
                            <FileText className="h-4 w-4 shrink-0 text-red-500" />
                        ) : (
                            <ImageIcon className="h-4 w-4 shrink-0 text-blue-500" />
                        )}
                        <span className="truncate">{getFileNameFromUrl(item.file)}</span>
                    </button>
                );
            },
        },
        {
            header: 'Reminder',
            accessorKey: 'reminder_enabled',
            cell: (item) => {
                if (!item.reminder_enabled) {
                    return <span className="text-xs text-muted-foreground">Off</span>;
                }
                return (
                    <span className="inline-flex items-center gap-1 text-xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        {formatDateDisplay(item.reminder_date)}
                    </span>
                );
            },
        },
        {
            header: 'Remaining Days',
            accessorKey: 'expire_date',
            cell: (item) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const expiry = new Date(item.expire_date);
                expiry.setHours(0, 0, 0, 0);
                const diffMs = expiry.getTime() - today.getTime();
                const days = Math.round(diffMs / (1000 * 60 * 60 * 24));
                const reminderStarted = item.reminder_date && new Date(item.reminder_date).setHours(0, 0, 0, 0) <= today.getTime();
                return (
                    <span className={reminderStarted ? 'text-red-600 font-semibold' : ''}>
                        {days}
                    </span>
                );
            },
        },
    ];

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6  w-full overflow-hidden">
            <div className="shrink-0">
                <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Documents</h2>
                <p className="text-muted-foreground text-sm">Manage project documents with expiry reminders</p>
            </div>

            <DataTable
                data={data}
                columns={columns}
                loading={loading}
                pagination={{
                    page: pagination.page,
                    totalPages: pagination.pages,
                    total: pagination.total,
                    limit: pagination.limit,
                }}
                onPageChange={(page) => fetchData(page, search, limit)}
                onSearch={(value) => setSearch(value)}
                onLimitChange={(newLimit) => {
                    setLimit(newLimit);
                    fetchData(1, search, newLimit);
                }}
                onAdd={canCreate ? handleAdd : undefined}
                onEdit={canEdit ? handleEdit : undefined}
                onDelete={canDelete ? (item) => setDeleteItem(item) : undefined}
                searchPlaceholder="Search documents..."
                addLabel="Add Document"
            />

            <FormModal
                title={editingItem ? 'Edit Document' : 'Add Document'}
                isOpen={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setEditingItem(null);
                    setUploadedFile(null);
                    formik.resetForm();
                }}
                loading={formik.isSubmitting}
                submitLabel={editingItem ? 'Update' : 'Create'}
                size="lg"
                progress={progress}
            >
                <form onSubmit={formik.handleSubmit} className="space-y-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="doc_document_name">Document Name *</Label>
                        <Input
                            id="doc_document_name"
                            {...formik.getFieldProps('document_name')}
                            placeholder="e.g., Agreement, NOC, Insurance Policy"
                        />
                        {formik.touched.document_name && formik.errors.document_name && (
                            <p className="text-sm text-destructive">{formik.errors.document_name}</p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 relative">
                            <Label htmlFor="doc_expire_date">Expire Date *</Label>
                            <Input id="doc_expire_date" type="date" {...formik.getFieldProps('expire_date')} />
                            {formik.touched.expire_date && formik.errors.expire_date && (
                                <p className="text-sm text-destructive">{formik.errors.expire_date}</p>
                            )}
                        </div>

                        <div className="space-y-2 relative">
                            <Label>Reminder</Label>
                            <Select
                                value={formik.values.reminder_enabled ? 'on' : 'off'}
                                onValueChange={(val) => {
                                    const enabled = val === 'on';
                                    formik.setFieldValue('reminder_enabled', enabled);
                                    if (!enabled) {
                                        formik.setFieldValue('reminder_days_before', null);
                                        formik.setFieldValue('reminder_date', '');
                                    }
                                }}
                            >
                                <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="on">On</SelectItem>
                                    <SelectItem value="off">Off</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {formik.values.reminder_enabled && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2 relative">
                                <Label htmlFor="doc_reminder_days_before">Remind me before expire *</Label>
                                <Select
                                    value={formik.values.reminder_days_before?.toString() ?? ''}
                                    onValueChange={(val) => {
                                        const num = val ? Number(val) : null;
                                        formik.setFieldValue('reminder_days_before', num);
                                    }}
                                    onOpenChange={() => formik.setFieldTouched('reminder_days_before', true)}
                                >
                                    <SelectTrigger className="w-full">
                                        <SelectValue placeholder="Select duration" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {REMINDER_DURATION_OPTIONS.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value.toString()}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {formik.touched.reminder_days_before && formik.errors.reminder_days_before && (
                                    <p className="text-sm text-destructive">{formik.errors.reminder_days_before as string}</p>
                                )}
                            </div>

                            <div className="space-y-2 relative">
                                <Label>Reminder Date (auto-calculated)</Label>
                                <Input
                                    type="date"
                                    value={formik.values.reminder_date}
                                    disabled
                                    className="bg-muted"
                                />
                            </div>
                        </div>
                    )}
					<div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                    <div className="space-y-2 relative">
                        <Label htmlFor="doc_file">Document File {!editingItem && '*'}</Label>
                        <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-center">
                            <label
                                htmlFor="doc_file"
                                title="Upload PDF or image"
                                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-input bg-transparent px-3 text-sm text-muted-foreground transition-colors hover:border-primary hover:bg-muted hover:text-primary"
                            >
                                {uploading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Upload className="h-4 w-4" />
                                )}
                                <span className="truncate">
                                    {uploading
                                        ? 'Uploading...'
                                        : uploadedFile
                                          ? uploadedFile.name
                                          : 'Upload PDF or image (JPG, JPEG, PNG - max 5MB)'}
                                </span>
                                <input
                                    id="doc_file"
                                    type="file"
                                    accept=".pdf,.jpg,.jpeg,.png"
                                    className="hidden"
                                    disabled={uploading}
                                    onChange={(e) => {
                                        const f = e.target.files?.[0];
                                        if (f) handleFileSelect(f);
                                        e.target.value = '';
                                    }}
                                />
                            </label>
                            {uploadedFile && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setPreviewDoc({ url: uploadedFile.url, name: uploadedFile.name })}
                                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-muted/30 text-muted-foreground transition-colors hover:border-primary hover:bg-muted hover:text-primary"
                                        title="Preview file"
                                    >
                                        <Eye className="h-4 w-4" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setUploadedFile(null)}
                                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-input bg-muted/30 text-muted-foreground transition-colors hover:border-destructive hover:bg-destructive/10 hover:text-destructive"
                                        title="Remove file"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </>
                            )}
                        </div>
                        {!editingItem && !uploadedFile && formik.submitCount > 0 && (
                            <p className="text-sm text-destructive">Document file is required</p>
                        )}
                        {editingItem && uploadedFile && (
                            <p className="text-xs text-muted-foreground">
                                Replace by uploading a new file, or remove it to clear the attached document.
                            </p>
                        )}
                    </div>
                </div>

                    <Button type="submit" disabled={formik.isSubmitting || uploading} className="w-full">
                        {formik.isSubmitting ? 'Saving...' : editingItem ? 'Update' : 'Create'}
                    </Button>
                </form>
            </FormModal>

            <Dialog open={!!deleteItem} onOpenChange={(open: boolean) => !open && setDeleteItem(null)}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Delete Document</DialogTitle></DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to delete <strong>{deleteItem?.document_name}</strong>? This action cannot be undone.
                    </DialogDescription>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteItem(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleteLoading}>
                            {deleteLoading ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <DocumentPreviewModal
                isOpen={!!previewDoc}
                onClose={() => setPreviewDoc(null)}
                fileUrl={previewDoc?.url || ''}
                fileName={previewDoc?.name || ''}
            />
        </div>
    );
}
