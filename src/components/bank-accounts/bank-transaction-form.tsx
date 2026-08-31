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
import {
  BANK_TRANSACTION_TYPES,
  LEDGER_TYPE_LABELS,
} from '@/lib/constants';

interface BankTransaction {
  id: string;
  account_id: string;
  transaction_date: string;
  transaction_type: string;
  ledger: string;
  ledger_type?: string;
  project_id?: string | null;
  party_id?: string | null;
  reference_type?: string;
  reference_id?: string;
  against_reference?: string | null;
  narration?: string;
  amount?: number;
  credit_amount: number;
  debit_amount: number;
}

interface PartyInfo {
  id: string;
  name: string;
  account_id?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_name?: string | null;
  bank_ifsc_code?: string | null;
}

interface BankTransactionFormProps {
  transaction?: BankTransaction | null;
  accountId?: string;
  initialData?: Partial<{
    account_id: string;
    ledger: string;
    party_id: string;
    project_id: string;
    narration: string;
    amount: string;
    transaction_type: string;
    against_reference: string;
  }>;
  onSuccess: () => void;
  onCancel: () => void;
  onProgress?: (progress: number) => void;
}

interface LedgerOption {
  label: string;
  value: string;
}

const validationSchema = Yup.object({
  account_id: Yup.string().required('Bank account is required'),
  transaction_date: Yup.string().required('Transaction date is required'),
  transaction_type: Yup.string().required('Transaction type is required').oneOf(['DEBIT', 'CREDIT']),
  ledger: Yup.string().required('Ledger is required').min(1, 'Ledger is required'),
  ledger_type: Yup.string().optional(),
  project_id: Yup.string().nullable().optional(),
  party_id: Yup.string().required('Party is required'),
  narration: Yup.string().nullable().optional(),
  amount: Yup.number().min(0).optional(),
  credit_amount: Yup.number().min(0).default(0),
  debit_amount: Yup.number().min(0).default(0),
});

