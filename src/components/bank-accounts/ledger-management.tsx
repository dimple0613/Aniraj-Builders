'use client';

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Pencil, Trash2, Plus } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Labels } from '../ui/labels';

interface Ledger {
  id: string;
  name: string;
  code: string;
  include_expenses_activity: boolean;
  show_in_cash_book: boolean;
  show_in_bank_book: boolean;
}

interface LedgerManagementProps {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
}

interface LedgerFormState {
  id?: string;
  name: string;
  include_expenses_activity: boolean;
  show_in_cash_book: boolean;
  show_in_bank_book: boolean;
}

type DeleteState = Ledger | null;

export function LedgerManagement({ open, onClose, onChanged }: LedgerManagementProps) {
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<LedgerFormState>({
    name: '',
    include_expenses_activity: false,
    show_in_cash_book: true,
    show_in_bank_book: true,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleteTarget] = useState<DeleteState>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const fetchLedgers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/ledgers?limit=9999');
      setLedgers(response.data.data || []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to fetch ledgers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchLedgers();
    }
  }, [open, fetchLedgers]);

  const openAdd = () => {
    setForm({
      name: '',
      include_expenses_activity: false,
      show_in_cash_book: true,
      show_in_bank_book: true,
    });
    setFormOpen(true);
  };

  const openEdit = (ledger: Ledger) => {
    setForm({
      id: ledger.id,
      name: ledger.name,
      include_expenses_activity: ledger.include_expenses_activity,
      show_in_cash_book: ledger.show_in_cash_book,
      show_in_bank_book: ledger.show_in_bank_book,
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error('Ledger name is required');
      return;
    }

    try {
      setSaving(true);
      if (form.id) {
        await axios.put(`/api/ledgers/${form.id}`, {
          name: form.name.trim(),
          include_expenses_activity: form.include_expenses_activity,
          show_in_cash_book: form.show_in_cash_book,
          show_in_bank_book: form.show_in_bank_book,
        });
        toast.success('Ledger updated successfully');
      } else {
        await axios.post('/api/ledgers', {
          name: form.name.trim(),
          include_expenses_activity: form.include_expenses_activity,
          show_in_cash_book: form.show_in_cash_book,
          show_in_bank_book: form.show_in_bank_book,
        });
        toast.success('Ledger created successfully');
      }
      setFormOpen(false);
      await fetchLedgers();
      onChanged?.();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to save ledger');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;

    try {
      setDeleteLoading(true);
      const response = await axios.delete(`/api/ledgers/${deleting.id}`);
      if (response.data.success) {
        toast.success('Ledger deleted successfully');
        await fetchLedgers();
        onChanged?.();
        setDeleteTarget(null);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Failed to delete ledger');
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Ledger Management</DialogTitle>
          <DialogDescription>
            {/* Add, edit, delete or configure ledgers for Cash Book and Bank Book. */}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {ledgers.length} ledger{ledgers.length === 1 ? '' : 's'}
          </p>
          <Button variant="outline" size="sm" onClick={openAdd} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Add New Ledger
          </Button>
        </div>

        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr className="text-left text-xs text-slate-600 uppercase tracking-wider">
                <th className="p-2 font-semibold border-b">Name</th>
                <th className="p-2 font-semibold border-b">Code</th>
                <th className="p-2 font-semibold border-b text-center">Include Expenses Activity</th>
                <th className="p-2 font-semibold border-b text-center">Show in Cash Book</th>
                <th className="p-2 font-semibold border-b text-center">Show in Bank Book</th>
                <th className="p-2 font-semibold border-b text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin inline" />
                  </td>
                </tr>
              ) : ledgers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    No ledgers found. Click "Add New Ledger" to create one.
                  </td>
                </tr>
              ) : (
                ledgers.map((ledger) => (
                  <tr key={ledger.id} className="border-b last:border-b-0 hover:bg-slate-50">
                    <td className="p-2 font-medium">{ledger.name}</td>
                    <td className="p-2 text-muted-foreground font-mono text-xs">{ledger.code}</td>
                    <td className="p-2 text-center">
                      {ledger.include_expenses_activity ? (
                        <Badge variant="secondary">Yes</Badge>
                      ) : (
                        <Badge variant="outline">No</Badge>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      {ledger.show_in_cash_book ? (
                        <Badge variant="default">Yes</Badge>
                      ) : (
                        <Badge variant="outline">No</Badge>
                      )}
                    </td>
                    <td className="p-2 text-center">
                      {ledger.show_in_bank_book ? (
                        <Badge variant="default">Yes</Badge>
                      ) : (
                        <Badge variant="outline">No</Badge>
                      )}
                    </td>
                    <td className="p-2">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => openEdit(ledger)}
                          title="Edit ledger"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={() => setDeleteTarget(ledger)}
                          title="Delete ledger"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>

      <Dialog open={formOpen} onOpenChange={(o) => !o && setFormOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{form.id ? 'Edit Ledger' : 'Add New Ledger'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2 relative">
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Labour Expense"
                autoFocus
              />
            </div>

            <div className="space-y-3 border rounded-md p-3">
              <div className="flex items-start gap-2">
                <Checkbox
                  id="include-expenses"
                  checked={form.include_expenses_activity}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, include_expenses_activity: !!checked }))
                  }
                />
                <div className="flex flex-col gap-0.5">
                  <Labels htmlFor="include-expenses">Include Expenses Activity</Labels>
                  <p className="text-xs text-muted-foreground">
                    Transactions with this ledger will appear in the Abstract "Expense Activities" row.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="show-cash"
                  checked={form.show_in_cash_book}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, show_in_cash_book: !!checked }))
                  }
                />
                <div className="flex flex-col gap-0.5">
                  <Labels htmlFor="show-cash">Show in Cash Book</Labels>
                  <p className="text-xs text-muted-foreground">
                    Appears in the Cash Book ledger dropdown.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Checkbox
                  id="show-bank"
                  checked={form.show_in_bank_book}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, show_in_bank_book: !!checked }))
                  }
                />
                <div className="flex flex-col gap-0.5">
                  <Labels htmlFor="show-bank">Show in Bank Book</Labels>
                  <p className="text-xs text-muted-foreground">
                    Appears in the Bank Book ledger dropdown.
                  </p>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {form.id ? 'Update Ledger' : 'Create Ledger'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <DialogDescription className="py-4">
            Are you sure you want to delete the ledger "{deleting?.name}"? Ledgers that are used in any
            transaction cannot be deleted.
          </DialogDescription>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={deleteLoading}>
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}