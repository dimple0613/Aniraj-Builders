'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { Loader2, CloudUpload, FileText, X } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { getUploadUrl } from '@/lib/upload-utils';

type ProjectDocumentType = 'TENDER_DOCUMENTS' | 'TENDER_NIT' | 'ESTIMATE' | 'AGREEMENT' | 'LOA' | 'WORK_ORDER' | 'OTHER';

interface ProjectDocumentUploadProps {
    projectId: string;
    documentType: ProjectDocumentType;
    label: string;
    error?: string;
    currentFiles?: Array<{ id: string; file_url: string; file_name: string; file_size?: number | null }>;
    onSuccess: () => void;
    onTempDocUploaded?: (documentType: string, tempDocId: string | null) => void;
    tempDocId?: string | null;
    disabled?: boolean;
}

interface UploadingFile {
    name: string;
    progress: number;
    uploading: boolean;
    batchIndex: number;
    file: File;
    cancelToken?: { cancel: () => void };
}

interface FileEntry {
    id?: string;
    file_path: string;
    file_name?: string;
    file_size?: number | null;
    mime_type?: string | null;
    created_at?: string;
    uploading?: boolean;
    progress?: number;
    batchIndex?: number;
}

interface CurrentFile {
    id: string;
    file_url: string;
    file_name: string;
    file_size?: number | null;
}

