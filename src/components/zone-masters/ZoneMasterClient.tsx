'use client';

import { useState, useEffect, useMemo } from 'react';
import { Formik, Form, Field, ErrorMessage, useFormikContext } from 'formik';
import * as Yup from 'yup';
import { toast } from 'sonner';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { DataTable, FormModal, Column } from '../common';
import { Labels } from '../ui/labels';

/* ---------------- Types ---------------- */

interface Officer {
    id?: string;
    officer_name: string;
    contact_no: string;
    status: 'CURRENT' | 'PAST';
}

interface ZoneMaster {
    id: string;
    file_no: number;
    name: string;
    createdAt: string;
    updatedAt: string;
    currentOfficer?: Officer | null;
    officers?: Officer[];
}

interface ZoneMasterFormData {
    name: string;
    officers: Officer[];
}

/* ---------------- Validation ---------------- */

const validationSchema = Yup.object().shape({
    name: Yup.string().required('Name is required'),
    officers: Yup.array().of(
        Yup.object().shape({
            officer_name: Yup.string().required('Officer Name is required'),
            contact_no: Yup.string()
                .required('Contact No is required')
                .matches(/^[0-9]{10}$/, 'Contact No must be exactly 10 digits'),
        })
    ),
});

function ZoneProgressTracker({ onProgress }: { onProgress: (v: number) => void }) {
    const { values } = useFormikContext<{ name: string; officers: Array<{ officer_name: string; contact_no: string }> }>();
    const progress = useMemo(() => {
        let filled = 0;
        let total = 0;

        total++;
        if (values.name && values.name.toString().trim() !== '') {
            filled++;
        }

        total++;
        if (values.officers && values.officers.length > 0 && values.officers.some((o) => o.contact_no && o.contact_no.toString().trim() !== '')) {
            filled++;
        }

        return total > 0 ? Math.round((filled / total) * 100) : 0;
    }, [values.name, values.officers]);

    useEffect(() => {
        onProgress(progress);
    }, [progress, onProgress]);

    return null;
}

/* ---------------- Page ---------------- */

