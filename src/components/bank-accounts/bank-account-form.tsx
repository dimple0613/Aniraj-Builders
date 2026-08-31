'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useFormik } from 'formik';
import * as Yup from 'yup';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Labels } from '../ui/labels';

interface BankAccount {
  id: string;
  type: string;
  account_name: string | null;
  cash_name: string | null;
  account_number: string | null;
  bank_name: string | null;
  ifsc_code: string | null;
  opening_balance: number;
  is_active: boolean;
}

interface BankAccountFormProps {
  account?: BankAccount | null;
  onSuccess: () => void;
  onCancel: () => void;
  onProgress?: (progress: number) => void;
}

const validationSchema = Yup.object({
  type: Yup.string()
    .required('Account type is required')
    .oneOf(['BANK', 'CASH'], 'Account type must be BANK or CASH'),
  account_name: Yup.string().when('type', {
    is: 'BANK',
    then: (schema) => schema.required('Account name is required').min(1, 'Account name is required').max(200, 'Account name must be less than 200 characters'),
    otherwise: (schema) => schema.nullable(),
  }),
  cash_name: Yup.string().when('type', {
    is: 'CASH',
    then: (schema) => schema.required('Cash name is required').min(1, 'Cash name is required').max(200, 'Cash name must be less than 200 characters'),
    otherwise: (schema) => schema.nullable(),
  }),
  account_number: Yup.string().when('type', {
    is: 'BANK',
    then: (schema) => schema.required('Account number is required').transform((val) => val?.replace(/\s/g, '').replace(/-/g, '')).matches(/^\d{9,18}$/, 'Account number must be 9-18 digits'),
    otherwise: (schema) => schema.nullable(),
  }),
  bank_name: Yup.string().when('type', {
    is: 'BANK',
    then: (schema) => schema.required('Bank name is required').min(1, 'Bank name is required').max(200, 'Bank name must be less than 200 characters'),
    otherwise: (schema) => schema.nullable(),
  }),
  ifsc_code: Yup.string().when('type', {
    is: 'BANK',
    then: (schema) => schema.nullable().optional().transform((val) => val?.toUpperCase()).matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, 'Invalid IFSC code format (e.g., SBIN0001234)'),
    otherwise: (schema) => schema.nullable(),
  }),
  opening_balance: Yup.number()
    .min(0, 'Opening balance must be positive')
    .required('Opening balance is required'),
  is_active: Yup.boolean().default(true),
});