export function BankTransactionForm({ transaction, accountId, initialData, onSuccess, onCancel, onProgress }: BankTransactionFormProps) {
  const [accountOptions, setAccountOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [partyOptions, setPartyOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [projectOptions, setProjectOptions] = useState<Array<{ label: string; value: string }>>([]);
  const [ledgerOptions, setLedgerOptions] = useState<LedgerOption[]>([]);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);
  const [calculatedNarration, setCalculatedNarration] = useState('');
  const [selectedPartyInfo, setSelectedPartyInfo] = useState<PartyInfo | null>(null);

  const isCredit = transaction?.transaction_type === 'CREDIT';
  const isTransactionCredit = transaction?.transaction_type === 'CREDIT' || initialData?.transaction_type === 'CREDIT';
  const initialType = transaction?.transaction_type || initialData?.transaction_type || 'DEBIT';

  const filteredLedgerOptions = useMemo(() => {
    return ledgerOptions.map((ledger) => ({
      label: ledger.label,
      value: ledger.value,
    }));
  }, [ledgerOptions]);

  const formik = useFormik({
    initialValues: {
      account_id: accountId || transaction?.account_id || initialData?.account_id || '',
      transaction_date: transaction?.transaction_date ? new Date(transaction.transaction_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      transaction_type: initialType,
      ledger: transaction?.ledger || initialData?.ledger || '',
      ledger_type: transaction?.ledger_type || '',
      project_id: transaction?.project_id || initialData?.project_id || '',
      party_id: transaction?.party_id || initialData?.party_id || '',
      narration: transaction?.narration || initialData?.narration || '',
      amount: transaction?.amount?.toString() || initialData?.amount || '',
      credit_amount: transaction?.credit_amount?.toString() || '0',
      debit_amount: transaction?.debit_amount?.toString() || '0',
      against_reference: transaction?.against_reference || initialData?.against_reference || '',
    },
    validationSchema,
    onSubmit: async (values) => {
      try {
        const isCreditTxn = values.transaction_type === 'CREDIT';
        const amount = parseFloat(values.amount) || 0;
        const submitData: any = {
          transaction_date: new Date(values.transaction_date),
          transaction_type: values.transaction_type,
          ledger: values.ledger,
          ledger_type: values.ledger_type || undefined,
          project_id: values.project_id || undefined,
          party_id: values.party_id || undefined,
          narration: values.narration || undefined,
          amount: amount,
          credit_amount: isCreditTxn ? amount : 0,
          debit_amount: !isCreditTxn ? amount : 0,
          account_id: values.account_id || accountId,
          against_reference: values.against_reference || undefined,
        };

        if (transaction) {
          await axios.put(`/api/bank-transactions/${transaction.id}`, submitData);
          toast.success('Transaction updated successfully');
        } else {
          await axios.post('/api/bank-transactions', submitData);
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
        const [accountsRes, partiesRes, projectsRes, ledgersRes] = await Promise.all([
          axios.get('/api/accounts?limit=9999&type=BANK'),
          axios.get('/api/parties?limit=9999'),
          axios.get('/api/projects?limit=9999'),
          axios.get('/api/ledgers?module=bank&limit=9999'),
        ]);

        setAccountOptions((accountsRes.data.data || []).map((a: any) => ({
          label: `${a.account_name} (${a.account_number})`,
          value: a.id
        })));
        setPartyOptions((partiesRes.data.data || []).map((p: any) => ({
          label: p.name,
          value: p.id
        })));
        setProjectOptions((projectsRes.data.data || []).map((p: any) => ({
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

        if (!transaction && accountsRes.data.data?.length === 1 && !formik.values.account_id) {
          formik.setFieldValue('account_id', accountsRes.data.data[0].id);
        }
        if (!transaction && projectsRes.data.data?.length === 1 && !formik.values.project_id) {
          formik.setFieldValue('project_id', projectsRes.data.data[0].id);
        }
      } catch (error) {
        console.error('Failed to fetch options:', error);
      } finally {
        setIsLoadingOptions(false);
      }
    };
    fetchOptions();
  }, []);

  const LEDGER_VALUE_TO_TYPE: Record<string, string> = {
    SALES: 'SALES',
    PURCHASE_RETURN: 'PURCHASE',
    TENDER_EMD: 'GENERAL',
    TENDER_FEE: 'GENERAL',
    BILL_DEDUCTION: 'EXPENSE',
    INCOME: 'INCOME',
    RECEIVABLE: 'RECEIVABLE',
    GENERAL_RECEIPT: 'GENERAL',
    PURCHASE: 'PURCHASE',
    SALES_RETURN: 'SALES',
    TENDER_EMD_REFUND: 'GENERAL',
    TENDER_FEE_PAID: 'GENERAL',
    BILL_DEDUCTION_PAID: 'EXPENSE',
    EXPENSE: 'EXPENSE',
    PAYABLE: 'PAYABLE',
    GENERAL_PAYMENT: 'GENERAL',
  };

  useEffect(() => {
    if (formik.values.ledger) {
      formik.setFieldValue('ledger_type', LEDGER_VALUE_TO_TYPE[formik.values.ledger] || 'GENERAL');
    }
  }, [formik.values.ledger]);

  useEffect(() => {
    const amount = parseFloat(formik.values.amount) || 0;
    const isCredit = formik.values.transaction_type === 'CREDIT';
    if (isCredit) {
      formik.setFieldValue('credit_amount', amount.toString());
    } else {
      formik.setFieldValue('debit_amount', amount.toString());
    }
  }, [formik.values.amount, formik.values.transaction_type]);

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
    const fetchPartyDetails = async () => {
      const partyId = formik.values.party_id;
      if (!partyId) {
        setSelectedPartyInfo(null);
        return;
      }

      try {
        const response = await axios.get(`/api/parties/${partyId}`);
        const party = response.data.data;
        setSelectedPartyInfo(party || null);
      } catch (error) {
        console.error('Failed to fetch party details:', error);
        setSelectedPartyInfo(null);
      }
    };

    fetchPartyDetails();
  }, [formik.values.party_id]);

  useEffect(() => {
    const isCredit = formik.values.transaction_type === 'CREDIT';
    const narrations: Record<string, { RECEIPT: string; PAYMENT: string }> = {
      SALES: { RECEIPT: 'Received against sales invoice', PAYMENT: 'Sales refund' },
      PURCHASE: { RECEIPT: 'Purchase return', PAYMENT: 'Payment against purchase' },
      TENDER_EMD: { RECEIPT: 'EMD Received', PAYMENT: 'EMD Refunded/Forfeited' },
      TENDER_EMD_REFUND: { RECEIPT: 'EMD Received', PAYMENT: 'EMD Refunded/Forfeited' },
      TENDER_FEE: { RECEIPT: 'Tender fee received', PAYMENT: 'Tender fee paid' },
      TENDER_FEE_PAID: { RECEIPT: 'Tender fee received', PAYMENT: 'Tender fee paid' },
      BILL_DEDUCTION: { RECEIPT: 'Bill deduction received', PAYMENT: 'Bill deduction returned' },
      BILL_DEDUCTION_PAID: { RECEIPT: 'Bill deduction received', PAYMENT: 'Bill deduction returned' },
      EXPENSE: { RECEIPT: 'Expense refund', PAYMENT: 'Expense payment' },
      INCOME: { RECEIPT: 'Income received', PAYMENT: 'Income returned' },
      RECEIVABLE: { RECEIPT: 'Receivable received', PAYMENT: 'Receivable adjusted' },
      PAYABLE: { RECEIPT: 'Payable adjusted', PAYMENT: 'Payment made' },
      GENERAL_RECEIPT: { RECEIPT: 'Receipt', PAYMENT: 'Payment' },
      GENERAL_PAYMENT: { RECEIPT: 'Receipt', PAYMENT: 'Payment' },
      PURCHASE_RETURN: { RECEIPT: 'Purchase return received', PAYMENT: 'Purchase return adjusted' },
      SALES_RETURN: { RECEIPT: 'Sales return received', PAYMENT: 'Sales return adjusted' },
    };
    const ledgerValue = formik.values.ledger;
    const baseLedger = ledgerValue?.replace('_REFUND', '').replace('_PAID', '').replace('_RETURN', '') || 'GENERAL';
    const narration = narrations[baseLedger]?.[isCredit ? 'RECEIPT' : 'PAYMENT'] || narrations[ledgerValue]?.[isCredit ? 'RECEIPT' : 'PAYMENT'] || 'Transaction';
    setCalculatedNarration(narration);
  }, [formik.values.transaction_type, formik.values.ledger]);

  useEffect(() => {
    const values = formik.values;
    let filled = 0;
    let total = 0;

    const stringFields = [
      'transaction_date', 'transaction_type', 'ledger', 'account_id',
      'project_id', 'party_id', 'narration', 'amount',
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

  const ledgerColor = useMemo(() => {
    if (!formik.values.ledger_type) return 'text-gray-600';
    switch (formik.values.ledger_type) {
      case 'SALES': return 'text-green-600';
      case 'PURCHASE': return 'text-orange-600';
      case 'EXPENSE': return 'text-red-600';
      case 'INCOME': return 'text-blue-600';
      case 'TENDER_EMD': return 'text-purple-600';
      case 'TENDER_FEE': return 'text-indigo-600';
      case 'BILL_DEDUCTION': return 'text-teal-600';
      default: return 'text-gray-600';
    }
  }, [formik.values.ledger_type]);

  const currentLedgers = useMemo(() => {
    return ledgerOptions.map((ledger) => ({
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
        show_in_cash_book: false,
        show_in_bank_book: true,
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
          <Label>Account <span className="text-destructive">*</span></Label>
          <InlineSelect
            value={formik.values.account_id}
            onChange={(value) => formik.setFieldValue('account_id', Array.isArray(value) ? value[0] || '' : value || '')}
            placeholder="Select account"
            options={accountOptions}
            disabled={isLoadingOptions}
          />
          {formik.touched.account_id && formik.errors.account_id && (
            <p className="text-xs text-red-500">{String(formik.errors.account_id)}</p>
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
            options={BANK_TRANSACTION_TYPES}
          />
          <div className="flex gap-2 mt-1">
            {BANK_TRANSACTION_TYPES.map((type) => (
              <span
                key={type.value}
                className={`text-xs px-2 py-0.5 rounded ${
                  formik.values.transaction_type === type.value
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
            onChange={(value) => {
              const ledgerName = Array.isArray(value) ? value[0] || '' : value || '';
              formik.setFieldValue('ledger', ledgerName);
            }}
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

      {formik.values.ledger_type && (
        <div className="bg-gray-50 rounded-lg p-3 border">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Ledger Type:</span>
            <span className={`text-sm font-medium ${ledgerColor}`}>
              {LEDGER_TYPE_LABELS[formik.values.ledger_type] || formik.values.ledger_type}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">Auto Narration:</span>
            <span className="text-sm text-blue-600">{calculatedNarration}</span>
          </div>
        </div>
      )}

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
          <Label>
            Party <span className="text-destructive">*</span>
            <span className="text-xs text-muted-foreground font-normal ml-2">
              ({formik.values.transaction_type === 'DEBIT' ? 'Who you are paying' : 'Who is paying you'})
            </span>
          </Label>
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
          {selectedPartyInfo && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-md text-xs">
              <p className="font-medium text-blue-700 mb-1">Party Bank Details:</p>
              {selectedPartyInfo.bank_account_name || selectedPartyInfo.bank_account_number ? (
                <div className="space-y-0.5 text-blue-600">
                  <p>{selectedPartyInfo.bank_account_name || '-'}</p>
                  <p>A/C: {selectedPartyInfo.bank_account_number || '-'}</p>
                  <p>{selectedPartyInfo.bank_name || '-'}</p>
                  <p>IFSC: {selectedPartyInfo.bank_ifsc_code || '-'}</p>
                </div>
              ) : (
                <p className="text-blue-500 italic">No bank details linked</p>
              )}
              {selectedPartyInfo?.account_id && (
                <p className="mt-1 text-green-600 font-medium">
                  ✓ Linked to Company Account
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 relative">
          <Label>Against (Invoice / Ref)</Label>
          <Input
            {...formik.getFieldProps('against_reference')}
            placeholder="Enter reference number"
          />
        </div>

        <div className="space-y-2 relative">
          <Label className={formik.values.transaction_type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}>
            Amount (₹) - Auto {formik.values.transaction_type === 'CREDIT' ? 'Credit' : 'Debit'}
          </Label>
          <Input
            type="number"
            {...formik.getFieldProps('amount')}
            placeholder="0.00"
            min="0"
            step="0.01"
            className={formik.values.transaction_type === 'CREDIT' ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-1 gap-3">
      <div className="space-y-2 relative">
        <Label>Narration</Label>
        <Input
          {...formik.getFieldProps('narration')}
          placeholder="Enter narration (optional - will auto-fill based on ledger)"
        />
        {calculatedNarration && !formik.values.narration && (
          <p className="text-xs text-muted-foreground">Auto: {calculatedNarration}</p>
        )}
      </div>
      </div>

      <div className="border-t pt-4">
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Amount</p>
              <p className="text-lg font-bold">
                ₹{parseFloat(formik.values.amount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="text-center border-l pl-6">
              <p className="text-xs text-muted-foreground">
                {formik.values.transaction_type === 'CREDIT' ? 'Credit (Receipt)' : 'Debit (Payment)'}
              </p>
              <p className={`text-lg font-bold ${formik.values.transaction_type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                ₹{parseFloat(formik.values.amount || '0').toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
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
