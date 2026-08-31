'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, FileText, Download, X, Upload, Eye, Image, ChevronLeft, ChevronRight, ZoomIn, Trash2 } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

export interface VardhiAttachmentData {
    id: string;
    type: string;
    file_path: string;
    file_name: string;
    file_size?: number;
    mime_type?: string;
    created_at?: string;
}

interface AttachmentModalProps {
    isOpen: boolean;
    onClose: () => void;
    vardhiId: string;
    vardhiNumber?: string;
    defaultType?: string;
}

type FileType = 'pdf' | 'image';

interface SliderItem {
    url: string;
    fileType: FileType;
    fileName: string;
}

interface SliderState {
    items: SliderItem[];
    index: number;
}

const ATTACHMENT_FIELDS = [
    { key: 'site_photography' as const, label: 'Site Photography', allowedTypes: 'PNG/JPG/JPEG', validateExif: true },
    { key: 'site_clear_photo' as const, label: 'Site Clear Photo', allowedTypes: 'PNG/JPG/JPEG', validateExif: true },
    { key: 'other_attachment' as const, label: 'Store Report', allowedTypes: 'PDF or PNG/JPG/JPEG', validateExif: false },
    { key: 'report_pdf' as const, label: 'Other PDF', allowedTypes: 'PDF', validateExif: false },
];

