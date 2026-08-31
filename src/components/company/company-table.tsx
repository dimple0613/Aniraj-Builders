'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { DataTable, Column } from '@/components/common/DataTable';
import { Badge } from '@/components/ui/badge';
import { useRouter } from 'next/navigation';
import { Building2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface Company {
    id: string;
    company_name: string;
    slug: string;
    logo?: string;
    plan: string;
    status: string;
    address?: string;
    gstin_uin?: string;
    state_name?: string;
    contact?: string;
    createdAt: string;
    updatedAt: string;
    _count: {
        users: number;
        projects: number;
    };
}

interface CompanyTableProps {
    canCreate?: boolean;
    canEdit?: boolean;
}

export function CompanyTable({ canCreate = true, canEdit = true }: CompanyTableProps) {
    const router = useRouter();
    const [data, setData] = useState<Company[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [limit, setLimit] = useState(10);
    const [deleteItem, setDeleteItem] = useState<Company | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const [pagination, setPagination] = useState({
        page: 1,
        totalPages: 1,
    });

    const fetchData = async (
        page = 1,
        searchValue = search,
        sort = sortField,
        order = sortOrder,
        pageLimit = limit
    ) => {
        try {
            setLoading(true);

            const response = await axios.get('/api/companies', {
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
        } catch (error) {
            toast.error('Failed to fetch companies');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    useEffect(() => {
        fetchData(1);
    }, [search, sortField, sortOrder, limit]);

    const handleEdit = (item: Company) => {
        if (canEdit) {
            router.push(`/company/${item.id}/edit`);
        }
    };

    const handleDelete = (item: Company) => {
        setDeleteItem(item);
    };

    const confirmDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            await axios.delete(`/api/companies/${deleteItem.id}`);
            toast.success('Company deleted successfully');
            setDeleteItem(null);
            fetchData(pagination.page);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string } } };
            toast.error(
                err.response?.data?.error || 'Failed to delete company'
            );
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleAdd = () => {
        if (canCreate) {
            router.push('/company/add');
        }
    };

    const columns: Column<Company>[] = [
        {
            header: 'Company Name',
            accessorKey: 'company_name',
            cell: (item) => (
                <div className="flex items-center gap-2.5">
                    <div className="shrink-0">
                        {
                            item.logo ? (
                                <img
                                    src={item.logo}
                                    alt={item.company_name}
                                    className="h-9 w-9 rounded-full object-cover"
                                />
                            ) : (
                                <div className="h-9 w-9 rounded-full bg-gray-200 flex items-center justify-center">
                                    <Building2 className="h-4 w-4 text-gray-500" />
                                </div>
                            )
                        }
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="leading-none font-medium text-sm">{item.company_name}</span>
                        <span className="text-xs text-muted-foreground">{item.gstin_uin || 'No GSTIN'}</span>
                    </div>
                </div>
            )
        },
        {
            header: 'Slug',
            accessorKey: 'slug',
            sortable: true,
            cell: (item) => item.slug || '-',
        },
        {
            header: 'Status',
            accessorKey: 'status',
            sortable: true,
            cell: (item) => (
                <Badge variant={item.status === 'ACTIVE' ? 'default' : item.status === 'SUSPENDED' ? 'destructive' : 'secondary'}>
                    {item.status}
                </Badge>
            ),
        },
        {
            header: 'Users',
            accessorKey: '_count.users',
            sortable: false,
            cell: (item) => item._count.users,
        },
    ];

     return (
        <div className="h-full flex-1 flex-col gap-8 md:flex">
            <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                    Company Management
                </h2>
                <p className="text-muted-foreground text-sm">
                    Manage company accounts and configurations.
                </p>
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
                onAdd={canCreate ? handleAdd : undefined}
                onEdit={canEdit ? handleEdit : undefined}
                onDelete={handleDelete}
                addLabel="Add Company"
            />

            {/* Delete Confirmation Dialog */}
            <Dialog open={!!deleteItem} onOpenChange={(open: boolean) => !open && setDeleteItem(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                        Are you sure you want to delete <strong>{deleteItem?.company_name}</strong>?
                        This action cannot be undone.
                    </DialogDescription>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteItem(null)}>Cancel</Button>
                        <Button variant="destructive" onClick={confirmDelete} disabled={deleteLoading}>
                            {deleteLoading ? 'Deleting...' : 'Delete'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
