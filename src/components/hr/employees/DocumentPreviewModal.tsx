'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Loader2 } from 'lucide-react';

interface DocumentPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    fileUrl: string;
    fileName: string;
}

function getExtension(url: string): string {
    const cleanUrl = url.split('?')[0];
    return cleanUrl.split('.').pop()?.toLowerCase() || '';
}

function isImageFile(url: string): boolean {
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(getExtension(url));
}

function isPdfFile(url: string): boolean {
    return getExtension(url) === 'pdf';
}

export function DocumentPreviewModal({ isOpen, onClose, fileUrl, fileName }: DocumentPreviewModalProps) {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    const handleDownload = async () => {
        try {
            const response = await fetch(fileUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName || fileUrl.split('/').pop()?.split('?')[0] || 'document';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
        } catch {
            const a = document.createElement('a');
            a.href = fileUrl;
            a.download = fileName || 'document';
            a.target = '_blank';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    };

    const handleOpenChange = (open: boolean) => {
        if (!open) {
            setLoading(true);
            setError(false);
            onClose();
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col overflow-hidden p-0">
                <DialogHeader className="flex flex-row items-center justify-between space-y-0 px-6 pt-6 pb-4 border-b shrink-0">
                    <DialogTitle className="text-base">{fileName || 'Document Preview'}</DialogTitle>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDownload}
                        className="h-8"
                    >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                    </Button>
                </DialogHeader>
                <div className="flex-1 min-h-0 overflow-auto p-6">
                    {isPdfFile(fileUrl) ? (
                        <>
                            {loading && (
                                <div className="flex items-center justify-center py-12">
                                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                                </div>
                            )}
                            <iframe
                                src={fileUrl}
                                className={`w-full h-[75vh] border rounded-md ${loading ? 'hidden' : ''}`}
                                title={fileName}
                                onLoad={() => setLoading(false)}
                                onError={() => { setLoading(false); setError(true); }}
                            />
                        </>
                    ) : isImageFile(fileUrl) ? (
                        <div className="flex items-center justify-center">
                            {loading && (
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                            )}
                            <img
                                key={fileUrl}
                                src={fileUrl}
                                alt={fileName}
                                className={`max-w-full max-h-[75vh] object-contain rounded-md ${loading ? 'hidden' : ''}`}
                                onLoad={() => setLoading(false)}
                                onError={() => { setLoading(false); setError(true); }}
                            />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <p className="text-sm">Preview not available for this file type.</p>
                            <Button variant="outline" size="sm" onClick={handleDownload} className="mt-4">
                                <Download className="h-4 w-4 mr-1" />
                                Download to view
                            </Button>
                        </div>
                    )}
                    {error && (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <p className="text-sm text-destructive mb-2">Failed to load document.</p>
                            <p className="text-xs mb-4">URL: {fileUrl}</p>
                            <Button variant="outline" size="sm" onClick={handleDownload}>
                                <Download className="h-4 w-4 mr-1" />
                                Download instead
                            </Button>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}
