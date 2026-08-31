'use client';

import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFormik } from 'formik';
import * as Yup from 'yup';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InlineSelect } from '@/components/common/InlineSelect';

interface CashBook {
    id: string;
    cash_name: string;
    code: string;
    opening_balance: number;
}

interface CashTransaction {
    id: string;
    cash_book_id?: string;
    account_id?: string;
    transaction_date: string;
    transaction_type: string;
    ledger: string;
    project_id?: string | null;
    party_id?: string | null;
    particular?: string | null;
    credit_amount: number;
    debit_amount: number;
    balance: number;
    cashBook?: { id: string; name: string; code: string };
    project?: { id: string; name: string } | null;
    party?: { id: string; name: string } | null;
}

interface CashTransactionFormProps {
    transaction?: CashTransaction | null;
    cashBookId?: string;
    onSuccess: () => void;
    onCancel: () => void;
    onProgress?: (progress: number) => void;
}

interface LedgerOption {
    label: string;
    value: string;
}

const validationSchema = Yup.object({
    cash_book_id: Yup.string().required('Cash book is required'),
    transaction_date: Yup.string().required('Transaction date is required'),
    transaction_type: Yup.string().required('Transaction type is required').oneOf(['DEBIT', 'CREDIT']),
    ledger: Yup.string().required('Ledger is required').min(1, 'Ledger is required'),
    project_id: Yup.string().nullable().optional(),
    party_id: Yup.string().required('Party is required'),
    particular: Yup.string().nullable().optional(),
    credit_amount: Yup.number().min(0).default(0),
    debit_amount: Yup.number().min(0).default(0),
});

const TRANSACTION_TYPES = [
    { label: 'Payment (PMT)', value: 'DEBIT' },
    { label: 'Receipt (RCPT)', value: 'CREDIT' },
];

const DEFAULT_PARTICULARS = [
    { label: 'PMT RCVD', value: 'PMT RCVD' },
    { label: 'PMT TO', value: 'PMT TO' },
    { label: 'DIESEL', value: 'DIESEL' },
    { label: 'ROKADIYA', value: 'ROKADIYA' },
    { label: 'TRACTOR', value: 'TRACTOR' },
    { label: 'SALARY', value: 'SALARY' },
    { label: 'RENT', value: 'RENT' },
    { label: 'STATIONERY', value: 'STATIONERY' },
    { label: 'MISC EXP', value: 'MISC EXP' },
    { label: 'INCOME', value: 'INCOME' },
];

