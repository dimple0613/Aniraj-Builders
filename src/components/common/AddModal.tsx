'use client';

import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, Check, X } from 'lucide-react';

interface AddModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    title: string;
    placeholder: string;
    apiEndpoint: string;
    fieldName: 'unit_name' | 'ay_no' | 'name' | 'item_name';
}

export function AddModal({ isOpen, onClose, onSuccess, title, placeholder, apiEndpoint, fieldName }: AddModalProps) {
    const validationSchema = Yup.object({
        value: Yup.string().trim().required(`${title} is required`),
    });

    const formik = useFormik({
        initialValues: {
            value: '',
        },
        validationSchema,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            try {
                await axios.post(apiEndpoint, { [fieldName]: values.value.trim() });
                toast.success(`${title} created successfully`);
                resetForm();
                onSuccess();
                onClose();
            } catch (err: unknown) {
                const error = err as { response?: { data?: { error?: string } } };
                toast.error(error.response?.data?.error || `Failed to create ${title.toLowerCase()}`);
            } finally {
                setSubmitting(false);
            }
        },
    });

    const progress = useMemo(() => {
        let filled = 0;
        let total = 0;

        const allFields = [
            { value: formik.values.value },
        ];

        allFields.forEach(field => {
            total++;
            if (field.value && field.value.toString().trim() !== '') {
                filled++;
            }
        });

        return total > 0 ? Math.round((filled / total) * 100) : 0;
    }, [formik.values.value]);

    const handleClose = () => {
        formik.resetForm();
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="sm:max-w-md">
                <div className="-mx-6">
                    <div className="w-full h-1.5 bg-red-500  rounded-full overflow-hidden -mt-[24px]">
                        <div
                            className="h-full bg-blue-600 transition-all duration-300 "
                            style={{ width: `${progress}%` }}
                        />
                    </div>
                </div>
                <DialogHeader>
                    <DialogTitle>Add {title}</DialogTitle>
                </DialogHeader>
                <form onSubmit={formik.handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Input
                            {...formik.getFieldProps('value')}
                            placeholder={placeholder}
                            autoFocus
                            onChange={(e) => formik.setFieldValue('value', e.target.value.toUpperCase())}
                        />
                        {formik.touched.value && formik.errors.value && (
                            <p className="text-sm text-destructive">{formik.errors.value}</p>
                        )}
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={handleClose}>
                            <X className="h-4 w-4 mr-1" />
                            Cancel
                        </Button>
                        <Button type="submit" size="sm" disabled={formik.isSubmitting || !formik.values.value.trim()}>
                            {formik.isSubmitting ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                <>
                                    <Check className="h-4 w-4 mr-1" />
                                    Save
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
