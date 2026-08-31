'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Loader2, X, Trash2, ImagePlus } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getUploadUrl } from '@/lib/upload-utils';

interface Photo {
    tempKey: string;
    id?: string;
    file?: File;
    file_url?: string;
    file_name?: string;
    progress: number;
    uploading: boolean;
}

interface Stage {
    key: string;
    id?: string;
    name: string;
    photos: Photo[];
}

interface ProjectPhotoUploadProps {
    project: { id: string; name: string };
    onClose: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function ProjectPhotoUpload({ project, onClose }: ProjectPhotoUploadProps) {
    const [stages, setStages] = useState<Stage[]>([]);
    const [loading, setLoading] = useState(true);
    const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

    const loadStages = useCallback(async () => {
        try {
            const response = await axios.get(`/api/projects/${project.id}/photos`);
            const serverStages = response.data?.data || [];
            setStages(
                serverStages.map((stage: any) => ({
                    key: stage.id,
                    id: stage.id,
                    name: stage.stage_name,
                    photos: (stage.photos || []).map((photo: any) => ({
                        tempKey: photo.id,
                        id: photo.id,
                        file_url: photo.file_url,
                        file_name: photo.file_name,
                        progress: 100,
                        uploading: false,
                    })),
                }))
            );
        } catch {
            toast.error('Failed to load project photos');
        } finally {
            setLoading(false);
        }
    }, [project.id]);

    useEffect(() => {
        loadStages();
    }, [loadStages]);

    const addStage = () => {
        const key = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        setStages((prev) => [
            ...prev,
            {
                key,
                name: `Stage ${prev.length + 1}`,
                photos: [],
            },
        ]);
    };

    const handleStageNameChange = (key: string, value: string) => {
        setStages((prev) =>
            prev.map((s) => (s.key === key ? { ...s, name: value } : s))
        );
    };

    const ensureStage = async (stage: Stage): Promise<string | null> => {
        if (stage.id) return stage.id;
        try {
            const response = await axios.post(`/api/projects/${project.id}/photos/stages`, {
                stage_name: stage.name.trim() || undefined,
            });
            if (response.data.success) {
                const stageId = response.data.data.id;
                setStages((prev) =>
                    prev.map((s) => (s.key === stage.key ? { ...s, id: stageId } : s))
                );
                return stageId;
            }
            throw new Error(response.data.message || 'Failed to create stage');
        } catch (error: any) {
            toast.error(error.response?.data?.message || error.message || 'Failed to create stage');
            return null;
        }
    };

    const handleAddImages = async (stage: Stage, fileList: FileList | null) => {
        if (!fileList || fileList.length === 0) return;

        const files = Array.from(fileList);
        const validFiles: File[] = [];
        const invalidFiles: string[] = [];

        for (const file of files) {
            if (!file.type.startsWith('image/')) {
                invalidFiles.push(`${file.name} (only images allowed)`);
            } else if (file.size > MAX_FILE_SIZE) {
                invalidFiles.push(`${file.name} (must be less than 10MB)`);
            } else {
                validFiles.push(file);
            }
        }

        if (invalidFiles.length > 0) {
            toast.error(`Skipped: ${invalidFiles.join(', ')}`);
        }

        if (validFiles.length === 0) return;

        const newPhotos: Photo[] = validFiles.map((file) => ({
            tempKey: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}-${Math.random().toString(36).substring(2, 6)}`,
            file,
            progress: 0,
            uploading: true,
        }));

        setStages((prev) =>
            prev.map((s) =>
                s.key === stage.key ? { ...s, photos: [...s.photos, ...newPhotos] } : s
            )
        );

        const stageId = await ensureStage(stage);
        if (!stageId) {
            setStages((prev) =>
                prev.map((s) =>
                    s.key === stage.key
                        ? { ...s, photos: s.photos.filter((p) => !newPhotos.some((np) => np.tempKey === p.tempKey)) }
                        : s
                )
            );
            return;
        }

        for (const photo of newPhotos) {
            const formData = new FormData();
            formData.append('file', photo.file!);
            formData.append('stage_id', stageId);

            try {
                const response = await axios.post(`/api/projects/${project.id}/photos`, formData, {
                    onUploadProgress: (progressEvent) => {
                        const progress = progressEvent.total
                            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
                            : 0;
                        setStages((prev) =>
                            prev.map((s) =>
                                s.key === stage.key
                                    ? {
                                          ...s,
                                          photos: s.photos.map((p) =>
                                              p.tempKey === photo.tempKey ? { ...p, progress } : p
                                          ),
                                      }
                                    : s
                            )
                        );
                    },
                });

                if (response.data.success) {
                    const saved = response.data.data;
                    setStages((prev) =>
                        prev.map((s) =>
                            s.key === stage.key
                                ? {
                                      ...s,
                                      photos: s.photos.map((p) =>
                                          p.tempKey === photo.tempKey
                                              ? {
                                                    ...p,
                                                    id: saved.id,
                                                    file_url: saved.file_url,
                                                    file_name: saved.file_name,
                                                    uploading: false,
                                                    progress: 100,
                                                }
                                              : p
                                      ),
                                  }
                                : s
                        )
                    );
                    toast.success(`${saved.file_name} uploaded successfully`);
                } else {
                    setStages((prev) =>
                        prev.map((s) =>
                            s.key === stage.key
                                ? { ...s, photos: s.photos.filter((p) => p.tempKey !== photo.tempKey) }
                                : s
                        )
                    );
                    toast.error(response.data.message || 'Upload failed');
                }
            } catch (error: any) {
                setStages((prev) =>
                    prev.map((s) =>
                        s.key === stage.key
                            ? { ...s, photos: s.photos.filter((p) => p.tempKey !== photo.tempKey) }
                            : s
                    )
                );
                toast.error(error.response?.data?.message || `Failed to upload ${photo.file?.name}`);
            }
        }
    };

    const handleRemovePhoto = async (stageKey: string, photo: Photo) => {
        if (photo.id) {
            try {
                await axios.delete(`/api/projects/photos/${photo.id}`);
            } catch (error: any) {
                toast.error(error.response?.data?.message || 'Failed to remove photo');
                return;
            }
        }
        setStages((prev) =>
            prev.map((s) =>
                s.key === stageKey
                    ? { ...s, photos: s.photos.filter((p) => p.tempKey !== photo.tempKey) }
                    : s
            )
        );
    };

    const handleRemoveStage = async (stage: Stage) => {
        if (stage.id) {
            try {
                await axios.delete(`/api/projects/${project.id}/photos/stages/${stage.id}`);
            } catch (error: any) {
                toast.error(error.response?.data?.message || 'Failed to remove stage');
                return;
            }
        }
        setStages((prev) => prev.filter((s) => s.key !== stage.key));
    };

    const isBusy = stages.some((s) => s.photos.some((p) => p.uploading));

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-[95vw] w-full max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Upload Project Photos</DialogTitle>
                    <DialogDescription>
                        {project.name} — Photos you upload here are only visible to you.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {loading ? (
                        <div className="flex items-center justify-center py-10">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : stages.length === 0 ? (
                        <div className="flex flex-col items-center justify-center gap-3 py-10 border rounded-lg border-dashed">
                            <p className="text-sm text-muted-foreground">
                                No stages yet. Add a stage to start uploading photos.
                            </p>
                        </div>
                    ) : (
                        stages.map((stage) => (
                            <div key={stage.key} className="border rounded-lg p-4 space-y-3">
                                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                                    <div className="space-y-2 flex-1 relative">
                                        <Label htmlFor={`stage-name-${stage.key}`}>Stage Name</Label>
                                        <Input
                                            id={`stage-name-${stage.key}`}
                                            value={stage.name}
                                            onChange={(e) => handleStageNameChange(stage.key, e.target.value)}
                                            placeholder="e.g. Stage 1"
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-9"
                                        onClick={() => handleRemoveStage(stage)}
                                        disabled={isBusy}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Remove Stage
                                    </Button>
                                </div>

                                {stage.photos.length > 0 && (
                                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-8 gap-3">
                                        {stage.photos.map((photo) => {
                                            const src = photo.file
                                                ? URL.createObjectURL(photo.file)
                                                : getUploadUrl(photo.file_url || '', { bustCache: true });
                                            return (
                                                <div key={photo.tempKey} className="relative group aspect-square rounded-lg border overflow-hidden">
                                                    <img
                                                        src={src}
                                                        alt={photo.file_name || 'photo'}
                                                        className="w-full h-full object-cover"
                                                    />
                                                    {photo.uploading && (
                                                        <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center gap-1">
                                                            <Loader2 className="h-5 w-5 animate-spin text-white" />
                                                            <span className="text-xs text-white">{photo.progress}%</span>
                                                        </div>
                                                    )}
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-white/80 hover:bg-white text-destructive"
                                                        onClick={() => handleRemovePhoto(stage.key, photo)}
                                                        disabled={isBusy}
                                                    >
                                                        <X className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <input
                                    ref={(el) => {
                                        fileInputRefs.current[stage.key] = el;
                                    }}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    className="hidden"
                                    onChange={(e) => {
                                        handleAddImages(stage, e.target.files);
                                        e.target.value = '';
                                    }}
                                    disabled={isBusy}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => fileInputRefs.current[stage.key]?.click()}
                                    disabled={isBusy}
                                >
                                    <ImagePlus className="mr-2 h-4 w-4" />
                                    + Add Image
                                </Button>
                            </div>
                        ))
                    )}

                    <Button
                        type="button"
                        variant="outline"
                        onClick={addStage}
                        disabled={loading || isBusy}
                    >
                        + Add Stage
                    </Button>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