export function CashTransactionForm({ transaction, cashBookId, onSuccess, onCancel, onProgress }: CashTransactionFormProps) {
    const [cashBookOptions, setCashBookOptions] = useState<Array<{ label: string; value: string }>>([]);
    const [partyOptions, setPartyOptions] = useState<Array<{ label: string; value: string }>>([]);
    const [projectOptions, setProjectOptions] = useState<Array<{ label: string; value: string }>>([]);
    const [ledgerOptions, setLedgerOptions] = useState<LedgerOption[]>([]);
    const [particularOptions] = useState(DEFAULT_PARTICULARS);
    const [isLoadingOptions, setIsLoadingOptions] = useState(true);

    const formik = useFormik({
        initialValues: {
            cash_book_id: transaction ? (transaction.cash_book_id || transaction.account_id || '') : (cashBookId || ''),
            account_id: transaction ? (transaction.account_id || transaction.cash_book_id || '') : (cashBookId || ''),
            transaction_date: transaction?.transaction_date ? new Date(transaction.transaction_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            transaction_type: transaction?.transaction_type || 'DEBIT',
            ledger: transaction?.ledger || '',
            project_id: transaction?.project_id || '',
            party_id: transaction?.party_id || '',
            particular: transaction?.particular || '',
            credit_amount: transaction?.credit_amount?.toString() || '0',
            debit_amount: transaction?.debit_amount?.toString() || '0',
        },
        validationSchema,
        onSubmit: async (values) => {
            try {
                const isCredit = values.transaction_type === 'CREDIT';
                const isPayment = values.transaction_type === 'DEBIT';
                const submitData: any = {
                    account_id: values.account_id || values.cash_book_id,
                    transaction_date: new Date(values.transaction_date),
                    transaction_type: values.transaction_type,
                    ledger: values.ledger,
                    ledger_type: isPayment ? 'RECEIVABLE' : 'PAYABLE',
                    project_id: values.project_id || undefined,
                    party_id: values.party_id || undefined,
                    particular: values.particular || undefined,
                    credit_amount: isCredit ? (parseFloat(values.credit_amount) || 0) : 0,
                    debit_amount: !isCredit ? (parseFloat(values.debit_amount) || 0) : 0,
                };

                if (transaction) {
                    await axios.put(`/api/cash-transactions/${transaction.id}`, submitData);
                    toast.success('Transaction updated successfully');
                } else {
                    await axios.post('/api/cash-transactions', submitData);
                    toast.success('Transaction created successfully');
                }
                onSuccess();
            } catch (error: any) {
                toast.error(error.response?.data?.message || 'Failed to save transaction');
            }
        },
    });

    useEffect(() => {
        const fetchOptions = async () => {
            try {
                setIsLoadingOptions(true);
                const [cashBooksRes, partiesRes, projectsRes, ledgersRes] = await Promise.all([
                    axios.get('/api/accounts?limit=9999&type=CASH'),
                    axios.get('/api/parties?limit=9999'),
                    axios.get('/api/projects?limit=9999'),
                    axios.get('/api/ledgers?module=cash&limit=9999'),
                ]);

                const cashBooks = cashBooksRes.data.data || [];
                setCashBookOptions(cashBooks.map((cb: CashBook) => ({
                    label: `${cb.cash_name}`,
                    value: cb.id
                })));

                setPartyOptions((partiesRes.data.data || []).map((p: any) => ({
                    label: p.name,
                    value: p.id
                })));

                const projects = projectsRes.data.data || [];
                setProjectOptions(projects.map((p: any) => ({
                    label: p.unique_name || p.name,
                    value: p.id
                })));

                const ledgers: LedgerOption[] = (ledgersRes.data.data || []).map((l: any) => ({
                    label: l.name,
                    value: l.code,
                }));

                if (transaction?.ledger && !ledgers.some((l) => l.value === transaction.ledger)) {
                    ledgers.push({ label: transaction.ledger, value: transaction.ledger });
                }
                setLedgerOptions(ledgers);

                if (!transaction && cashBooks.length === 1 && !formik.values.account_id) {
                    formik.setFieldValue('account_id', cashBooks[0].id);
                    formik.setFieldValue('cash_book_id', cashBooks[0].id);
                }

                if (!transaction && projects.length === 1 && !formik.values.project_id) {
                    formik.setFieldValue('project_id', projects[0].id);
                }
            } catch (error) {
                console.error('Failed to fetch options:', error);
            } finally {
                setIsLoadingOptions(false);
            }
        };
        fetchOptions();
    }, []);

    useEffect(() => {
        if (!isLoadingOptions && formik.values.ledger) {
            const isValidForType = ledgerOptions.some(
                l => l.value === formik.values.ledger
            );
            if (!isValidForType) {
                formik.setFieldValue('ledger', '');
            }
        }
    }, [isLoadingOptions, formik.values.transaction_type, ledgerOptions]);

    useEffect(() => {
        const values = formik.values;
        let filled = 0;
        let total = 0;

        const stringFields = [
            'cash_book_id', 'transaction_date', 'transaction_type', 'ledger',
            'project_id', 'party_id', 'particular', 'credit_amount', 'debit_amount',
        ];

        stringFields.forEach(field => {
            total++;
            const val = (values as any)[field];
            if (val && val.toString().trim() !== '') {
                filled++;
            }
        });

        const result = total > 0 ? Math.round((filled / total) * 100) : 0;
        onProgress?.(result);
    }, [formik.values, onProgress]);

    const currentLedgers = useMemo(() => {
        return ledgerOptions.map(ledger => ({
            label: ledger.label,
            value: ledger.value,
        }));
    }, [ledgerOptions]);

    const handleTypeChange = (value: string | string[]) => {
        const newType = Array.isArray(value) ? value[0] || '' : value || '';
        formik.setFieldValue('transaction_type', newType);
    };

    const handleAddLedger = async (name: string): Promise<{ id: string; label: string } | null> => {
        try {
            const response = await axios.post('/api/ledgers', {
                name,
                include_expenses_activity: false,
                show_in_cash_book: true,
                show_in_bank_book: false,
            });
            const ledger = response.data.data;
            if (ledger) {
                setLedgerOptions((prev) => {
                    const exists = prev.some((l) => l.value === ledger.code);
                    return exists ? prev : [...prev, { label: ledger.name, value: ledger.code }];
                });
                return { id: ledger.code, label: ledger.name };
            }
            return null;
        } catch (error: any) {
            throw new Error(error?.response?.data?.message || 'Failed to create ledger');
        }
    };

    return (
        <form onSubmit={formik.handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                    <Label>Cash Account <span className="text-destructive">*</span></Label>
                    <InlineSelect
                        value={formik.values.account_id || formik.values.cash_book_id}
                        onChange={(value) => {
                            const val = Array.isArray(value) ? value[0] || '' : value || '';
                            formik.setFieldValue('account_id', val);
                            formik.setFieldValue('cash_book_id', val);
                        }}
                        placeholder="Select cash account"
                        options={cashBookOptions}
                        disabled={isLoadingOptions}
                    />
                    {formik.touched.cash_book_id && formik.errors.cash_book_id && (
                        <p className="text-xs text-red-500">{String(formik.errors.cash_book_id)}</p>
                    )}
                </div>

                <div className="space-y-2 relative">
                    <Label>Date <span className="text-destructive">*</span></Label>
                    <Input
                        type="date"
                        {...formik.getFieldProps('transaction_date')}
                    />
                    {formik.touched.transaction_date && formik.errors.transaction_date && (
                        <p className="text-xs text-red-500">{String(formik.errors.transaction_date)}</p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                    <Label>Type <span className="text-destructive">*</span></Label>
                    <InlineSelect
                        value={formik.values.transaction_type}
                        onChange={handleTypeChange}
                        options={TRANSACTION_TYPES}
                    />
                    <div className="flex gap-2 mt-1">
                        {TRANSACTION_TYPES.map((type) => (
                            <span
                                key={type.value}
                                className={`text-xs px-2 py-0.5 rounded ${formik.values.transaction_type === type.value
                                    ? type.value === 'CREDIT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                    : 'bg-gray-100 text-gray-500'
                                    }`}
                            >
                                {type.value === 'CREDIT' ? 'Receipt' : 'Payment'}
                            </span>
                        ))}
                    </div>
                </div>

                <div className="space-y-2 relative">
                    <Label>Ledger <span className="text-destructive">*</span></Label>
                    <InlineSelect
                        value={formik.values.ledger}
                        onChange={(value) => formik.setFieldValue('ledger', Array.isArray(value) ? value[0] || '' : value || '')}
                        placeholder={currentLedgers.length > 0 ? "Select ledger" : "No ledgers available"}
                        options={currentLedgers}
                        onAddNew={handleAddLedger}
                        addNewLabel="Add New Ledger"
                    />
                    {currentLedgers.length === 0 && (
                        <p className="text-xs text-muted-foreground">No ledgers available</p>
                    )}
                    {formik.touched.ledger && formik.errors.ledger && (
                        <p className="text-xs text-red-500">{String(formik.errors.ledger)}</p>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2 relative">
                    <Label>Project / Cost Center</Label>
                    <InlineSelect
                        value={formik.values.project_id}
                        onChange={(value) => formik.setFieldValue('project_id', Array.isArray(value) ? value[0] || '' : value || '')}
                        placeholder="Select project"
                        options={projectOptions}
                        disabled={isLoadingOptions}
                    />
                </div>

                <div className="space-y-2 relative">
                    <Label>Party <span className="text-destructive">*</span></Label>
                    <InlineSelect
                        value={formik.values.party_id}
                        onChange={(value) => formik.setFieldValue('party_id', Array.isArray(value) ? value[0] || '' : value || '')}
                        placeholder="Select party"
                        options={partyOptions}
                        disabled={isLoadingOptions}
                    />
                    {formik.touched.party_id && formik.errors.party_id && (
                        <p className="text-xs text-red-500">{String(formik.errors.party_id)}</p>
                    )}
                </div>
            </div>
        
        <div className="grid grid-cols-1 gap-3">
            <div className="space-y-2 relative">
                <Label>Particular (Description)</Label>
                <InlineSelect
                    value={formik.values.particular}
                    onChange={(value) => formik.setFieldValue('particular', Array.isArray(value) ? value[0] || '' : value || '')}
                    placeholder="Select or type description"
                    options={particularOptions}
                />
            </div>
        </div>
        
        <div className="grid grid-cols-1 gap-3">
            <div className="space-y-2 relative">
                <Label className={formik.values.transaction_type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}>
                    {formik.values.transaction_type === 'CREDIT' ? 'Receipt Amount (₹)' : 'Payment Amount (₹)'}
                </Label>
                <Input
                    type="number"
                    {...formik.getFieldProps(formik.values.transaction_type === 'CREDIT' ? 'credit_amount' : 'debit_amount')}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                    className={`text-lg font-bold ${formik.values.transaction_type === 'CREDIT'
                        ? 'border-green-300 bg-green-50'
                        : 'border-red-300 bg-red-50'
                        }`}
                />
            </div>
        </div>
            <div className="border-t pt-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-4">
                        <span className={`text-lg font-bold ${formik.values.transaction_type === 'CREDIT' ? 'text-green-600' : 'text-red-600'
                            }`}>
                            {formik.values.transaction_type === 'CREDIT' ? 'Receipt' : 'Payment'}
                        </span>
                        <span className="text-muted-foreground">|</span>
                        <span className="font-medium">
                            {(formik.values.account_id || formik.values.cash_book_id) ?
                                cashBookOptions.find(cb => cb.value === (formik.values.account_id || formik.values.cash_book_id))?.label || 'Cash Account'
                                : 'Cash Account'
                            }
                        </span>
                    </div>
                    <span className={`text-2xl font-bold ${formik.values.transaction_type === 'CREDIT' ? 'text-green-600' : 'text-red-600'
                        }`}>
                        ₹{(parseFloat(
                            formik.values.transaction_type === 'CREDIT'
                                ? formik.values.credit_amount
                                : formik.values.debit_amount
                        ) || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={onCancel}>
                    Cancel
                </Button>
                <Button type="submit" disabled={formik.isSubmitting || isLoadingOptions}>
                    {formik.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {transaction ? 'Update Transaction' : 'Create Transaction'}
                </Button>
            </div>
        </form>
    );
}
