'use client';

import { useState, useRef, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Upload, FileText, Image, X, Eye } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';
import { getUploadUrl } from '@/lib/upload-utils';

interface VardhiAttachmentUploadProps {
    vardhiId: string;
    field: 'report_pdf' | 'site_photography' | 'site_clear_photo' | 'other_attachment';
    label: string;
    allowedTypes: string;
    currentValue: string | null;
    onSuccess: () => void;
    validateExif?: boolean;
}

export default function VardhiAttachmentUpload({
    vardhiId,
    field,
    label,
    allowedTypes,
    currentValue,
    onSuccess,
    validateExif = false,
}: VardhiAttachmentUploadProps) {
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [imageKey, setImageKey] = useState(0);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setImageKey(prev => prev + 1);
    }, [currentValue]);

    const displayUrl = useMemo(() => {
        if (previewUrl) return previewUrl;
        if (!currentValue) return null;
        return getUploadUrl(currentValue, { bustCache: true });
    }, [previewUrl, currentValue, imageKey]);

    const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
    const ALLOWED_PDF_TYPES = ['application/pdf'];
    const ALLOWED_MIXED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

    const validateFile = (file: File, allowedTypes: string): string | null => {
        if (allowedTypes === 'PDF' && !ALLOWED_PDF_TYPES.includes(file.type)) {
            return 'Only PDF files are allowed';
        }

        if (allowedTypes === 'PNG/JPG/JPEG') {
            if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
                return 'Only PNG, JPG, and JPEG files are allowed';
            }
        }

        if (allowedTypes === 'PDF or PNG/JPG/JPEG') {
            if (!ALLOWED_MIXED_TYPES.includes(file.type)) {
                return 'Only PDF, PNG, JPG, and JPEG files are allowed';
            }
        }

        if (file.size > 5 * 1024 * 1024) {
            return 'File size must be less than 5MB';
        }

        return null;
    };

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const error = validateFile(file, allowedTypes);
        if (error) {
            toast.error(error);
            return;
        }

        await uploadFile(file);

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const uploadFile = async (file: File) => {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('field', field);

            const response = await axios.put(`/api/vardhi/${vardhiId}/attachments`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.data.success) {
                const timestamp = Date.now();
                const urlWithCache = `${response.data.data.url}?v=${timestamp}`;
                setPreviewUrl(urlWithCache);
                toast.success('File uploaded successfully');
                onSuccess();
            } else {
                toast.error(response.data.message || 'Failed to upload file');
            }
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error(error.response?.data?.message || 'Failed to upload file');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async () => {
        if (!currentValue) return;

        try {
            const response = await axios.delete(`/api/vardhi/${vardhiId}/attachments?field=${field}`);

            if (response.data.success) {
                setPreviewUrl(null);
                toast.success('File deleted successfully');
                onSuccess();
            } else {
                toast.error(response.data.message || 'Failed to delete file');
            }
        } catch (error: any) {
            console.error('Delete error:', error);
            toast.error(error.response?.data?.message || 'Failed to delete file');
        }
    };

    const getAcceptAttribute = (): string => {
        if (allowedTypes === 'PDF') return '.pdf,application/pdf';
        if (allowedTypes === 'PNG/JPG/JPEG') return '.jpg,.jpeg,.png,image/jpeg,image/jpg,image/png';
        if (allowedTypes === 'PDF or PNG/JPG/JPEG') return '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/jpg,image/png';
        return '';
    };

    const getFileName = (url: string): string => {
        try {
            const urlWithoutParams = url.split('?')[0];
            return urlWithoutParams.split('/').pop() || 'file';
        } catch {
            return 'file';
        }
    };

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <label className="text-sm font-medium">{label}</label>
                <span className="text-xs text-muted-foreground">{allowedTypes} (Max 5MB)</span>
            </div>

            {displayUrl ? (
                <div className="border rounded-lg p-3 bg-gray-50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {displayUrl.endsWith('.pdf') ? (
                                <FileText className="h-5 w-5 text-red-500" />
                            ) : (
                                <Image className="h-5 w-5 text-blue-500" />
                            )}
                            <span className="text-sm truncate max-w-[200px]">
                                {getFileName(displayUrl)}
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(displayUrl, '_blank')}
                            >
                                <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleDelete}
                            >
                                <X className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept={getAcceptAttribute()}
                        onChange={handleFileSelect}
                        className="hidden"
                        id={`${field}-upload`}
                    />
                    <label
                        htmlFor={`${field}-upload`}
                        className="cursor-pointer flex flex-col items-center"
                    >
                        {uploading ? (
                            <>
                                <Loader2 className="h-8 w-8 animate-spin text-gray-400 mb-2" />
                                <span className="text-sm text-muted-foreground">Uploading...</span>
                            </>
                        ) : (
                            <>
                                <Upload className="h-8 w-8 text-gray-400 mb-2" />
                                <span className="text-sm text-muted-foreground">
                                    Click to upload {allowedTypes}
                                </span>
                            </>
                        )}
                    </label>
                </div>
            )}
        </div>
    );
}
