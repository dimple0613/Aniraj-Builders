'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { toast } from 'sonner';
import { formatIndianCurrency } from '@/lib/tax-utils';
import { numberToWords } from '@/lib/financial-year';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Printer, Loader2, Save, ArrowLeft, Edit3, Eye, Building2, Banknote } from 'lucide-react';

interface PurchaseEntry {
    id: string;
    sr_no: number;
    entry_no: string;
    entry_date: string;
    voucher_type: string;
    account_type: string;
    transaction_type: string;
    instrument_no: string | null;
    gst_percent: number;
    gst_total: number;
    received_by: string | null;
    remark: string | null;
    party: {
        id: string;
        name: string;
        address: string | null;
        gst_no: string | null;
    };
    project: {
        id: string;
        name: string;
    } | null;
    materials: Array<{
        id: string;
        qty: number;
        rate: number;
        total: number;
        material: {
            id: string;
            name: string;
            hsn_sac: string | null;
        };
    }>;
    locations: Array<{
        id: string;
        location: {
            id: string;
            name: string;
        };
    }>;
    receivedByParty?: {
        id: string;
        name: string;
    } | null;
}

interface CompanyData {
    company_name: string;
    address: string | null;
    gstin_uin: string | null;
    state_name: string | null;
    state_code: string | null;
    contact: string | null;
    hsn_sac: string | null;
    bank_name: string | null;
    branch_name: string | null;
    ifsc_code: string | null;
    account_no: string | null;
    account_holder_name: string | null;
    cgst_rate: number | null;
    sgst_rate: number | null;
}

interface BankAccount {
    id: string;
    account_name: string;
    account_number: string;
    bank_name: string;
    ifsc_code: string | null;
}

interface Props {
    purchaseEntry: PurchaseEntry;
    company: CompanyData;
    bankAccounts: BankAccount[];
}

