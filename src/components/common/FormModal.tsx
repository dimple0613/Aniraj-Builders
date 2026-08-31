'use client';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

interface FormModalProps {
    title: string;
    description?: string;
    isOpen: boolean;
    onClose: () => void;
    onSubmit?: (e: React.FormEvent) => void;
    loading?: boolean;
    children: React.ReactNode;
    submitLabel?: string;
    cancelLabel?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
    progress?: any;
    topContent?: React.ReactNode;
    compact?: boolean;
}

const sizeClasses = {
    sm: 'sm:max-w-[400px]',
    md: 'sm:max-w-[500px]',
    lg: 'sm:max-w-[600px]',
    xl: 'sm:max-w-[800px]',
    '2xl': 'sm:max-w-[1000px]',
    full: 'sm:max-w-none w-[100vw] m-0 rounded-none max-h-[100vh] overflow-y-auto',
};

export function FormModal({
    title,
    description,
    isOpen,
    onClose,
    onSubmit,
    loading = false,
    children,
    submitLabel = 'Save',
    cancelLabel = 'Cancel',
    size = 'md',
    progress,
    topContent,
    compact = false,
}: FormModalProps) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className={`${sizeClasses[size]} flex flex-col max-h-[90vh] overflow-hidden`}>
                {progress !== undefined && progress !== null ? (
                        <div className=" -mx-6">
                            <div className="w-full h-1.5 bg-red-500  rounded-full overflow-hidden -mt-[24px]">
                                <div
                                    className="h-full bg-blue-600 transition-all duration-300 "
                                    style={{ width: `${progress}%` }}
                                />
                            </div>
                        </div>
                    ) : null}
                {topContent}
                <DialogHeader className="shrink-0">
                    <DialogTitle className="text-left">{title}</DialogTitle>
                    {description && <DialogDescription className="text-left">{description}</DialogDescription>}
                </DialogHeader>
                <div className={`grid gap-4 ${compact ? "" : "py-4"} overflow-y-auto min-h-0 flex-1 -mx-6 px-6`}>{children}</div>
                {onSubmit && (
                    <DialogFooter className="shrink-0">
                        <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
                            {cancelLabel}
                        </Button>

                        <Button type="button" onClick={onSubmit} disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {submitLabel}
                        </Button>
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
}