export default function AttachmentModal({ isOpen, onClose, vardhiId, vardhiNumber, defaultType }: AttachmentModalProps) {
    const [attachments, setAttachments] = useState<Record<string, VardhiAttachmentData[]>>({});
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState<string | null>(null);
    const [slider, setSlider] = useState<SliderState | null>(null);
    const [zoomLevel, setZoomLevel] = useState(1);
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    useEffect(() => {

        if (isOpen && vardhiId) {
            fetchAttachments();
        }
    }, [isOpen, vardhiId]);

    useEffect(() => {
        if (!isOpen) {
            setSlider(null);
            setZoomLevel(1);
        }
    }, [isOpen]);



    const fetchAttachments = async () => {
        setLoading(true);
        try {
            const response = await axios.get(`/api/vardhi/${vardhiId}/attachments`);
            if (response.data.success) {
                const grouped = response.data.data.grouped || {};
                setAttachments(grouped);
                if (!isOpen || !defaultType) return;

                const selectedAttachments = grouped[defaultType];

                if (selectedAttachments && selectedAttachments.length > 0) {
                    // small delay to ensure modal render completes
                    setTimeout(() => {
                        openSlider(defaultType, 0);
                    }, 300);
                }
            }
        } catch (error) {
            console.error('Error fetching attachments:', error);
            toast.error('Failed to load attachments');
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = async (type: string, event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const fieldConfig = ATTACHMENT_FIELDS.find(f => f.key === type);
        if (!fieldConfig) return;

        const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
        const ALLOWED_PDF_TYPES = ['application/pdf'];
        const ALLOWED_MIXED_TYPES = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png'];

        const validateFile = (file: File, allowedTypes: string): string | null => {
            const allowed = allowedTypes === 'PDF' ? ALLOWED_PDF_TYPES
                : allowedTypes === 'PNG/JPG/JPEG' ? ALLOWED_IMAGE_TYPES
                    : ALLOWED_MIXED_TYPES;

            if (!allowed.includes(file.type)) {
                return `Only ${allowedTypes} files are allowed`;
            }
            if (file.size > 5 * 1024 * 1024) {
                return 'File size must be less than 5MB';
            }
            return null;
        };

        const error = validateFile(file, fieldConfig.allowedTypes);
        if (error) {
            toast.error(error);
            return;
        }

        setUploading(type);
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('type', type);

            const response = await axios.post(`/api/vardhi/${vardhiId}/attachments`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            if (response.data.success) {
                toast.success('File uploaded successfully');
                fetchAttachments();
            } else {
                toast.error(response.data.message || 'Failed to upload file');
            }
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error(error.response?.data?.message || 'Failed to upload file');
        } finally {
            setUploading(null);
            if (event.target) event.target.value = '';
        }
    };

    const handleDelete = async (attachmentId: string) => {
        try {
            const response = await axios.delete(`/api/vardhi/${vardhiId}/attachments?attachmentId=${attachmentId}`);
            if (response.data.success) {
                toast.success('File deleted successfully');
                fetchAttachments();
            } else {
                toast.error(response.data.message || 'Failed to delete file');
            }
        } catch (error: any) {
            console.error('Delete error:', error);
            toast.error(error.response?.data?.message || 'Failed to delete file');
        }
    };

    const getFileType = (url: string): FileType => {
        if (!url) return 'image';
        const cleanUrl = url.replace(/\\/g, '/').split('?')[0];
        const ext = cleanUrl.split('.').pop()?.toLowerCase();
        if (ext === 'pdf') return 'pdf';
        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext || '')) return 'image';
        return 'image';
    };

    const getFullUrl = (path: string) => {
        if (!path) return '';
        if (path.startsWith('http')) return path;
        return path;
    };

    const openSlider = (type: string, index: number) => {
        const typeAttachments = attachments[type] || [];
        const items: SliderItem[] = typeAttachments.map(att => ({
            url: getFullUrl(att.file_path),
            fileType: getFileType(att.file_path),
            fileName: att.file_name || 'File',
        }));

        if (items.length > 0) {
            setSlider({ items, index });
            setZoomLevel(1);
        }
    };

    const navigateSlider = useCallback((direction: 'prev' | 'next') => {
        if (!slider) return;
        const newIndex = direction === 'prev'
            ? (slider.index - 1 + slider.items.length) % slider.items.length
            : (slider.index + 1) % slider.items.length;
        setSlider({ ...slider, index: newIndex });
        setZoomLevel(1);
    }, [slider]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!slider) return;
            if (e.key === 'ArrowLeft') navigateSlider('prev');
            if (e.key === 'ArrowRight') navigateSlider('next');
            if (e.key === 'Escape') setSlider(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [slider, navigateSlider]);

    const downloadFile = async (url: string, filename: string) => {
        try {
            const response = await fetch(url);
            const blob = await response.blob();
            const blobUrl = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = blobUrl;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(blobUrl);
            document.body.removeChild(a);
        } catch (error) {
            console.error('Download error:', error);
            toast.error('Failed to download');
        }
    };

    const currentSliderItem = slider ? slider.items[slider.index] : null;
    const totalItems = slider ? slider.items.length : 0;

    const renderAttachmentField = (field: typeof ATTACHMENT_FIELDS[number]) => {
        const fieldAttachments = attachments[field.key] || [];
        const isUploading = uploading === field.key;

        return (
            <div className="border rounded-lg p-4 bg-gray-50" ref={(el: any) => (sectionRefs.current[field.key] = el)}>
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{field.label}</span>
                        <span className="text-xs text-muted-foreground">({field.allowedTypes})</span>
                        <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                            {fieldAttachments.length} file{fieldAttachments.length === 1 ? '' : 's'}
                        </span>
                    </div>
                    {/* <label className="cursor-pointer bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 transition-colors">
                        <Upload className="w-4 h-4" />
                        Add File
                        <input
                            type="file"
                            accept={field.allowedTypes === 'PDF' ? '.pdf,application/pdf'
                                : field.allowedTypes === 'PNG/JPG/JPEG' ? '.jpg,.jpeg,.png,image/jpeg,image/jpg,image/png'
                                    : '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/jpg,image/png'}
                            onChange={(e) => handleFileUpload(field.key, e)}
                            disabled={isUploading}
                            className="hidden"
                        />
                    </label> */}
                </div>

                {isUploading && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading...
                    </div>
                )}

                {fieldAttachments.length > 0 && (
                    <div className="space-y-2">
                        {fieldAttachments.map((att, idx) => {
                            const url = getFullUrl(att.file_path);
                            const fileType = getFileType(att.file_path);

                            return (
                                <div key={att.id} className="flex items-center justify-between bg-white rounded-md p-2 border overflow-hidden">
                                    <div className="flex items-center gap-3 flex-1 min-w-0 w-full">
                                        {fileType === 'pdf' ? (
                                            <FileText className="h-5 w-5 text-red-500 shrink-0" />
                                        ) : (
                                            <Image className="h-5 w-5 text-blue-500 shrink-0" />
                                        )}
                                        <div className="flex-1 min-w-0 w-0">
                                            <p className="text-sm truncate">{att.file_name}</p>
                                            {att.file_size && (
                                                <p className="text-xs text-muted-foreground">
                                                    {(att.file_size / 1024).toFixed(1)} KB
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 shrink-0">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => openSlider(field.key, idx)}
                                        >
                                            <Eye className="h-4 w-4" />
                                        </Button>
                                        <a href={url} target="_blank" rel="noopener noreferrer">
                                            <Button variant="ghost" size="sm">
                                                <Download className="h-4 w-4" />
                                            </Button>
                                        </a>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleDelete(att.id)}
                                        >
                                            <Trash2 className="h-4 w-4 text-red-500" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {fieldAttachments.length === 0 && !isUploading && (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                        No files uploaded yet
                    </p>
                )}
            </div>
        );
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={onClose}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span>Attachments</span>
                            {vardhiNumber && <span className="text-muted-foreground text-sm">({vardhiNumber})</span>}
                        </DialogTitle>
                    </DialogHeader>

                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : (
                        <div className="space-y-4 pt-4">
                            {defaultType
                                ? ATTACHMENT_FIELDS
                                    .filter(field => field.key === defaultType)
                                    .map(renderAttachmentField)
                                : ATTACHMENT_FIELDS.map(renderAttachmentField)}
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={!!slider} onOpenChange={() => setSlider(null)}>
                <DialogContent className="max-w-6xl max-h-[95vh] p-0">
                    <div className="absolute top-4 left-4 z-20 flex items-center gap-3 text-gray-800 text-sm bg-white/90 px-3 py-1.5 rounded-lg shadow-md">
                        {currentSliderItem?.fileType === 'pdf' ? (
                            <FileText className="w-4 h-4 text-red-400" />
                        ) : (
                            <Image className="w-4 h-4 text-blue-400" />
                        )}
                        <span className="font-medium">{slider?.index !== undefined ? slider.index + 1 : 0} / {totalItems}</span>
                        <span className="text-gray-500 truncate max-w-[200px]">{currentSliderItem?.fileName}</span>
                    </div>

                    <div className="absolute right-4 top-4 flex items-center gap-1">
                        {currentSliderItem?.fileType === 'image' && (
                            <>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setZoomLevel(z => Math.max(z - 0.25, 0.5))}
                                    className="text-gray-700 hover:bg-gray-100"
                                >
                                    <ZoomIn className="h-5 w-5 rotate-180" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setZoomLevel(z => Math.min(z + 0.25, 3))}
                                    className="text-gray-700 hover:bg-gray-100"
                                >
                                    <ZoomIn className="h-5 w-5" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => downloadFile(currentSliderItem?.url || '', currentSliderItem?.fileName || 'file')}
                                    className="text-gray-700 hover:bg-gray-100"
                                >
                                    <Download className="h-5 w-5" />
                                </Button>
                            </>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setSlider(null)}
                            className="text-gray-700 hover:bg-gray-100"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>

                    {totalItems > 1 && (
                        <>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigateSlider('prev')}
                                className="absolute left-4 top-1/2 -translate-y-1/2 z-20 text-gray-700 hover:bg-gray-100 h-12 w-12"
                            >
                                <ChevronLeft className="h-8 w-8" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => navigateSlider('next')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 z-20 text-white hover:bg-white/20 h-12 w-12"
                            >
                                <ChevronRight className="h-8 w-8" />
                            </Button>
                            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-2 bg-white shadow-lg rounded-lg">
                                {slider?.items.map((item, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => {
                                            if (slider) setSlider({ ...slider, index: idx });
                                            setZoomLevel(1);
                                        }}
                                        className={`w-14 h-14 rounded-md overflow-hidden border-2 transition-all flex items-center justify-center ${idx === slider.index ? 'border-gray-900 scale-110' : 'border-transparent opacity-60 hover:opacity-100'
                                            }`}
                                    >
                                        {item.fileType === 'pdf' ? (
                                            <FileText className="w-6 h-6 text-red-400" />
                                        ) : (
                                            <img
                                                src={item.url}
                                                alt={`Thumbnail ${idx + 1}`}
                                                className="w-full h-full object-cover"
                                            />
                                        )}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}

                    <div className="flex items-center justify-center h-[80vh] overflow-auto bg-white">
                        {currentSliderItem?.fileType === 'pdf' ? (
                            <iframe
                                src={`${currentSliderItem.url}#toolbar=0&view=FitH`}
                                className="w-full h-full min-h-[70vh]"
                                title="PDF Viewer"
                            />
                        ) : (
                            <img
                                src={currentSliderItem?.url}
                                alt="Preview"
                                style={{ transform: `scale(${zoomLevel})`, transition: 'transform 0.2s' }}
                                className="max-h-full max-w-full object-contain"
                            />
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
