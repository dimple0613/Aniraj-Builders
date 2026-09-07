'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Printer } from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

export interface PrintDocumentItem {
    id: string;
    document_name: string;
    file: string | null;
    file_type?: string | null;
}

interface DocumentBulkPrintProps {
    documents: PrintDocumentItem[];
    disabled?: boolean;
}

export function DocumentBulkPrint({ documents, disabled = false }: DocumentBulkPrintProps) {
    const [printing, setPrinting] = useState(false);

    const handlePrint = async () => {
        if (!documents || documents.length === 0) {
            return;
        }

        const ids = documents.map((d) => d.id).filter(Boolean);
        if (ids.length === 0) {
            return;
        }

        try {
            setPrinting(true);
            const response = await axios.get('/api/documents/print', {
                params: { ids: ids.join(',') },
                responseType: 'blob',
            });

            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            const printWindow = window.open(url, '_blank');
            if (!printWindow) {
                toast.error('Please allow popups to print documents');
                return;
            }

            printWindow.onload = () => {
                printWindow.focus();
                setTimeout(() => {
                    printWindow.print();
                }, 500);
            };
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string } } };
            toast.error(err.response?.data?.error || 'Failed to prepare documents for printing');
        } finally {
            setPrinting(false);
        }
    };

    return (
        <Button
            type="button"
            onClick={handlePrint}
            disabled={disabled || printing}
            variant="outline"
            size="sm"
            className="gap-1.5"
        >
            {printing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
                <Printer className="h-4 w-4" />
            )}
            Print
        </Button>
    );
}
