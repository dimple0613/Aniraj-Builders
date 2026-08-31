'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { useFormik } from 'formik';
import * as Yup from 'yup';
import { DataTable, Column } from '@/components/common/DataTable';
import { FormModal } from '@/components/common/FormModal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Share2 } from 'lucide-react';

interface User {
    id: string;
    username?: string | null;
    name: string;
    email: string;
    role: string;
    company_id: string;
    zone_id?: string | null;
    zone?: { id: string; name: string } | null;
    createdAt: string;
    whatsapp_number?: string | null;
    assignments?: { id: string; project_id: string; project: { id: string; project_name: string } }[];
}

interface Zone {
    id: string;
    name: string;
}

interface Project {
    id: string;
    project_name: string;
}

interface PaginationInfo {
    page: number;
    pages: number;
    total: number;
    limit: number;
}

const userValidationSchema = Yup.object({
    username: Yup.string()
        .trim()
        .required('Username is required')
        .min(3, 'Username must be at least 3 characters'),
    name: Yup.string()
        .trim()
        .required('Name is required')
        .min(2, 'Name must be at least 2 characters'),
    email: Yup.string()
        .trim()
        .required('Email is required')
        .email('Invalid email address'),
    role: Yup.string()
        .required('Role is required'),
    zone_id: Yup.string()
        .when('role', {
            is: 'Zone',
            then: (schema) => schema.required('Zone is required for Zone role'),
            otherwise: (schema) => schema.notRequired(),
        }),
    password: Yup.string(),
    projectIds: Yup.array().of(Yup.string()),
    whatsapp_number: Yup.string(),
});