export default function ProjectDocumentUpload({
    projectId,
    documentType,
    label,
    error,
    currentFiles = [],
    onSuccess,
    onTempDocUploaded,
    tempDocId,
    disabled,
}: ProjectDocumentUploadProps) {
    const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
    const [files, setFiles] = useState<FileEntry[]>([]);
    const [currentTempDocId, setCurrentTempDocId] = useState<string | null>(tempDocId || null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const prevFileIdsRef = useRef<string>('');

    // Sync tempDocId when prop changes
    useEffect(() => {
        setCurrentTempDocId(tempDocId || null);
    }, [tempDocId]);

    // Sync files state from currentFiles prop
    useEffect(() => {
        const idString = JSON.stringify(currentFiles?.map(f => f.id) || []);
        if (prevFileIdsRef.current === idString) return;
        prevFileIdsRef.current = idString;

        if (!currentFiles || currentFiles.length === 0) {
            setFiles(prev => prev.filter(f => f.uploading && f.batchIndex !== undefined));
            return;
        }

        const mappedFiles: FileEntry[] = currentFiles.map((f: CurrentFile) => ({
            id: f.id,
            file_path: f.file_url,
            file_name: f.file_name,
            file_size: f.file_size,
            uploading: false,
        }));

        setFiles(prev => {
            const currentIdSet = new Set(mappedFiles.map(f => f.id));
            const uploading = prev.filter(f => f.uploading && f.batchIndex !== undefined && !currentIdSet.has(f.id));
            return [...mappedFiles, ...uploading];
        });
    }, [currentFiles]);

    const validateFile = (file: File): string | null => {
        const ALLOWED_PDF_TYPES = ['application/pdf'];
        
        if (!ALLOWED_PDF_TYPES.includes(file.type)) {
            return 'Only PDF files are allowed';
        }

        if (file.size > 10 * 1024 * 1024) {
            return 'File size must be less than 10MB';
        }

        return null;
    };

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = event.target.files;
        if (!selectedFiles || selectedFiles.length === 0) return;

        const validFiles: File[] = [];
        const invalidFiles: string[] = [];

        for (let i = 0; i < selectedFiles.length; i++) {
            const file = selectedFiles[i];
            const error = validateFile(file);
            if (error) {
                invalidFiles.push(`${file.name} (${error})`);
                continue;
            }
            validFiles.push(file);
        }

        if (invalidFiles.length > 0) {
            toast.error(`Skipped: ${invalidFiles.join(', ')}`);
        }

        if (validFiles.length === 0) return;

        const startingIndex = uploadingFiles.length;
        const newUploadingFiles = validFiles.map((file, idx) => ({
            name: file.name,
            progress: 0,
            uploading: true,
            batchIndex: startingIndex + idx,
            file: file,
        }));
        setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

        for (let i = 0; i < validFiles.length; i++) {
            const file = validFiles[i];
            const batchIndex = startingIndex + i;

            const CancelToken = axios.CancelToken;
            let cancelFn: (() => void) | undefined;

            try {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('documentType', documentType);

                const url = projectId && projectId.trim() !== ''
                    ? `/api/projects/${projectId}/documents` 
                    : '/api/projects/documents';

                const response = await axios.post(url, formData, {
                    cancelToken: new CancelToken((c) => { cancelFn = c; }),
                    onUploadProgress: (progressEvent) => {
                        const progress = progressEvent.total
                            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
                            : 0;
                        setUploadingFiles(prev => prev.map((f) =>
                            f.batchIndex === batchIndex ? { ...f, progress } : f
                        ));
                    },
                });

                if (response.data.success) {
                    const newFile = { ...response.data.data, uploading: false };
                    setFiles(prev => [...prev, newFile]);
                    if (newFile.id) {
                        setCurrentTempDocId(newFile.id);
                        onTempDocUploaded?.(documentType, newFile.id);
                    }
                    setUploadingFiles(prev => prev.filter(f => f.batchIndex !== batchIndex));
                    toast.success(`${file.name} uploaded successfully`);
                    onSuccess();
                } else {
                    setUploadingFiles(prev => prev.filter(f => f.batchIndex !== batchIndex));
                    toast.error(response.data.message || 'Upload failed');
                }
            } catch (error: any) {
                if (axios.isCancel(error)) {
                    setUploadingFiles(prev => prev.filter(f => f.batchIndex !== batchIndex));
                    toast.info(`${file.name} upload cancelled`);
                } else {
                    setUploadingFiles(prev => prev.filter(f => f.batchIndex !== batchIndex));
                    toast.error(error.response?.data?.message || `Failed to upload ${file.name}`);
                }
            }
        }

        if (event.target) event.target.value = '';
    };

    const handleRemove = async (index: number) => {
        const fileToRemove = files[index] || uploadedFile;
        if (!fileToRemove) return;

        const fileId = fileToRemove.id;
        if (!fileId) return;

        const isTempDoc = !projectId || projectId.trim() === '';

        try {
            if (isTempDoc) {
                await axios.delete(`/api/projects/documents/${fileId}`);
                onTempDocUploaded?.(documentType, null);
            } else {
                await axios.delete(`/api/projects/${projectId}/documents/${fileId}`);
            }

            setFiles(prev => prev.filter((_, i) => i !== index));
            toast.success(`File removed`);
            onSuccess();
        } catch {
            setFiles(prev => prev.filter((_, i) => i !== index));
            toast.success(`File removed (local only)`);
        }
    };

    const handleRemoveAll = async () => {
        const isTempDoc = !projectId || projectId.trim() === '';
        
        for (const file of files) {
            if (file.id) {
                try {
                    if (isTempDoc) {
                        await axios.delete(`/api/projects/documents/${file.id}`);
                    } else {
                        await axios.delete(`/api/projects/${projectId}/documents/${file.id}`);
                    }
                } catch {
                    // Continue even if delete fails
                }
            }
        }
        setFiles([]);
        setUploadingFiles([]);
        if (isTempDoc) {
            onTempDocUploaded?.(documentType, null);
        }
        toast.success('All files removed');
        onSuccess();
    };

    const getFileName = (url: string): string => {
        try {
            const urlWithoutParams = url.split('?')[0];
            return urlWithoutParams.split('/').pop() || 'file';
        } catch {
            return 'file';
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const isUploading = uploadingFiles.length > 0;
    const uploadedFile = useMemo(() => {
        if (files.length > 0) return files[0];
        if (currentFiles && currentFiles.length > 0) {
            return {
                id: currentFiles[0].id,
                file_path: currentFiles[0].file_url,
                file_name: currentFiles[0].file_name,
                file_size: currentFiles[0].file_size,
                uploading: false,
            };
        }
        return null;
    }, [files, currentFiles]);
    const uploadingFile = uploadingFiles.length > 0 ? uploadingFiles[0] : null;

    return (
        <div className="space-y-1">
            <div
                className="doc-item"
                style={{
                    border: uploadedFile ? '1px solid #cbd5e1' : error ? '1px solid #ef4444' : '1px dashed #cbd5e1',
                    padding: '8px',
                    borderRadius: '8px',
                    width: '110px',
                    background: 'transparent',
                    cursor: uploadingFile || disabled ? 'default' : 'pointer',
                    opacity: disabled ? 0.5 : 1,
                }}
                onClick={() => !disabled && !uploadingFile && !uploadedFile && fileInputRef.current?.click()}
            >
                <span style={{ fontSize: '10px', fontWeight: 700, color: uploadedFile ? '#16a34a' : '#64748b', display: 'block', textAlign: 'center' }}>
                    {label}
                </span>
                <div style={{ display: 'flex', gap: '4px', justifyContent: 'center', marginTop: '5px' }}>
                    {uploadingFile ? (
                        <div className="flex items-center gap-1">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: '#3b82f6' }} />
                            <span style={{ fontSize: '10px', color: '#64748b' }}>{uploadingFile.progress}%</span>
                        </div>
                    ) : uploadedFile ? (
                        <div className="flex items-center gap-1" style={{ maxWidth: '90px' }}>
                            <FileText className="h-3.5 w-3.5 shrink-0" style={{ color: '#16a34a' }} />
                            <span style={{ fontSize: '9px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '50px' }}>
                                {uploadedFile?.file_name || (uploadedFile ? getFileName(uploadedFile.file_path) : '')}
                            </span>
                            <X
                                className="h-3 w-3 shrink-0"
                                style={{ cursor: disabled ? 'default' : 'pointer', color: disabled ? '#94a3b8' : '#ef4444' }}
                                onClick={(e) => { e.stopPropagation(); if (!disabled) handleRemove(0); }}
                            />
                        </div>
                    ) : (
                        <CloudUpload style={{ cursor: 'pointer', fontSize: '20px', color: '#94a3b8' }} />
                    )}
                </div>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileChange}
                className="hidden"
                disabled={disabled}
                id={`${documentType}-upload-${projectId}`}
            />
            {error && (
                <p className="text-xs text-red-500" style={{ maxWidth: '110px' }}>{error}</p>
            )}
        </div>
    );
}