export function ZoneMasterClient() {
    const [data, setData] = useState<ZoneMaster[]>([]);
    const [loading, setLoading] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<ZoneMaster | null>(null);
    const [officerViewOpen, setOfficerViewOpen] = useState(false);
    const [selectedZone, setSelectedZone] = useState<ZoneMaster | null>(null);
    const [officerFilter, setOfficerFilter] = useState<'ALL' | 'CURRENT' | 'PAST'>('ALL');
    const [allOfficers, setAllOfficers] = useState<Officer[]>([]);

    const [search, setSearch] = useState('');
    const [limit, setLimit] = useState(10);
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [deleteItem, setDeleteItem] = useState<ZoneMaster | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    const [pagination, setPagination] = useState({
        page: 1,
        totalPages: 1,
    });

    const fetchData = async (
        page = 1,
        searchValue = search,
        pageLimit = limit,
        sort = sortField,
        order = sortOrder
    ) => {
        try {
            setLoading(true);

            const response = await axios.get('/api/zone-masters', {
                params: {
                    page,
                    limit: pageLimit,
                    search: searchValue,
                    sortField: sort,
                    sortOrder: order,
                },
            });

            setData(response.data.data);

            setPagination({
                page: response.data.pagination.page,
                totalPages: response.data.pagination.pages,
            });
        } catch {
            toast.error('Failed to fetch zone masters');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        fetchData(1);
    }, [search, limit, sortField, sortOrder]);

    const handleStatusChange = (index: number, newStatus: 'CURRENT' | 'PAST', setFieldValue: any, officers: Officer[]) => {
        const updatedOfficers = officers.map((officer, i) => {
            if (newStatus === 'CURRENT') {
                return { ...officer, status: i === index ? 'CURRENT' : 'PAST' };
            } else {
                return { ...officer, status: newStatus };
            }
        });
        setFieldValue('officers', updatedOfficers);
    };

    const handleSubmit = async (
        values: ZoneMasterFormData,
        { resetForm }: any
    ) => {
        try {
            const validOfficers = values.officers.filter(o => o.officer_name && o.contact_no);
            const hasCurrentOfficer = validOfficers.some(o => o.status === 'CURRENT');

            if (!hasCurrentOfficer) {
                toast.error('At least one officer with Current status is required');
                return;
            }

            const payload = {
                name: values.name,
                officers: validOfficers
            };

            if (editingItem) {
                await axios.put(`/api/zone-masters/${editingItem.id}`, payload);
                toast.success('Zone master updated successfully');
            } else {
                await axios.post('/api/zone-masters', payload);
                toast.success('Zone master created successfully');
            }

            setModalOpen(false);
            setEditingItem(null);
            resetForm();
            fetchData(pagination.page);
        } catch (error: any) {
            toast.error(
                error.response?.data?.error || 'Failed to save zone master'
            );
        }
    };

    const handleEdit = async (item: ZoneMaster) => {
        try {
            const response = await axios.get(`/api/zone-masters/${item.id}`);
            const fullData = response.data;

            setEditingItem({
                ...fullData,
                officers: fullData.officers || []
            });
            setModalOpen(true);
        } catch {
            toast.error('Failed to fetch zone details');
        }
    };

    const handleViewOfficers = async (item: ZoneMaster) => {
        try {
            const response = await axios.get(`/api/zone-masters/${item.id}`);
            setSelectedZone(item);
            setAllOfficers(response.data.officers || []);
            setOfficerFilter('ALL');
            setOfficerViewOpen(true);
        } catch {
            toast.error('Failed to fetch officers');
        }
    };

    const handleDelete = (item: ZoneMaster) => {
        setDeleteItem(item);
    };

    const confirmDelete = async () => {
        if (!deleteItem) return;

        try {
            setDeleteLoading(true);

            await axios.delete(`/api/zone-masters/${deleteItem.id}`);

            toast.success('Zone master deleted successfully');

            fetchData(pagination.page);
            setDeleteItem(null);
        } catch (error: any) {
            toast.error(
                error.response?.data?.error || 'Failed to delete zone master'
            );
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingItem(null);
        setProgress(0);
        setModalOpen(true);
    };

    const filteredOfficers = useMemo(() => {
        if (officerFilter === 'ALL') return allOfficers;
        return allOfficers.filter(o => o.status === officerFilter);
    }, [allOfficers, officerFilter]);

    const columns: Column<ZoneMaster>[] = useMemo(() => [
        {
            header: 'File No',
            accessorKey: 'file_no',
            sortable: true,
        },
        {
            header: 'Name',
            accessorKey: 'name',
            sortable: true,
        },
        {
            header: 'Officer Name',
            accessorKey: 'currentOfficer',
            cell: (item: any) => item.currentOfficer?.officer_name || '-',
        },
        {
            header: 'Officer Contact',
            accessorKey: 'currentOfficer',
            cell: (item: any) => item.currentOfficer?.contact_no || '-',
        },
    ], []);

    return (
        <div className=" flex flex-col gap-4 md:gap-6  w-full">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Zone Master
                    </h2>
                </div>
            </div>

            <DataTable
                data={data}
                columns={columns}
                loading={loading}
                pagination={pagination}
                onPageChange={(page: any) => fetchData(page)}
                onSearch={(value: any) => setSearch(value)}
                onLimitChange={(newLimit: any) => {
                    setLimit(newLimit);
                }}
                onSortChange={(field: any, order: any) => {
                    setSortField(field);
                    setSortOrder(order);
                }}
                searchPlaceholder="Search by name..."
                onAdd={handleAdd}
                onEdit={handleEdit}
                onDelete={handleDelete}
                addLabel="Add"
            />
            <FormModal
                title={editingItem ? 'Edit Zone Master' : 'Add Zone Master'}
                isOpen={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setEditingItem(null);
                    setProgress(0);
                }}
                loading={loading}
                progress={progress}
            >
                <Formik
                    initialValues={{
                        name: editingItem?.name || '',
                        officers: editingItem?.officers?.length ? editingItem.officers : [{ officer_name: '', contact_no: '', status: 'CURRENT' as const }],
                    }}
                    validationSchema={validationSchema}
                    onSubmit={handleSubmit}
                    enableReinitialize
                >
                    {({ values, setFieldValue, errors, touched, isSubmitting }) => (
                        <>
                            <ZoneProgressTracker onProgress={setProgress} />
                            <Form className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                                    <div className="space-y-2 relative">
                                        <Label>Name *</Label>
                                        <Field as={Input} name="name" />
                                        <ErrorMessage
                                            name="name"
                                            component="div"
                                            className="text-red-500 text-sm"
                                        />
                                    </div>
                                </div>

                                {/* Excel Sheet Style Officers Table */}
                                <div className="space-y-2 relative">
                                    <div className="flex items-center justify-between">
                                        <Labels className="text-base font-medium">Officers</Labels>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setFieldValue('officers', [
                                                    ...values.officers,
                                                    { officer_name: '', contact_no: '', status: 'PAST' }
                                                ]);
                                            }}
                                            className="text-[#38BDF8] hover:text-[#0EA5E9] hover:bg-[#E0F2FE]"
                                        >
                                            + Add Row
                                        </Button>
                                    </div>

                                    <div className="border rounded-lg overflow-hidden">
                                        <table className="w-full text-sm">
                                            <thead className="bg-gray-100 dark:bg-gray-800">
                                                <tr>
                                                    {/* <th className="px-2 py-2 text-left font-medium border-b w-12">Sr.</th> */}
                                                    <th className="px-2 py-2 text-left font-medium border-b">Officer Name</th>
                                                    <th className="px-2 py-2 text-left font-medium border-b">Contact No</th>
                                                    <th className="px-2 py-2 text-left font-medium border-b w-32">Status</th>
                                                    <th className="px-2 py-2 text-center font-medium border-b w-12"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {values.officers.map((officer, index) => (
                                                    <tr key={index} className="border-b">
                                                        {/* <td className="px-2 py-2 text-center">{index + 1}</td> */}
                                                        <td className="px-2 py-2">
                                                            <Input
                                                                placeholder="Officer Name"
                                                                value={officer.officer_name}
                                                                onChange={(e) => {
                                                                    const newOfficers = [...values.officers];
                                                                    newOfficers[index].officer_name = e.target.value;
                                                                    setFieldValue('officers', newOfficers);
                                                                    setFieldValue(`officers.${index}.officer_name`, e.target.value);
                                                                }}
                                                                onBlur={() => setFieldValue(`officers.${index}.officer_name`, officer.officer_name)}
                                                                className="h-8"
                                                            />
                                                            {errors.officers && Array.isArray(errors.officers) && errors.officers[index] && typeof errors.officers[index] === 'object' && (errors.officers[index] as any).officer_name && touched.officers && Array.isArray(touched.officers) && touched.officers[index] && typeof touched.officers[index] === 'object' && (touched.officers[index] as any).officer_name && (
                                                                <div className="text-red-500 text-xs mt-1">
                                                                    {(errors.officers[index] as any).officer_name}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-2 py-2">
                                                            <Input
                                                                placeholder="Contact No"
                                                                value={officer.contact_no}
                                                                onChange={(e) => {
                                                                    const newOfficers = [...values.officers];
                                                                    newOfficers[index].contact_no = e.target.value;
                                                                    setFieldValue('officers', newOfficers);
                                                                    setFieldValue(`officers.${index}.contact_no`, e.target.value);
                                                                }}
                                                                onBlur={() => setFieldValue(`officers.${index}.contact_no`, officer.contact_no)}
                                                                className="h-8"
                                                            />
                                                            {errors.officers && Array.isArray(errors.officers) && errors.officers[index] && typeof errors.officers[index] === 'object' && (errors.officers[index] as any).contact_no && touched.officers && Array.isArray(touched.officers) && touched.officers[index] && typeof touched.officers[index] === 'object' && (touched.officers[index] as any).contact_no && (
                                                                <div className="text-red-500 text-xs mt-1">
                                                                    {(errors.officers[index] as any).contact_no}
                                                                </div>
                                                            )}
                                                        </td>
                                                        <td className="px-2 py-2">
                                                            <Select
                                                                value={officer.status}
                                                                onValueChange={(value: 'CURRENT' | 'PAST') => {
                                                                    handleStatusChange(index, value, setFieldValue, values.officers);
                                                                }}
                                                            >
                                                                <SelectTrigger className="h-8">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="CURRENT">Current</SelectItem>
                                                                    <SelectItem value="PAST">Past</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </td>
                                                        <td className="px-2 py-2 text-center">
                                                            {values.officers.length > 1 && (
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => {
                                                                        const newOfficers = values.officers.filter((_, i) => i !== index);
                                                                        setFieldValue('officers', newOfficers);
                                                                    }}
                                                                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                                                                >
                                                                    ✕
                                                                </Button>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="text-xs text-gray-500">
                                        * Selecting "Current" will automatically set all other officers to "Past"
                                    </p>
                                </div>

                                <Button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="w-full bg-[#38BDF8] text-white hover:bg-[#0EA5E9]"
                                >
                                    {isSubmitting
                                        ? 'Saving...'
                                        : editingItem
                                            ? 'Update'
                                            : 'Create'}
                                </Button>
                            </Form>
                        </>
                    )}
                </Formik>
            </FormModal>
            <Dialog
                open={!!deleteItem}
                onOpenChange={(open) => {
                    if (!open) setDeleteItem(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                    </DialogHeader>

                    <DialogDescription className="py-4">
                        Are you sure you want to delete{' '}
                        <strong>{deleteItem?.name}</strong>?
                    </DialogDescription>

                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setDeleteItem(null)}
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

            {/* Officer View Dialog - Excel Sheet Style */}
            <Dialog open={officerViewOpen} onOpenChange={(open) => {
                setOfficerViewOpen(open);
                if (!open) setSelectedZone(null);
            }}>
                <DialogContent className="max-w-4xl max-h-[80vh] overflow-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Officers - {selectedZone?.name} (File No: {selectedZone?.file_no})
                        </DialogTitle>
                    </DialogHeader>

                    <div className="flex gap-2 mb-4">
                        <Button
                            variant={officerFilter === 'ALL' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setOfficerFilter('ALL')}
                            className={officerFilter === 'ALL' ? 'bg-[#38BDF8] hover:bg-[#0EA5E9]' : 'text-[#38BDF8] border-[#38BDF8]'}
                        >
                            All
                        </Button>
                        <Button
                            variant={officerFilter === 'CURRENT' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setOfficerFilter('CURRENT')}
                            className={officerFilter === 'CURRENT' ? 'bg-[#38BDF8] hover:bg-[#0EA5E9]' : 'text-[#38BDF8] border-[#38BDF8]'}
                        >
                            Current
                        </Button>
                        <Button
                            variant={officerFilter === 'PAST' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setOfficerFilter('PAST')}
                            className={officerFilter === 'PAST' ? 'bg-[#38BDF8] hover:bg-[#0EA5E9]' : 'text-[#38BDF8] border-[#38BDF8]'}
                        >
                            Past
                        </Button>
                    </div>

                    <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-gray-100 dark:bg-gray-800">
                                <tr>
                                    <th className="px-4 py-2 text-left font-medium border-b">Sr. No</th>
                                    <th className="px-4 py-2 text-left font-medium border-b">Officer Name</th>
                                    <th className="px-4 py-2 text-left font-medium border-b">Contact No</th>
                                    <th className="px-4 py-2 text-left font-medium border-b">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredOfficers.length === 0 ? (
                                    <tr>
                                        <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                                            No officers found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredOfficers.map((officer, index) => (
                                        <tr key={officer.id || index} className="border-b hover:bg-gray-50 dark:hover:bg-gray-900">
                                            <td className="px-4 py-2">{index + 1}</td>
                                            <td className="px-4 py-2">{officer.officer_name}</td>
                                            <td className="px-4 py-2">{officer.contact_no}</td>
                                            <td className="px-4 py-2">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${officer.status === 'CURRENT'
                                                    ? 'bg-green-100 text-green-700'
                                                    : 'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {officer.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </DialogContent>
            </Dialog>
        </div >
    );
}