export default function PurchaseTaxInvoicePage({ purchaseEntry: initialEntry, company, bankAccounts }: Props) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');

    const [formData, setFormData] = useState({
        invoice_no: initialEntry.entry_no || `PE/${initialEntry.sr_no}`,
        invoice_date: initialEntry.entry_date ? new Date(initialEntry.entry_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        place_of_supply: company.state_name || '',
        buyer_name: initialEntry.party?.name || '',
        buyer_address: initialEntry.party?.address || '',
        buyer_gstin: initialEntry.party?.gst_no || '',
        buyer_state: company.state_name || '',
        buyer_state_code: company.state_code || '',
        dept_name: initialEntry.project?.name || '',
        dept_bill_no: initialEntry.instrument_no || '',
        remarks: initialEntry.remark || '',
        hsn_sac: company.hsn_sac || '',
        cgst_percent: (company.cgst_rate || 9).toString(),
        sgst_percent: (company.sgst_rate || 9).toString(),
        gstEnabled: initialEntry.gst_percent > 0,
        is_cgst_enabled: true,
        is_sgst_enabled: true,
        account_holder_name: company.account_holder_name || '',
        bank_name: company.bank_name || '',
        branch_name: company.branch_name || '',
        account_no: company.account_no || '',
        ifsc_code: company.ifsc_code || '',
        selected_bank_id: '',
    });

    const calculations = useMemo(() => {
        const inclusivePrice = initialEntry.materials.reduce((sum, m) => sum + (m.total ? Number(m.total) : 0), 0);
        const cgstRate = parseFloat(formData.cgst_percent) || 0;
        const sgstRate = parseFloat(formData.sgst_percent) || 0;
        const totalGstRate = cgstRate + sgstRate;

        let grossTotal = inclusivePrice;
        let cgst = 0;
        let sgst = 0;
        let taxtotal = 0;
        let netPayable = inclusivePrice;

        if (formData.gstEnabled && totalGstRate > 0) {
            taxtotal = inclusivePrice - (100 / (100 + totalGstRate)) * inclusivePrice;
            if (formData.is_cgst_enabled) {
                cgst = formData.is_sgst_enabled ? taxtotal / 2 : taxtotal;
                sgst = formData.is_sgst_enabled ? taxtotal - cgst : 0;
            } else if (formData.is_sgst_enabled) {
                sgst = taxtotal;
            }
            grossTotal = Number((inclusivePrice - Number(cgst.toFixed(2)) - Number(sgst.toFixed(2))).toFixed(2));
            netPayable = inclusivePrice;
        }

        return {
            subtotal: inclusivePrice,
            grossTotal,
            cgst,
            sgst,
            taxtotal,
            netPayable,
        };
    }, [initialEntry.materials, formData]);

    const handleFieldChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSave = async () => {
        try {
            setLoading(true);
            const totalGst = calculations.cgst + calculations.sgst;
            const response = await axios.put(`/api/purchase-entries/${initialEntry.id}`, {
                gst_percent: (parseFloat(formData.cgst_percent) || 0) + (parseFloat(formData.sgst_percent) || 0),
                gst_total: totalGst,
            });

            if (response.data.success) {
                toast.success('Invoice settings saved successfully');
            }
        } catch {
            toast.error('Failed to save settings');
        } finally {
            setLoading(false);
        }
    };

    const handlePrint = () => {
        setTimeout(() => {
            window.print();
        }, 500);
    };

    const formatDate = (dateStr: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    return (
        <div className="max-w-7xl mx-auto space-y-4 pb-20">
            <div className="flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
                <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                    <div className="flex items-center gap-3">
                        <Button variant="ghost" size="icon" onClick={() => router.back()}>
                            <ArrowLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex flex-col gap-1">
                            <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                                Purchase Tax Invoice
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Entry #{initialEntry.sr_no} - {initialEntry.party?.name}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button
                            variant="outline"
                            onClick={handlePrint}
                            size="sm"
                            className="gap-1 print:hidden"
                        >
                            <Printer className="h-4 w-4" />
                            Print
                        </Button>
                        <div className="flex bg-slate-100 rounded-lg p-1 print:hidden">
                            <Button
                                variant={viewMode === 'edit' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('edit')}
                                className="gap-1"
                            >
                                <Edit3 className="h-3 w-3" />
                                <span className="hidden sm:inline">Edit</span>
                            </Button>
                            <Button
                                variant={viewMode === 'preview' ? 'default' : 'ghost'}
                                size="sm"
                                onClick={() => setViewMode('preview')}
                                className="gap-1"
                            >
                                <Eye className="h-3 w-3" />
                                <span className="hidden sm:inline">Preview</span>
                            </Button>
                        </div>
                        <Button onClick={handleSave} disabled={loading} size="sm" className="shadow-md print:hidden">
                            {loading && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                            <Save className="h-4 w-4 mr-1" />
                            Save
                        </Button>
                    </div>
                </div>
            </div>

            {viewMode === 'edit' ? (
                <EditModeView
                    formData={formData}
                    calculations={calculations}
                    company={company}
                    bankAccounts={bankAccounts}
                    initialEntry={initialEntry}
                    onFieldChange={handleFieldChange}
                    onBankSelect={handleFieldChange}
                />
            ) : (
                <PreviewModeView
                    formData={formData}
                    calculations={calculations}
                    company={company}
                    initialEntry={initialEntry}
                    formatDate={formatDate}
                    numberToWords={numberToWords}
                />
            )}

            <style jsx global>{`
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    .invoice-wrapper, .invoice-wrapper * {
                        visibility: visible;
                    }
                    .invoice-wrapper {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                        padding: 20px;
                    }
                }
            `}</style>
        </div>
    );
}

interface EditModeViewProps {
    formData: any;
    calculations: any;
    company: CompanyData;
    bankAccounts: BankAccount[];
    initialEntry: PurchaseEntry;
    onFieldChange: (field: string, value: any) => void;
    onBankSelect: (field: string, value: any) => void;
}

function EditModeView({ formData, calculations, company, bankAccounts, initialEntry, onFieldChange, onBankSelect }: EditModeViewProps) {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Building2 className="h-5 w-5" />
                            Invoice Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="space-y-2">
                                <Label>Invoice No</Label>
                                <Input
                                    value={formData.invoice_no}
                                    onChange={(e) => onFieldChange('invoice_no', e.target.value)}
                                    className="font-bold"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Invoice Date</Label>
                                <Input
                                    type="date"
                                    value={formData.invoice_date}
                                    onChange={(e) => onFieldChange('invoice_date', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Place of Supply</Label>
                                <Input
                                    value={formData.place_of_supply}
                                    onChange={(e) => onFieldChange('place_of_supply', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Received By</Label>
                                <Input
                                    value={initialEntry.receivedByParty?.name || '-'}
                                    readOnly
                                    className="bg-slate-50"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Buyer Name</Label>
                                <Input
                                    value={formData.buyer_name}
                                    onChange={(e) => onFieldChange('buyer_name', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Buyer GSTIN</Label>
                                <Input
                                    value={formData.buyer_gstin}
                                    onChange={(e) => onFieldChange('buyer_gstin', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>HSN/SAC</Label>
                                <Input
                                    value={formData.hsn_sac}
                                    onChange={(e) => onFieldChange('hsn_sac', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Buyer Address</Label>
                            <Input
                                value={formData.buyer_address}
                                onChange={(e) => onFieldChange('buyer_address', e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label>Dept Name</Label>
                                <Input
                                    value={formData.dept_name}
                                    onChange={(e) => onFieldChange('dept_name', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Dept Bill No</Label>
                                <Input
                                    value={formData.dept_bill_no}
                                    onChange={(e) => onFieldChange('dept_bill_no', e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Remarks</Label>
                                <Input
                                    value={formData.remarks}
                                    onChange={(e) => onFieldChange('remarks', e.target.value)}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Items Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-muted">
                                    <tr>
                                        <th className="p-2 text-left">Sr.</th>
                                        <th className="p-2 text-left">Item</th>
                                        <th className="p-2 text-left">HSN</th>
                                        <th className="p-2 text-right">Qty</th>
                                        <th className="p-2 text-right">Rate</th>
                                        <th className="p-2 text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {initialEntry.materials.map((item, idx) => (
                                        <tr key={item.id} className="border-t">
                                            <td className="p-2">{idx + 1}</td>
                                            <td className="p-2">{item.material?.name}</td>
                                            <td className="p-2">{item.material?.hsn_sac || '-'}</td>
                                            <td className="p-2 text-right">{Number(item.qty)}</td>
                                            <td className="p-2 text-right">₹{formatIndianCurrency(Number(item.rate))}</td>
                                            <td className="p-2 text-right">₹{formatIndianCurrency(Number(item.total))}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-muted/50">
                                    <tr>
                                        <td colSpan={5} className="p-2 text-right font-bold">Total:</td>
                                        <td className="p-2 text-right font-bold">₹{formatIndianCurrency(calculations.subtotal)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>GST Settings</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="gstEnabled"
                                checked={formData.gstEnabled}
                                onCheckedChange={(checked) => onFieldChange('gstEnabled', checked)}
                            />
                            <Label htmlFor="gstEnabled">Enable GST</Label>
                        </div>

                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="is_cgst_enabled"
                                checked={formData.is_cgst_enabled}
                                onCheckedChange={(checked) => onFieldChange('is_cgst_enabled', checked)}
                            />
                            <Label htmlFor="is_cgst_enabled">CGST Enabled</Label>
                        </div>
                        {formData.is_cgst_enabled && (
                            <div className="pl-6 space-y-2">
                                <Label>CGST %</Label>
                                <Input
                                    type="number"
                                    value={formData.cgst_percent}
                                    onChange={(e) => onFieldChange('cgst_percent', e.target.value)}
                                />
                                <p className="text-sm text-muted-foreground">
                                    CGST Amount: ₹{formatIndianCurrency(calculations.cgst)}
                                </p>
                            </div>
                        )}

                        <div className="flex items-center space-x-2">
                            <Checkbox
                                id="is_sgst_enabled"
                                checked={formData.is_sgst_enabled}
                                onCheckedChange={(checked) => onFieldChange('is_sgst_enabled', checked)}
                            />
                            <Label htmlFor="is_sgst_enabled">SGST Enabled</Label>
                        </div>
                        {formData.is_sgst_enabled && (
                            <div className="pl-6 space-y-2">
                                <Label>SGST %</Label>
                                <Input
                                    type="number"
                                    value={formData.sgst_percent}
                                    onChange={(e) => onFieldChange('sgst_percent', e.target.value)}
                                />
                                <p className="text-sm text-muted-foreground">
                                    SGST Amount: ₹{formatIndianCurrency(calculations.sgst)}
                                </p>
                            </div>
                        )}

                        <div className="border-t pt-4 space-y-2">
                            <div className="flex justify-between">
                                <span>CGST ({formData.cgst_percent}%):</span>
                                <span className="font-bold text-green-600">+₹{formatIndianCurrency(calculations.cgst)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>SGST ({formData.sgst_percent}%):</span>
                                <span className="font-bold text-green-600">+₹{formatIndianCurrency(calculations.sgst)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Gross Total:</span>
                                <span className="font-bold">₹{formatIndianCurrency(calculations.subtotal)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span>Original Total:</span>
                                <span className="font-bold">₹{formatIndianCurrency(calculations.grossTotal)}</span>
                            </div>
                            <div className="flex justify-between bg-primary text-primary-foreground p-3 rounded-lg">
                                <span className="font-bold">Net Payable:</span>
                                <span className="font-black text-lg">₹{formatIndianCurrency(calculations.netPayable)}</span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Banknote className="h-5 w-5" />
                            Bank Details
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {bankAccounts.length > 0 && (
                            <div className="space-y-2">
                                <Label>Select Bank Account</Label>
                                <select
                                    className="w-full p-2 border rounded-md"
                                    value={formData.selected_bank_id}
                                    onChange={(e) => {
                                        const selected = bankAccounts.find(b => b.id === e.target.value);
                                        if (selected) {
                                            onBankSelect('selected_bank_id', selected.id);
                                            onBankSelect('account_holder_name', selected.account_name);
                                            onBankSelect('bank_name', selected.bank_name);
                                            onBankSelect('account_no', selected.account_number);
                                            onBankSelect('ifsc_code', selected.ifsc_code || '');
                                        }
                                    }}
                                >
                                    <option value="">-- Select Bank --</option>
                                    {bankAccounts.map(bank => (
                                        <option key={bank.id} value={bank.id}>
                                            {bank.bank_name} - {bank.account_number}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div className="space-y-2">
                            <Label>A/C Holder Name</Label>
                            <Input
                                value={formData.account_holder_name}
                                onChange={(e) => onFieldChange('account_holder_name', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Bank Name</Label>
                            <Input
                                value={formData.bank_name}
                                onChange={(e) => onFieldChange('bank_name', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>A/C No</Label>
                            <Input
                                value={formData.account_no}
                                onChange={(e) => onFieldChange('account_no', e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>IFSC Code</Label>
                            <Input
                                value={formData.ifsc_code}
                                onChange={(e) => onFieldChange('ifsc_code', e.target.value)}
                            />
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

interface PreviewModeViewProps {
    formData: any;
    calculations: any;
    company: CompanyData;
    initialEntry: PurchaseEntry;
    formatDate: (date: string) => string;
    numberToWords: (num: number) => string;
}

function PreviewModeView({ formData, calculations, company, initialEntry, formatDate, numberToWords }: PreviewModeViewProps) {
    return (
        <div className="invoice-wrapper bg-white p-4">
            <table cellSpacing={0} className="w-full border-collapse text-[13px]">
                <tbody>
                    <tr className="text-slate-700 text-left">
                        <td colSpan={3} className="border border-slate-300 p-3" style={{ verticalAlign: 'baseline' }}>
                            <div className="p-3">
                                <b className="text-lg">{company.company_name}</b>
                                <br />
                                <span style={{ whiteSpace: 'pre-wrap' }}>{company.address}</span>
                                <br />
                                GSTIN/UIN: {company.gstin_uin}
                                <br />
                                State Name: {company.state_name}, Code: {company.state_code}
                                <br />
                                Contact: {company.contact}
                            </div>
                            <hr className="border-b border-slate-300" />
                            <div className="p-3">
                                Buyer (Bill to) <br />
                                <b>{formData.buyer_name}</b>
                                <br />
                                <span style={{ whiteSpace: 'pre-wrap' }}>{formData.buyer_address}</span>
                                <br />
                                GSTIN/UIN: {formData.buyer_gstin}
                                <br />
                                State Name: {formData.buyer_state}, Code: {formData.buyer_state_code}
                            </div>
                        </td>
                        <td className="border border-slate-300" colSpan={4}>
                            <div className="flex">
                                <div className="w-1/2 p-3 py-2 border-r border-slate-300">
                                    Invoice No.
                                    <br />
                                    <b>{formData.invoice_no}</b>
                                </div>
                                <div className="w-1/2 p-3 py-2">
                                    Dated
                                    <br />
                                    <b>{formatDate(formData.invoice_date)}</b>
                                </div>
                            </div>
                            <hr className="border-b border-slate-300" />
                            <div className="p-3 py-2 border-slate-300">
                                Dept. Name: <b>{formData.dept_name}</b>
                            </div>
                            <hr className="border-b border-slate-300" />
                            <div className="p-3 py-2 border-slate-300">
                                Dept. Bill No.: <b>{formData.dept_bill_no}</b>
                            </div>
                            <hr className="border-b border-slate-300" />
                            <div className="p-3 py-2 h-20 border-slate-300">
                                Remarks: <b>{formData.remarks || '-'}</b>
                            </div>
                        </td>
                    </tr>

                    <tr className="bg-slate-100 text-slate-700 text-left">
                        <th className="p-3 border font-bold border-slate-300 w-8">Sr No.</th>
                        <th colSpan={3} className="p-3 border font-bold border-slate-300">Description of Services</th>
                        <th className="p-3 border font-bold border-slate-300">HSN/SAC</th>
                        <th className="p-3 border font-bold border-slate-300">Quantity</th>
                        <th className="p-3 border font-bold border-slate-300 text-right">Amount</th>
                    </tr>

                    {initialEntry.materials.map((item, idx) => (
                        <tr key={item.id} className="hover:bg-blue-50 transition-colors">
                            <td className="p-3 py-2 border text-left text-muted-foreground">{idx + 1}</td>
                            <td colSpan={3} className="p-3 py-2 border text-left text-muted-foreground">
                                <b>WORK CONTRACT</b><br />
                                {item.material?.name}
                            </td>
                            <td className="p-3 py-2 border text-left text-muted-foreground">{item.material?.hsn_sac || formData.hsn_sac}</td>
                            <td className="p-3 py-2 border text-left text-muted-foreground">{Number(item.qty)}</td>
                            <td className="p-3 py-2 border text-right text-muted-foreground">
                                <b>₹{formatIndianCurrency(Number(item.total))}</b>
                            </td>
                        </tr>
                    ))}

                    {[...Array(Math.max(0, 5 - initialEntry.materials.length))].map((_, idx) => (
                        <tr key={`empty-${idx}`}>
                            <td className="p-3 py-2 border h-8"></td>
                            <td colSpan={3} className="p-3 py-2 border"></td>
                            <td className="p-3 py-2 border"></td>
                            <td className="p-3 py-2 border"></td>
                            <td className="p-3 py-2 border"></td>
                        </tr>
                    ))}

                    <tr>
                        <td colSpan={6} className="p-3 py-2 border text-right font-bold">Total:</td>
                        <td className="p-3 py-2 border text-right font-bold">₹{formatIndianCurrency(calculations.subtotal)}</td>
                    </tr>

                    <tr>
                        <td colSpan={7} className="p-3 border text-left">
                            <p style={{ display: 'flex' }}>
                                Amount Chargeable (in words): <i style={{ marginLeft: 'auto' }}>E. &amp; O.E</i>
                            </p>
                            <b>{numberToWords(calculations.netPayable)}</b>
                        </td>
                    </tr>

                    <tr className="bg-slate-100 text-slate-700 text-left">
                        <th rowSpan={2} className="p-3 border font-bold border-slate-300 text-center">HSN/SAC</th>
                        <th rowSpan={2} className="p-3 border font-bold border-slate-300 text-center">Taxable Value</th>
                        <th colSpan={2} className="p-3 border font-bold border-slate-300 text-center">CGST</th>
                        <th colSpan={2} className="p-3 border font-bold border-slate-300 text-center">SGST/UTGST</th>
                        <th rowSpan={2} className="p-3 border font-bold border-slate-300 text-center">Total Tax Amount</th>
                    </tr>
                    <tr className="bg-slate-100 text-slate-700 text-left">
                        <th className="p-3 border font-bold border-slate-300 text-center">Rate</th>
                        <th className="p-3 border font-bold border-slate-300 text-center">Amount</th>
                        <th className="p-3 border font-bold border-slate-300 text-center">Rate</th>
                        <th className="p-3 border font-bold border-slate-300 text-center">Amount</th>
                    </tr>

                    <tr className="hover:bg-blue-50 transition-colors">
                        <td className="p-3 py-2 border text-right text-muted-foreground">{initialEntry.materials[0]?.material?.hsn_sac || formData.hsn_sac}</td>
                        <td className="p-3 py-2 border text-right text-muted-foreground">{formatIndianCurrency(calculations.grossTotal)}</td>
                        <td className="p-3 py-2 border text-right text-muted-foreground">{formData.cgst_percent}%</td>
                        <td className="p-3 py-2 border text-right text-muted-foreground">-{formatIndianCurrency(calculations.cgst)}</td>
                        <td className="p-3 py-2 border text-right text-muted-foreground">{formData.sgst_percent}%</td>
                        <td className="p-3 py-2 border text-right text-muted-foreground">-{formatIndianCurrency(calculations.sgst)}</td>
                        <td className="p-3 py-2 border text-right text-muted-foreground">-{formatIndianCurrency(calculations.taxtotal)}</td>
                    </tr>

                    <tr>
                        <td className="p-3 py-2 border text-right text-muted-foreground"><b>Total</b></td>
                        <td className="p-3 py-2 border text-right text-muted-foreground"><b>{formatIndianCurrency(calculations.grossTotal)}</b></td>
                        <td className="p-3 py-2 border"></td>
                        <td className="p-3 py-2 border text-right text-muted-foreground"><b>-{formatIndianCurrency(calculations.cgst)}</b></td>
                        <td className="p-3 py-2 border"></td>
                        <td className="p-3 py-2 border text-right text-muted-foreground"><b>-{formatIndianCurrency(calculations.sgst)}</b></td>
                        <td className="p-3 py-2 border text-right text-muted-foreground"><b>-{formatIndianCurrency(calculations.taxtotal)}</b></td>
                    </tr>

                    <tr>
                        <td colSpan={7} className="p-3 border text-left">
                            Tax Amount (in words): <b>{numberToWords(calculations.taxtotal)}</b>
                        </td>
                    </tr>

                    <tr>
                        <td colSpan={3} className="p-3 border" style={{ borderRight: 0, borderBottom: 0, borderTop: 0 }}></td>
                        <td colSpan={4} className="p-3 border" style={{ borderBottom: 0, borderTop: 0, borderLeft: 0 }}>
                            <p className="font-bold">Company&apos;s Bank Details</p>
                            <p><span style={{ width: '28%', display: 'inline-block' }}>A/c Holder&apos;s Name:</span> <b>{formData.account_holder_name}</b></p>
                            <p><span style={{ width: '28%', display: 'inline-block' }}>Bank Name:</span> <b>{formData.bank_name}</b></p>
                            <p><span style={{ width: '28%', display: 'inline-block' }}>A/c No.:</span> <b>{formData.account_no}</b></p>
                            <p><span style={{ width: '28%', display: 'inline-block' }}>Branch &amp; IFS Code:</span> <b>{formData.branch_name} &amp; {formData.ifsc_code}</b></p>
                        </td>
                    </tr>

                    <tr>
                        <td colSpan={3} className="p-3 border text-left">
                            <p className="font-bold" style={{ textDecoration: 'underline' }}>Declaration</p>
                            <p>We declare that this invoice shows the actual price of the goods described and that all particulars are true and correct.</p>
                        </td>
                        <td colSpan={4} className="p-3 border text-right">
                            <b>for {company.company_name}</b>
                            <p><br /></p>
                            <p><br /></p>
                            <p className="text-muted-foreground">Authorised Signatory</p>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}
