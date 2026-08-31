'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { Column, DataTable } from '../common';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { InlineSelect } from '@/components/common/InlineSelect';
import { Loader2 } from 'lucide-react';

interface BelongingsTransfer {
  id: string;
  from_project_id: string;
  to_project_id: string;
  description: string | null;
  transfer_date: string;
  createdAt: string;
  fromProject?: { id: string; name: string };
  toProject?: { id: string; name: string };
}

interface Project {
  id: string;
  name: string;
}

interface TransferFormProps {
  transfer?: BelongingsTransfer | null;
  projects: Project[];
  onSuccess: () => void;
  onCancel: () => void;
}

const validationSchema = Yup.object({
  from_project_id: Yup.string().required('From project is required'),
  to_project_id: Yup.string().required('To project is required'),
  transfer_date: Yup.string().required('Transfer date is required'),
  description: Yup.string().optional(),
});

function TransferForm({ transfer, projects, onSuccess, onCancel }: TransferFormProps) {
  const projectOptions = useMemo(() =>
    projects.map(p => ({ label: p.name, value: p.id })),
    [projects]
  );

  const formik = useFormik({
    initialValues: {
      from_project_id: transfer?.from_project_id || '',
      to_project_id: transfer?.to_project_id || '',
      transfer_date: transfer?.transfer_date ? new Date(transfer.transfer_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      description: transfer?.description || '',
    },
    validationSchema,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        const submitData = {
          from_project_id: values.from_project_id,
          to_project_id: values.to_project_id,
          transfer_date: new Date(values.transfer_date),
          description: values.description || undefined,
        };

        if (transfer) {
          await axios.put(`/api/belongings-transfers/${transfer.id}`, submitData);
          toast.success('Transfer updated successfully');
        } else {
          await axios.post('/api/belongings-transfers', submitData);
          toast.success('Transfer created successfully');
        }
        onSuccess();
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Failed to save transfer');
      } finally {
        setSubmitting(false);
      }
    },
  });

  const filteredToProjects = useMemo(() =>
    projectOptions.filter(p => p.value !== formik.values.from_project_id),
    [projectOptions, formik.values.from_project_id]
  );

  return (
    <form onSubmit={formik.handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>From Project *</Label>
          <InlineSelect
            value={formik.values.from_project_id}
            onChange={(value) => formik.setFieldValue('from_project_id', Array.isArray(value) ? value[0] || '' : value || '')}
            options={projectOptions}
            placeholder="Select source project"
          />
          {formik.touched.from_project_id && formik.errors.from_project_id && (
            <p className="text-xs text-red-500">{formik.errors.from_project_id}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label>To Project *</Label>
          <InlineSelect
            value={formik.values.to_project_id}
            onChange={(value) => formik.setFieldValue('to_project_id', Array.isArray(value) ? value[0] || '' : value || '')}
            options={filteredToProjects}
            placeholder="Select destination project"
          />
          {formik.touched.to_project_id && formik.errors.to_project_id && (
            <p className="text-xs text-red-500">{formik.errors.to_project_id}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="transfer_date">Transfer Date *</Label>
        <Input
          type="date"
          id="transfer_date"
          {...formik.getFieldProps('transfer_date')}
        />
        {formik.touched.transfer_date && formik.errors.transfer_date && (
          <p className="text-xs text-red-500">{formik.errors.transfer_date}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          {...formik.getFieldProps('description')}
          placeholder="Enter description of belongings being transferred"
          rows={3}
        />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={formik.isSubmitting}>
          {formik.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {transfer ? 'Update' : 'Create'}
        </Button>
      </div>
    </form>
  );
}

interface Project {
  id: string;
  name: string;
}

interface FormErrors {
  [key: string]: string | undefined;
}

interface TransferFormProps {
  transfer?: BelongingsTransfer | null;
  projects: Project[];
  onSuccess: () => void;
  onCancel: () => void;
}

// function TransferForm({ transfer, projects, onSuccess, onCancel }: TransferFormProps) {
//   const [isSubmitting, setIsSubmitting] = useState(false);
//   const [errors, setErrors] = useState<FormErrors>({});
//   const [touched, setTouched] = useState<Set<string>>(new Set());
//   const [formData, setFormData] = useState({
//     from_project_id: transfer?.from_project_id || '',
//     to_project_id: transfer?.to_project_id || '',
//     transfer_date: transfer?.transfer_date ? new Date(transfer.transfer_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
//     description: transfer?.description || '',
//   });

//   const projectOptions = useMemo(() =>
//     projects.map(p => ({ label: p.name, value: p.id })),
//     [projects]
//   );

//   const filteredToProjects = useMemo(() =>
//     projectOptions.filter(p => p.value !== formData.from_project_id),
//     [projectOptions, formData.from_project_id]
//   );

//   const validateField = useCallback(async (name: string, value: any) => {
//     try {
//       const schema = belongingsTransferValidationSchema.pick([name as any]);
//       await schema.validateAt(name, { [name]: value });
//       setErrors(prev => ({ ...prev, [name]: undefined }));
//       return true;
//     } catch (err: any) {
//       setErrors(prev => ({ ...prev, [name]: err.message }));
//       return false;
//     }
//   }, []);

//   const handleBlur = (name: string) => {
//     setTouched(prev => new Set(prev).add(name));
//     validateField(name, (formData as any)[name]);
//   };

//   const handleSelectChange = (name: string) => (value: string | string[]) => {
//     const selectedValue = Array.isArray(value) ? value[0] : value;
//     setFormData(prev => ({ ...prev, [name]: selectedValue }));
//     if (touched.has(name) || name === 'from_project_id' || name === 'to_project_id') {
//       validateField(name, selectedValue);
//     }
//   };

//   const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
//     const { name, value } = e.target;
//     setFormData(prev => ({ ...prev, [name]: value }));
//     if (touched.has(name)) {
//       validateField(name, value);
//     }
//   };

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();

//     setTouched(new Set(['from_project_id', 'to_project_id', 'transfer_date']));

//     try {
//       await belongingsTransferValidationSchema.validate(formData, { abortEarly: false });
//     } catch (err: any) {
//       const validationErrors: FormErrors = {};
//       err.inner?.forEach((error: any) => {
//         if (error.path) {
//           validationErrors[error.path] = error.message;
//         }
//       });
//       setErrors(validationErrors);
//       toast.error('Please fix the errors in the form');
//       return;
//     }

//     setIsSubmitting(true);
//     try {
//       const submitData = {
//         from_project_id: formData.from_project_id,
//         to_project_id: formData.to_project_id,
//         transfer_date: new Date(formData.transfer_date),
//         description: formData.description || undefined,
//       };

//       if (transfer) {
//         await axios.put(`/api/belongings-transfers/${transfer.id}`, submitData);
//         toast.success('Transfer updated successfully');
//       } else {
//         await axios.post('/api/belongings-transfers', submitData);
//         toast.success('Transfer created successfully');
//       }
//       onSuccess();
//     } catch (error: any) {
//       toast.error(error.response?.data?.message || 'Failed to save transfer');
//     } finally {
//       setIsSubmitting(false);
//     }
//   };

//   return (
//     <form onSubmit={handleSubmit} className="space-y-4">
//       <div className="grid grid-cols-2 gap-4">
//         <div className="space-y-2">
//           <Label>From Project *</Label>
//           <InlineSelect
//             value={formData.from_project_id}
//             onChange={handleSelectChange('from_project_id')}
//             options={projectOptions}
//             placeholder="Select source project"
//           />
//           {errors.from_project_id && <p className="text-xs text-red-500">{errors.from_project_id}</p>}
//         </div>

//         <div className="space-y-2">
//           <Label>To Project *</Label>
//           <InlineSelect
//             value={formData.to_project_id}
//             onChange={handleSelectChange('to_project_id')}
//             options={filteredToProjects}
//             placeholder="Select destination project"
//           />
//           {errors.to_project_id && <p className="text-xs text-red-500">{errors.to_project_id}</p>}
//         </div>
//       </div>

//       <div className="space-y-2">
//         <Label htmlFor="transfer_date">Transfer Date *</Label>
//         <Input
//           type="date"
//           id="transfer_date"
//           name="transfer_date"
//           value={formData.transfer_date}
//           onChange={handleChange}
//           onBlur={() => handleBlur('transfer_date')}
//           className={errors.transfer_date ? 'border-red-500' : ''}
//         />
//         {errors.transfer_date && <p className="text-xs text-red-500">{errors.transfer_date}</p>}
//       </div>

//       <div className="space-y-2">
//         <Label htmlFor="description">Description</Label>
//         <Textarea
//           id="description"
//           name="description"
//           value={formData.description}
//           onChange={handleChange}
//           placeholder="Enter description of belongings being transferred"
//           rows={3}
//         />
//       </div>

//       <DialogFooter>
//         <Button type="button" variant="outline" onClick={onCancel}>
//           Cancel
//         </Button>
//         <Button type="submit" disabled={isSubmitting}>
//           {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
//           {transfer ? 'Update' : 'Create'}
//         </Button>
//       </DialogFooter>
//     </form>
//   );
// }

export function BelongingsTransferClient() {
  const [data, setData] = useState<BelongingsTransfer[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [limit, setLimit] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState<BelongingsTransfer | null>(null);
  const [deleteTransfer, setDeleteTransfer] = useState<BelongingsTransfer | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
  });

  const fetchData = useCallback(async (
    page = 1,
    searchValue = search,
    sort = sortField,
    order = sortOrder,
    pageLimit = limit
  ) => {
    try {
      setLoading(true);

      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', pageLimit.toString());
      if (searchValue) params.append('search', searchValue);
      if (sort) params.append('sortField', sort);
      if (order) params.append('sortOrder', order);

      const response = await axios.get(`/api/belongings-transfers?${params.toString()}`);
      setData(response.data.data);
      setPagination({
        page: response.data.pagination.page,
        totalPages: response.data.pagination.pages,
        total: response.data.pagination.total,
      });
    } catch {
      toast.error('Failed to fetch belongings transfers');
    } finally {
      setLoading(false);
    }
  }, [search, sortField, sortOrder, limit]);

  const fetchProjects = useCallback(async () => {
    try {
      const response = await axios.get('/api/projects?limit=9999');
      setProjects(response.data.data || []);
    } catch {
      toast.error('Failed to fetch projects');
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    fetchData(1);
  }, [search, sortField, sortOrder, limit]);

  const handleEdit = (transfer: BelongingsTransfer) => {
    setEditingTransfer(transfer);
    setModalOpen(true);
  };

  const handleAdd = () => {
    setEditingTransfer(null);
    setModalOpen(true);
  };

  const handleDelete = (transfer: BelongingsTransfer) => {
    setDeleteTransfer(transfer);
  };

  const confirmDelete = async () => {
    if (!deleteTransfer) return;

    try {
      setDeleteLoading(true);
      await axios.delete(`/api/belongings-transfers/${deleteTransfer.id}`);
      toast.success('Transfer deleted successfully');
      fetchData(pagination.page);
      setDeleteTransfer(null);
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to delete transfer');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleSuccess = () => {
    setModalOpen(false);
    setEditingTransfer(null);
    fetchData(pagination.page);
  };

  const columns = useMemo<Column<BelongingsTransfer>[]>(() => {
    return [
      {
        header: 'Transfer Date',
        accessorKey: 'transfer_date',
        sortable: true,
        cell: (transfer: BelongingsTransfer) => (
          <span className="text-sm">
            {new Date(transfer.transfer_date).toLocaleDateString()}
          </span>
        ),
      },
      {
        header: 'From Project',
        accessorKey: 'fromProject',
        sortable: true,
        cell: (transfer: BelongingsTransfer) => (
          <div className="flex flex-col">
            <span className="font-medium">{transfer.fromProject?.name || '-'}</span>
          </div>
        ),
      },
      {
        header: 'To Project',
        accessorKey: 'toProject',
        sortable: true,
        cell: (transfer: BelongingsTransfer) => (
          <div className="flex flex-col">
            <span className="font-medium">{transfer.toProject?.name || '-'}</span>
          </div>
        ),
      },
      {
        header: 'Description',
        accessorKey: 'description',
        cell: (transfer: BelongingsTransfer) => (
          <span className="text-sm text-muted-foreground">
            {transfer.description || '-'}
          </span>
        ),
      },
    ];
  }, []);

  return (
    <div className="flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
      <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
            Belongings Transfer
          </h2>
        </div>
      </div>

      <DataTable
        data={data}
        columns={columns}
        loading={loading}
        pagination={pagination}
        onPageChange={(page) => fetchData(page)}
        onSearch={(value) => setSearch(value)}
        onSortChange={(field, order) => {
          setSortField(field);
          setSortOrder(order);
        }}
        onLimitChange={(newLimit) => setLimit(newLimit)}
        onAdd={handleAdd}
        onEdit={handleEdit}
        onDelete={handleDelete}
        searchPlaceholder="Search transfers..."
        addLabel="New Transfer"
        emptyMessage="No belongings transfers found."
      />

      <Dialog open={modalOpen} onOpenChange={(open) => !open && setModalOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingTransfer ? 'Edit Transfer' : 'New Transfer'}
            </DialogTitle>
            <DialogDescription>
              {editingTransfer
                ? 'Update the transfer details below.'
                : 'Fill in the details to create a new belongings transfer.'}
            </DialogDescription>
          </DialogHeader>
          <TransferForm
            transfer={editingTransfer}
            projects={projects}
            onSuccess={handleSuccess}
            onCancel={() => setModalOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleteTransfer}
        onOpenChange={(open) => !open && setDeleteTransfer(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>

          <div className="py-4">
            <p>
              Are you sure you want to delete this belongings transfer from{' '}
              <strong>{deleteTransfer?.fromProject?.name}</strong> to{' '}
              <strong>{deleteTransfer?.toProject?.name}</strong>?
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTransfer(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteLoading}
            >
              {deleteLoading ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
