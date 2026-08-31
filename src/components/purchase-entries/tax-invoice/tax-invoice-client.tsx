'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { InlineSelect } from '@/components/common/InlineSelect';
import { Printer, Loader2, FileText } from 'lucide-react';

interface PurchaseEntry {
    id: string;
    sr_no: number;
    entry_date: string;
    party?: { name: string };
    project?: { name: string };
}

interface TaxInvoiceData {
    invoice: {
        id: string;
        sr_no: number;
        entry_date: string;
        voucher_type: string;
    };
    company: {
        name: string;
        address: string;
        gstin: string;
        state: string;
    } | null;
    party: {
        name: string;
        address: string;
        gstin: string;
    };
    project: {
        name: string;
    } | null;
    items: Array<{
        name: string;
        hsn_sac: string;
        unit: string;
        qty: number;
        rate: number;
        total: number;
    }>;
    subtotal: number;
    gst_percent: number;
    gross_total: number;
    cgst: number;
    sgst: number;
    total_gst: number;
    grand_total: number;
    instrument_no: string | null;
    remark: string | null;
}

const formatAmountInWords = (num: number): string => {
    const ones = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
        'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
        'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const tens = [
        '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
    ];

    const convert = (n: number): string => {
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
        if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
        if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
        return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
    };

    if (num === 0) return 'Zero';

    const rupees = Math.floor(num);
    return convert(rupees) + ' Rupees Only';
};