export function BankAccountForm({ account, onSuccess, onCancel, onProgress }: BankAccountFormProps) {
  const formik = useFormik({
    initialValues: {
      type: account?.type || 'BANK',
      account_name: account?.account_name || '',
      cash_name: account?.cash_name || '',
      account_number: account?.account_number || '',
      bank_name: account?.bank_name || '',
      ifsc_code: account?.ifsc_code || '',
      opening_balance: account?.opening_balance?.toString() || '0',
      is_active: account?.is_active ?? true,
    },
    validationSchema,
    validateOnChange: true,
    validateOnBlur: true,
    onSubmit: async (values) => {
      const openingBalance = parseFloat(values.opening_balance) || 0;

      try {
        const submitData = {
          type: values.type,
          account_name: values.type === 'BANK' ? values.account_name : null,
          cash_name: values.type === 'CASH' ? values.cash_name : null,
          account_number: values.type === 'BANK' ? values.account_number : null,
          bank_name: values.type === 'BANK' ? values.bank_name : null,
          ifsc_code: values.type === 'BANK' ? (values.ifsc_code || undefined) : undefined,
          opening_balance: openingBalance,
          is_active: values.is_active,
        };

        if (account) {
          await axios.put(`/api/accounts/${account.id}`, submitData);
          toast.success('Account updated successfully');
        } else {
          await axios.post('/api/accounts', submitData);
          toast.success('Account created successfully');
        }
        onSuccess();
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Failed to save account');
      }
    },
  });

  useEffect(() => {
    const values = formik.values;
    let filled = 0;
    let total = 0;

    const stringFields = [
      'type',
      ...(values.type === 'BANK'
        ? ['account_name', 'account_number', 'bank_name', 'ifsc_code']
        : ['cash_name']
      ),
      'opening_balance',
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

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-4  max-h-[70vh] overflow-y-auto pr-2">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 relative">
          <Label htmlFor="type">Account Type *</Label>
          <Select
            value={formik.values.type}
            onValueChange={(value) => {
              formik.setFieldValue('type', value);
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select account type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BANK">Bank</SelectItem>
              <SelectItem value="CASH">Cash</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {formik.values.type === 'BANK' && (
          <div className="space-y-2 relative">
            <Label htmlFor="account_name">Account Name *</Label>
            <Input
              id="account_name"
              {...formik.getFieldProps('account_name')}
              placeholder="Enter account name"
              className={formik.touched.account_name && formik.errors.account_name ? 'border-red-500' : ''}
            />
            {formik.touched.account_name && formik.errors.account_name && (
              <p className="text-xs text-red-500">{formik.errors.account_name}</p>
            )}
          </div>
        )}

        {formik.values.type === 'CASH' && (
          <div className="space-y-2 relative">
            <Label htmlFor="cash_name">Cash Name *</Label>
            <Input
              id="cash_name"
              {...formik.getFieldProps('cash_name')}
              placeholder="Enter cash name (e.g., Petty Cash)"
              className={formik.touched.cash_name && formik.errors.cash_name ? 'border-red-500' : ''}
            />
            {formik.touched.cash_name && formik.errors.cash_name && (
              <p className="text-xs text-red-500">{formik.errors.cash_name}</p>
            )}
          </div>
        )}
      </div>

      {formik.values.type === 'BANK' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 relative">
            <Label htmlFor="account_number">Account Number *</Label>
            <Input
              id="account_number"
              {...formik.getFieldProps('account_number')}
              placeholder="Enter account number"
              className={formik.touched.account_number && formik.errors.account_number ? 'border-red-500' : ''}
            />
            {formik.touched.account_number && formik.errors.account_number && (
              <p className="text-xs text-red-500">{formik.errors.account_number}</p>
            )}
          </div>

          <div className="space-y-2 relative">
            <Label htmlFor="bank_name">Bank Name *</Label>
            <Input
              id="bank_name"
              {...formik.getFieldProps('bank_name')}
              placeholder="Enter bank name"
              className={formik.touched.bank_name && formik.errors.bank_name ? 'border-red-500' : ''}
            />
            {formik.touched.bank_name && formik.errors.bank_name && (
              <p className="text-xs text-red-500">{formik.errors.bank_name}</p>
            )}
          </div>
        </div>
      )}

      {formik.values.type === 'BANK' && (
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 relative">
            <Label htmlFor="ifsc_code">IFSC Code</Label>
            <Input
              id="ifsc_code"
              {...formik.getFieldProps('ifsc_code')}
              placeholder="Enter IFSC code (e.g., ABCD0123456)"
              className={formik.touched.ifsc_code && formik.errors.ifsc_code ? 'border-red-500' : ''}
            />
            {formik.touched.ifsc_code && formik.errors.ifsc_code && (
              <p className="text-xs text-red-500">{formik.errors.ifsc_code}</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2 relative">
          <Label htmlFor="opening_balance">Opening Balance *</Label>
          <Input
            id="opening_balance"
            type="number"
            {...formik.getFieldProps('opening_balance')}
            placeholder="Enter opening balance"
            className={formik.touched.opening_balance && formik.errors.opening_balance ? 'border-red-500' : ''}
          />
          {formik.touched.opening_balance && formik.errors.opening_balance && (
            <p className="text-xs text-red-500">{formik.errors.opening_balance}</p>
          )}
        </div>

        <div className="flex items-center relative space-x-2 pt-6">
          <Checkbox
            id="is_active"
            checked={formik.values.is_active}
            onCheckedChange={(checked) => formik.setFieldValue('is_active', checked as boolean)}
          />
          <Labels htmlFor="is_active" className="text-sm font-normal">
            Active Account
          </Labels>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={formik.isSubmitting}>
          {formik.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {account ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}