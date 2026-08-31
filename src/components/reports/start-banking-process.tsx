'use client';

import { useMemo } from 'react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FileText, Trash2 } from 'lucide-react';

export interface BankingRecord {
    id: string;
    partyName: string;
    total: number;
    accountNumber?: string;
    ifsc?: string;
    bankName?: string;
    email?: string;
}

interface StartBankingProcessProps {
    open: boolean;
    onClose: () => void;
    records: BankingRecord[];
    title?: string;
    projectNames?: string[];
    monthName?: string;
}

function toIntAmount(value: number): string {
    return String(Math.round(value || 0));
}

export function StartBankingProcess({
    open,
    onClose,
    records,
    title = 'Start Banking Process',
    projectNames = [],
    monthName = '',
}: StartBankingProcessProps) {
    const effectiveRecords = useMemo(() => records, [records]);

    const hasProject = projectNames.length > 0;
    const hasMonth = monthName.length > 0;

    const buildDescription = (partyName: string) => {
        if (!hasProject && !hasMonth) return partyName;
        if (hasProject && hasMonth) return `Pay for ${projectNames.join(', ')} for ${monthName}`;
        if (hasProject) return `Pay for ${projectNames.join(', ')}`;
        return `Pay for ${monthName}`;
    };

    const handleGenerate = () => {
        if (effectiveRecords.length === 0) return;

        const lines: string[] = ['REFFNO|Account Number|Amount|Description|IFSCCode|Name|EMAIL'];
        effectiveRecords.forEach((rec, index) => {
            const refNo = `REF${String(index + 1).padStart(4, '0')}`;
            const amount = toIntAmount(rec.total);
            const description = buildDescription(rec.partyName);
            const accountNumber = (rec.accountNumber || '').trim();
            const ifsc = (rec.ifsc || '').trim().toUpperCase();
            const name = (rec.partyName || '').trim().toUpperCase();
            const email = (rec.email || '').trim();
            lines.push([refNo, accountNumber, amount, description, ifsc, name, email].join('|'));
        });

        const content = lines.join('\n') + '\n';
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'Downloads/050726PMT.txt';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);

        toast.success(`Banking file generated for ${effectiveRecords.length} record(s)`);
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>
                        {/* Generate the banking file for the selected records. The file will be downloaded as Downloads/050726PMT.txt */}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex items-center justify-between rounded-md border bg-muted/40 px-3 py-2 text-sm">
                    <span>
                        <strong>{effectiveRecords.length}</strong> record(s) selected
                    </span>
                    <span className="font-semibold">
                        Total: ₹{effectiveRecords.reduce((s, r) => s + (r.total || 0), 0).toLocaleString()}
                    </span>
                </div>

                <div className="rounded-md border overflow-hidden">
                    <table className="w-full text-xs">
                        <thead className="bg-muted/60">
                            <tr>
                                <th className="px-2 py-1.5 text-left font-medium">Ref</th>
                                <th className="px-2 py-1.5 text-left font-medium">Name</th>
                                <th className="px-2 py-1.5 text-right font-medium">Amount</th>
                                <th className="px-2 py-1.5 text-left font-medium">Description</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {effectiveRecords.map((rec, index) => (
                                <tr key={rec.id}>
                                    <td className="px-2 py-1.5 font-mono">REF{String(index + 1).padStart(4, '0')}</td>
                                    <td className="px-2 py-1.5 max-w-[200px] truncate" title={rec.partyName}>
                                        {rec.partyName}
                                    </td>
                                    <td className="px-2 py-1.5 text-right">{toIntAmount(rec.total)}</td>
                                    <td className="px-2 py-1.5">
                                        <span className="block text-xs text-muted-foreground">
                                            {buildDescription(rec.partyName)}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                    <p className="font-medium mb-1">File format (piped, tab-separated style):</p>
                    <code className="block whitespace-pre-wrap">
                        REFFNO|Account Number|Amount|Description|IFSCCode|Name|EMAIL
                    </code>
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={onClose}>
                        <Trash2 className="h-4 w-4" />
                        Cancel
                    </Button>
                    <Button onClick={handleGenerate} disabled={effectiveRecords.length === 0}>
                        <Download className="h-4 w-4" />
                        Generate File
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
