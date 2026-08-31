'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, Printer } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { getUploadUrl } from '@/lib/upload-utils';

interface PrintPhoto {
    id: string;
    file_url?: string | null;
    file_name?: string | null;
}

interface PrintStage {
    id: string;
    stage_name: string;
    photos: PrintPhoto[];
}

interface ProjectPhotoPrintProps {
    project: { id: string; name: string };
    onClose: () => void;
}

export function ProjectPhotoPrint({ project, onClose }: ProjectPhotoPrintProps) {
    const [stages, setStages] = useState<PrintStage[]>([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [printing, setPrinting] = useState(false);

    const loadStages = useCallback(async () => {
        try {
            const response = await axios.get(`/api/projects/${project.id}/photos`);
            const serverStages = response.data?.data || [];
            setStages(serverStages);
        } catch {
            toast.error('Failed to load project photos');
        } finally {
            setLoading(false);
        }
    }, [project.id]);

    useEffect(() => {
        loadStages();
    }, [loadStages]);

    const togglePhoto = (photoId: string) => {
        setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(photoId)) {
                next.delete(photoId);
            } else {
                next.add(photoId);
            }
            return next;
        });
    };

    const toggleStage = (stage: PrintStage) => {
        setSelected((prev) => {
            const next = new Set(prev);
            const photoIds = stage.photos.map((p) => p.id);
            const allSelected = photoIds.length > 0 && photoIds.every((id) => next.has(id));
            if (allSelected) {
                photoIds.forEach((id) => next.delete(id));
            } else {
                photoIds.forEach((id) => next.add(id));
            }
            return next;
        });
    };

    const selectedCount = selected.size;

    const handlePrint = async () => {
        if (selectedCount === 0) {
            toast.error('Please select at least one image to print');
            return;
        }

        try {
            setPrinting(true);
            toast.info('Preparing Project Upload Image PDF...', {
                description: 'This may take a few seconds. Please do not close the window.'
            });

            const photoIds = Array.from(selected).join(',');
            const response = await axios.get(
                `/api/projects/${project.id}/photos/print?photoIds=${encodeURIComponent(photoIds)}`,
                { responseType: 'blob' }
            );
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
                toast.success('Project Upload Image PDF opened for printing');
            } else {
                toast.error('Please allow popups to print');
            }
        } catch (error: any) {
            console.error('Failed to print project photos:', error);
            toast.error(error.response?.data?.message || 'Failed to prepare Project Upload Image PDF');
        } finally {
            setPrinting(false);
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[95vw] w-full max-h-[90vh] flex flex-col p-0">
                <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
                    <DialogTitle>Print Project Images</DialogTitle>
                    <DialogDescription>
                        {project.name} — Select the images to include in the print. Only the selected images will be printed.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto px-6 space-y-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : stages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-10 border rounded-lg border-dashed">
                            <p className="text-sm text-muted-foreground">
                                No uploaded images found for this project.
                            </p>
                        </div>
                    ) : (
                        stages.map((stage) => {
                            const photoIds = stage.photos.map((p) => p.id);
                            const stageSelected = photoIds.length > 0 && photoIds.every((id) => selected.has(id));

                            return (
                                <div key={stage.id} className="border rounded-lg p-4 space-y-3">
                                    <div className="flex items-center gap-3">
                                        <label className="flex items-center gap-2 text-sm font-medium">
                                            <input
                                                type="checkbox"
                                                checked={stageSelected}
                                                onChange={() => toggleStage(stage)}
                                                className="h-4 w-4"
                                            />
                                            {stage.stage_name}
                                        </label>
                                        <span className="text-xs text-muted-foreground">
                                            {stage.photos.length} image{stage.photos.length === 1 ? '' : 's'}
                                        </span>
                                    </div>

                                    {stage.photos.length > 0 ? (
                                        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
                                            {stage.photos.map((photo) => (
                                                <div
                                                    key={photo.id}
                                                    className={`relative group aspect-square rounded-lg border overflow-hidden cursor-pointer ${
                                                        selected.has(photo.id)
                                                            ? 'ring-2 ring-blue-600 border-blue-600'
                                                            : ''
                                                    }`}
                                                    onClick={() => togglePhoto(photo.id)}
                                                >
                                                    <img
                                                        src={getUploadUrl(photo.file_url || '', { bustCache: true })}
                                                        alt={photo.file_name || 'photo'}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10" />
                                                    <input
                                                        type="checkbox"
                                                        checked={selected.has(photo.id)}
                                                        onChange={() => togglePhoto(photo.id)}
                                                        onClick={(e) => e.stopPropagation()}
                                                        className="absolute top-2 left-2 h-4 w-4 cursor-pointer"
                                                    />
                                                    {selected.has(photo.id) && (
                                                        <div className="absolute inset-0 bg-blue-600/20 pointer-events-none" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No images in this stage.</p>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                <DialogFooter className="flex items-center justify-between gap-2 px-6 py-4 border-t shrink-0">
                    <p className="text-sm text-muted-foreground">
                        {selectedCount} image{selectedCount === 1 ? '' : 's'} selected
                    </p>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" onClick={onClose} disabled={printing}>
                            Close
                        </Button>
                        <Button onClick={handlePrint} disabled={printing || selectedCount === 0}>
                            {printing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                            Print
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