export function UserClient() {
    const [data, setData] = useState<User[]>([]);
    const [zones, setZones] = useState<Zone[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [sortField, setSortField] = useState<string | null>(null);
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
    const [userPasswords, setUserPasswords] = useState<Record<string, string>>(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('userPasswords');
            return stored ? JSON.parse(stored) : {};
        }
        return {};
    });

    const savePassword = (userId: string, password: string) => {
        setUserPasswords(prev => {
            const next = { ...prev, [userId]: password };
            localStorage.setItem('userPasswords', JSON.stringify(next));
            return next;
        });
    };
    const [limit, setLimit] = useState(10);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [deleteItem, setDeleteItem] = useState<User | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [formProgress, setFormProgress] = useState(0);
    const [pagination, setPagination] = useState<PaginationInfo>({
        page: 1,
        pages: 1,
        total: 0,
        limit: 10,
    });

    const fetchZones = useCallback(async () => {
        try {
            const response = await axios.get('/api/zone-masters/list');
            setZones(response.data.data || []);
        } catch (error) {
            toast.error('Failed to fetch zones');
        }
    }, []);

    useEffect(() => {
        fetchZones();
    }, [fetchZones]);

    const formik = useFormik({
        initialValues: {
            username: '',
            name: '',
            email: '',
            role: 'DataEntry',
            zone_id: '',
            password: '',
            projectIds: [] as string[],
            whatsapp_number: '',
        },
        validationSchema: userValidationSchema,
        validateOnChange: true,
        validateOnBlur: true,
        onSubmit: async (values, { resetForm, setSubmitting }) => {
            try {
                const payload = {
                    username: values.username.trim(),
                    name: values.name.trim(),
                    email: values.email.trim(),
                    role: values.role,
                    password: values.password || undefined,
                    projectIds: values.projectIds,
                    zone_id: values.role === 'Zone' ? values.zone_id : null,
                    whatsapp_number: values.whatsapp_number.trim() || null,
                };

                if (editingUser) {
                    await axios.put(`/api/users/${editingUser.id}`, payload);
                    if (values.password) {
                        savePassword(editingUser.id, values.password);
                    }
                    toast.success('User updated successfully');
                } else {
                    const res = await axios.post('/api/users', payload);
                    const newUserId = res.data.data.id;
                    savePassword(newUserId, values.password);
                    toast.success('User created successfully');
                }

                setModalOpen(false);
                setEditingUser(null);
                resetForm();
                fetchData(pagination.page, search, limit, sortField, sortOrder);
            } catch (error: unknown) {
                const err = error as any;
                toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to save user');
            } finally {
                setSubmitting(false);
            }
        },
    });

    useEffect(() => {
        const values = formik.values;
        let filled = 0;
        let total = 0;
        const stringFields = ['username', 'name', 'email', 'role', 'password', 'whatsapp_number'];
        stringFields.forEach(field => {
            total++;
            const val = (values as any)[field];
            if (val && val.toString().trim() !== '') filled++;
        });
        if (values.role === 'Zone') {
            total++;
            if (values.zone_id) filled++;
        }
        const result = total > 0 ? Math.round((filled / total) * 100) : 0;
        setFormProgress(result);
    }, [formik.values]);

    const fetchData = useCallback(async (
        page = 1,
        searchValue = search,
        pageLimit = limit,
        sort = sortField,
        order = sortOrder
    ) => {
        try {
            setLoading(true);
            const response = await axios.get('/api/users', {
                params: {
                    page,
                    limit: pageLimit,
                    search: searchValue,
                    sortField: sort,
                    sortOrder: order,
                },
            });
            setData(response.data.data);
            setPagination(response.data.pagination);
        } catch (error) {
            toast.error('Failed to fetch users');
        } finally {
            setLoading(false);
        }
    }, [search, limit, sortField, sortOrder]);

    useEffect(() => {
        const timer = setTimeout(() => {
            fetchData(1, search, limit, sortField, sortOrder);
        }, 300);
        return () => clearTimeout(timer);
    }, [search, limit, sortField, sortOrder, fetchData]);

    const handleEdit = (user: User) => {
        setEditingUser(user);
        formik.resetForm({
            values: {
                username: user.username || '',
                name: user.name,
                email: user.email,
                role: user.role,
                zone_id: user.zone_id || '',
                password: '',
                projectIds: user.assignments?.map(a => a.project_id) || [],
                whatsapp_number: user.whatsapp_number || '',
            },
        });
        setModalOpen(true);
    };

    const handleDelete = (user: User) => {
        setDeleteItem(user);
    };

    const confirmDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            await axios.delete(`/api/users/${deleteItem.id}`);
            toast.success('User deleted successfully');
            setDeleteItem(null);
            fetchData(pagination.page, search, limit, sortField, sortOrder);
        } catch (error: unknown) {
            const err = error as any;
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to delete user');
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleAdd = () => {
        setEditingUser(null);
        formik.resetForm({
            values: {
                username: '',
                name: '',
                email: '',
                role: 'DataEntry',
                zone_id: '',
                password: '',
                projectIds: [],
                whatsapp_number: '',
            },
        });
        setModalOpen(true);
    };

    const handleShare = (user: User) => {
        const number = user.whatsapp_number?.replace(/[^0-9]/g, '');
        if (!number) {
            toast.error('No WhatsApp number set for this user');
            return;
        }
        const password = userPasswords[user.id];
        if (!password) {
            toast.error('Password not available for sharing. Re-save the user with a password to enable sharing.');
            return;
        }
        const loginLink = `http://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/login`;
        const message = `Login: ${loginLink}\nUsername: ${user.username || user.name}\nEmail: ${user.email}\nPassword: ${password}`;
        const url = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    };

    const columns: Column<User>[] = [
        {
            header: 'Username',
            accessorKey: 'username',
            sortable: true,
            cell: (item) => item.username || '-',
        },
        {
            header: 'Name',
            accessorKey: 'name',
            sortable: true,
        },
        {
            header: 'Email',
            accessorKey: 'email',
            sortable: true,
        },
        {
            header: 'Role',
            accessorKey: 'role',
            sortable: true,
            cell: (item) => (
                <Badge variant={item.role === 'Admin' ? 'default' : 'secondary'}>
                    {item.role == "Zone" ? "Zone Officer" : item.role}
                </Badge>
            ),
        },
        {
            header: 'Zone',
            accessorKey: 'zone_id',
            cell: (item) => item.zone?.name || '-',
        },
    ];

    return (
        <div className="flex flex-col gap-4 md:gap-6  w-full overflow-hidden">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                        Users
                    </h2>
                    <p className="text-muted-foreground text-sm">Manage user accounts and permissions</p>
                </div>
            </div>

            <DataTable
                data={data}
                columns={columns}
                loading={loading}
                pagination={{
                    page: pagination.page,
                    totalPages: pagination.pages,
                    total: pagination.total,
                    limit: pagination.limit,
                }}
                onPageChange={(page) => fetchData(page, search, limit, sortField, sortOrder)}
                onSearch={(value) => setSearch(value)}
                onSortChange={(field, order) => {
                    setSortField(field);
                    setSortOrder(order);
                }}
                onLimitChange={(newLimit) => {
                    setLimit(newLimit);
                    fetchData(1, search, newLimit, sortField, sortOrder);
                }}
                onAdd={handleAdd}
                onEdit={handleEdit}
                onDelete={handleDelete}
                extraActions={(item) => [{
                    label: 'Share',
                    icon: <Share2 className="mr-2 h-4 w-4" />,
                    onClick: () => handleShare(item),
                }]}
                searchPlaceholder="Search users..."
                addLabel="Add User"
            />

            <FormModal
                title={editingUser ? 'Edit User' : 'Create New User'}
                isOpen={modalOpen}
                onClose={() => {
                    setModalOpen(false);
                    setEditingUser(null);
                    formik.resetForm();
                }}
                loading={formik.isSubmitting}
                submitLabel={editingUser ? 'Save Changes' : 'Create User'}
                progress={formProgress}
            >
                <form onSubmit={formik.handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-2 relative">
                        <Label htmlFor="username">Username *</Label>
                        <Input
                            id="username"
                            {...formik.getFieldProps('username')}
                            placeholder="Enter username"
                            onChange={(e) => {
                                formik.handleChange(e);
                                // Check username uniqueness
                                if (e.target.value.trim().length >= 3) {
                                    axios.get('/api/users/check-username', {
                                        params: { username: e.target.value.trim(), userId: editingUser?.id || '' }
                                    }).then(res => {
                                        if (!res.data.available) {
                                            formik.setFieldError('username', 'Username already exists');
                                        }
                                    }).catch(() => { });
                                }
                            }}
                        />
                        {formik.touched.username && formik.errors.username && (
                            <p className="text-sm text-destructive">{formik.errors.username}</p>
                        )}
                    </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-2 relative">
                        <Label htmlFor="name">Full Name *</Label>
                        <Input
                            id="name"
                            {...formik.getFieldProps('name')}
                            placeholder="John Doe"
                        />
                        {formik.touched.name && formik.errors.name && (
                            <p className="text-sm text-destructive">{formik.errors.name}</p>
                        )}
                    </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-2 relative">
                        <Label htmlFor="email">Email Address *</Label>
                        <Input
                            id="email"
                            type="email"
                            {...formik.getFieldProps('email')}
                            placeholder="user@example.com"
                        />
                        {formik.touched.email && formik.errors.email && (
                            <p className="text-sm text-destructive">{formik.errors.email}</p>
                        )}
                    </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                        <div className="space-y-2 relative">
                        <Label htmlFor="role">Security Role *</Label>
                        <Select
                            value={formik.values.role}
                            onValueChange={(value) => {
                                formik.setFieldValue('role', value);
                                if (value !== 'Zone') {
                                    formik.setFieldValue('zone_id', '');
                                    formik.setFieldError('zone_id', undefined);
                                }
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="Admin">Admin (Company Level)</SelectItem>
                                {/* <SelectItem value="Accountant">Accountant</SelectItem>
                                <SelectItem value="DataEntry">Data Entry Operator</SelectItem>
                                <SelectItem value="Supervisor">Supervisor / Site In-Charge</SelectItem> */}
                                <SelectItem value="Zone">Zone Officer</SelectItem>
                            </SelectContent>
                        </Select>
                        {formik.touched.role && formik.errors.role && (
                            <p className="text-sm text-destructive">{formik.errors.role}</p>
                        )}
                    </div>
                    </div>
                    
                    {formik.values.role === 'Zone' && (
                        <div className="grid grid-cols-1 gap-3">
                        <div className="space-y-2 relative">
                            <Label htmlFor="zone_id">Zone *</Label>
                            <Select
                                value={formik.values.zone_id}
                                onValueChange={(value) => formik.setFieldValue('zone_id', value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a zone" />
                                </SelectTrigger>
                                <SelectContent>
                                    {zones.map((zone) => (
                                        <SelectItem key={zone.id} value={zone.id}>
                                            {zone.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {formik.touched.zone_id && formik.errors.zone_id && (
                                <p className="text-sm text-destructive">{formik.errors.zone_id}</p>
                            )}
                        </div>
                        </div>
                    )}
                    <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-2 relative">
                        <Label htmlFor="password">
                            {editingUser ? 'New Password (Optional)' : 'Password'}
                            {!editingUser && <span className="text-destructive"> *</span>}
                        </Label>
                        <Input
                            id="password"
                            type="password"
                            {...formik.getFieldProps('password')}
                            placeholder="••••••••"
                        />
                        {formik.touched.password && formik.errors.password && (
                            <p className="text-sm text-destructive">{formik.errors.password}</p>
                        )}
                        {!editingUser && !formik.values.password && formik.touched.password && (
                            <p className="text-sm text-muted-foreground">Password is required for new users</p>
                        )}
                    </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                    <div className="space-y-2 relative">
                        <Label htmlFor="whatsapp_number">WhatsApp Number</Label>
                        <Input
                            id="whatsapp_number"
                            {...formik.getFieldProps('whatsapp_number')}
                            placeholder="+91XXXXXXXXXX"
                        />
                        {formik.touched.whatsapp_number && formik.errors.whatsapp_number && (
                            <p className="text-sm text-destructive">{formik.errors.whatsapp_number}</p>
                        )}
                    </div>
                    </div>
                    <Button
                        type="submit"
                        disabled={formik.isSubmitting || (!editingUser && !formik.values.password)}
                        className="w-full"
                    >
                        {formik.isSubmitting ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User'}
                    </Button>
                </form>
            </FormModal>

            <Dialog open={!!deleteItem} onOpenChange={(open: boolean) => !open && setDeleteItem(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                    </DialogHeader>
                    <DialogDescription>
                        Are you sure you want to delete <strong>{deleteItem?.name}</strong>?
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