export function TaxInvoiceClient() {
    const [loading, setLoading] = useState(false);
    const [printLoading, setPrintLoading] = useState(false);
    const [selectedEntry, setSelectedEntry] = useState<string>('');
    const [taxInvoiceData, setTaxInvoiceData] = useState<TaxInvoiceData | null>(null);
    const [entryOptions, setEntryOptions] = useState<Array<{ label: string; value: string }>>([]);

    const fetchEntries = useCallback(async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/purchase-entries?limit=9999');
            const entries = response.data.data || response.data;
            const options = (Array.isArray(entries) ? entries : []).map((e: PurchaseEntry) => ({
                label: `#${e.sr_no} - ${e.party?.name || 'Unknown'} - ${new Date(e.entry_date).toLocaleDateString()}`,
                value: e.id,
            }));
            setEntryOptions(options);
        } catch {
            toast.error('Failed to fetch purchase entries');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchEntries();
    }, [fetchEntries]);

    const handleEntrySelect = async (entryId: string) => {
        setSelectedEntry(entryId);
        if (!entryId) {
            setTaxInvoiceData(null);
            return;
        }

        try {
            setLoading(true);
            const response = await axios.get(`/api/tax-invoice?entry_id=${entryId}`);
            setTaxInvoiceData(response.data.data);
        } catch {
            toast.error('Failed to fetch tax invoice');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        setPrintLoading(true);
        setTimeout(() => {
            window.print();
            setPrintLoading(false);
        }, 500);
    };

    return (
        <div className="flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Tax Invoice
                    </h2>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Select Purchase Entry</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>Purchase Entry</Label>
                        <InlineSelect
                            value={selectedEntry}
                            onChange={(value) => handleEntrySelect(value as string)}
                            options={entryOptions}
                            placeholder="Select a purchase entry to print invoice"
                        />
                    </div>

                    {selectedEntry && (
                        <Button onClick={handlePrint} className="w-full" disabled={printLoading}>
                            {printLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            <Printer className="mr-2 h-4 w-4" />
                            Print Tax Invoice
                        </Button>
                    )}
                </CardContent>
            </Card>

            {taxInvoiceData && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-5 w-5" />
                            Tax Invoice Preview
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div
                            id="tax-invoice-preview"
                            className="bg-white p-6 border-2 border-gray-300 rounded-lg print:border-none print:p-0"
                        >
                            <div className="space-y-6">
                                <div className="flex justify-between items-start border-b pb-4">
                                    <div>
                                        <h1 className="text-2xl font-bold text-primary">
                                            {taxInvoiceData.company?.name || 'Company Name'}
                                        </h1>
                                        <p className="text-sm text-muted-foreground">
                                            {taxInvoiceData.company?.address || 'Address'}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            GSTIN: {taxInvoiceData.company?.gstin || 'XXXXXXXXXXXXXX'}
                                        </p>
                                        <p className="text-sm text-muted-foreground">
                                            State: {taxInvoiceData.company?.state || 'State'}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <h2 className="text-xl font-bold">TAX INVOICE</h2>
                                        <p className="text-sm">Invoice No: {taxInvoiceData.invoice.sr_no}</p>
                                        <p className="text-sm">
                                            Date: {new Date(taxInvoiceData.invoice.entry_date).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="border rounded-lg p-3">
                                        <h3 className="font-semibold text-sm mb-2">Bill To:</h3>
                                        <p className="font-medium">{taxInvoiceData.party.name}</p>
                                        <p className="text-sm text-muted-foreground">{taxInvoiceData.party.address}</p>
                                        <p className="text-sm text-muted-foreground">GSTIN: {taxInvoiceData.party.gstin || 'N/A'}</p>
                                    </div>
                                    <div className="border rounded-lg p-3">
                                        <h3 className="font-semibold text-sm mb-2">Ship To:</h3>
                                        {taxInvoiceData.project ? (
                                            <>
                                                <p className="font-medium">{taxInvoiceData.project.name}</p>
                                            </>
                                        ) : (
                                            <p className="text-sm text-muted-foreground">Same as Bill To</p>
                                        )}
                                    </div>
                                </div>

                                <div className="border rounded-lg overflow-hidden">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted">
                                            <tr>
                                                <th className="px-3 py-2 text-left font-semibold">Sr.</th>
                                                <th className="px-3 py-2 text-left font-semibold">Item Description</th>
                                                <th className="px-3 py-2 text-left font-semibold">HSN/SAC</th>
                                                <th className="px-3 py-2 text-right font-semibold">Qty</th>
                                                <th className="px-3 py-2 text-left font-semibold">Unit</th>
                                                <th className="px-3 py-2 text-right font-semibold">Rate</th>
                                                <th className="px-3 py-2 text-right font-semibold">Amount</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {taxInvoiceData.items.map((item, index) => (
                                                <tr key={index} className="border-t">
                                                    <td className="px-3 py-2">{index + 1}</td>
                                                    <td className="px-3 py-2">{item.name}</td>
                                                    <td className="px-3 py-2">{item.hsn_sac || '-'}</td>
                                                    <td className="px-3 py-2 text-right">{item.qty}</td>
                                                    <td className="px-3 py-2">{item.unit}</td>
                                                    <td className="px-3 py-2 text-right">₹{item.rate.toLocaleString()}</td>
                                                    <td className="px-3 py-2 text-right">₹{Number(item.total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="flex justify-end">
                                    <div className="w-64 space-y-2">
                                        <div className="flex justify-between">
                                            <span>CGST ({taxInvoiceData.gst_percent / 2}%):</span>
                                            <span className="text-green-600">+₹{taxInvoiceData.cgst.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>SGST ({taxInvoiceData.gst_percent / 2}%):</span>
                                            <span className="text-green-600">+₹{taxInvoiceData.sgst.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Original Total:</span>
                                            <span>₹{Number(taxInvoiceData.gross_total ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span>Gross Total:</span>
                                            <span>₹{Number(taxInvoiceData.subtotal ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                        <div className="flex justify-between font-bold text-lg border-t pt-2">
                                            <span>Net Payable:</span>
                                            <span>₹{Number(taxInvoiceData.grand_total || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="border rounded-lg p-3 bg-muted/30">
                                    <p className="text-sm font-medium mb-1">Amount in Words:</p>
                                    <p className="text-sm italic">
                                        {formatAmountInWords(taxInvoiceData.grand_total)}
                                    </p>
                                </div>

                                {taxInvoiceData.remark && (
                                    <div className="border rounded-lg p-3">
                                        <p className="text-sm font-medium mb-1">Remark:</p>
                                        <p className="text-sm">{taxInvoiceData.remark}</p>
                                    </div>
                                )}

                                <div className="flex justify-between items-end pt-8">
                                    <div className="text-sm text-muted-foreground">
                                        <p>Terms & Conditions:</p>
                                        <p>1. Payment due within 30 days</p>
                                        <p>2. Interest @18% p.a. on overdue payments</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="border-t border-gray-400 pt-2 w-40">
                                            <p className="text-sm">Authorized Signatory</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <p className="text-xs text-muted-foreground text-center mt-4">
                            This is a computer generated invoice. No signature required.
                        </p>
                    </CardContent>
                </Card>
            )}

            <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #tax-invoice-preview, #tax-invoice-preview * {
            visibility: visible;
          }
          #tax-invoice-preview {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
            padding: 20px !important;
          }
        }
      `}</style>
        </div>
    );
}
