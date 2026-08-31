'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { formatDateDisplay } from '@/lib/date-utils';

interface Employee {
    id: string;
    name: string;
    employee_code: string;
    department?: { name: string };
}

interface ReimbursementType {
    id: string;
    name: string;
}

interface StatusHistory {
    id: string;
    status: string;
    changed_by?: string;
    changed_at: string;
    remarks?: string;
}

interface ReimbursementRequest {
    id: string;
    employee_id: string;
    reimbursement_type_id: string;
    amount: number;
    description: string | null;
    expense_date: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAID';
    employee?: Employee;
    reimbursement_type?: ReimbursementType;
    status_history?: StatusHistory[];
    createdAt: string;
    updatedAt: string;
}

export function ReimbursementDetailClient({ id, canEdit = true }: { id: string; canEdit?: boolean }) {
    const router = useRouter();
    const [request, setRequest] = useState<ReimbursementRequest | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const fetchRequest = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axios.get(`/api/hr/reimbursement-requests/${id}`);
            setRequest(res.data.data || res.data);
        } catch {
            toast.error('Failed to fetch request details');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchRequest(); }, [fetchRequest]);

    const handleStatusUpdate = async (status: string) => {
        try {
            setActionLoading(true);
            await axios.put(`/api/hr/reimbursement-requests/${id}`, { status });
            toast.success(`Request ${status.toLowerCase()} successfully`);
            fetchRequest();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string; message?: string } } };
            toast.error(err.response?.data?.error || err.response?.data?.message || 'Failed to update status');
        } finally {
            setActionLoading(false);
        }
    };

    const formatCurrency = (val: number) => `₹${Number(val).toLocaleString()}`;

    const statusBadge = (status: string) => {
        const colors: Record<string, string> = {
            PENDING: 'bg-yellow-100 text-yellow-800',
            APPROVED: 'bg-green-100 text-green-800',
            REJECTED: 'bg-red-100 text-red-800',
            PAID: 'bg-blue-100 text-blue-800',
        };
        return <Badge className={colors[status] || ''} variant="outline">{status}</Badge>;
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!request) {
        return <div className="p-6 text-muted-foreground">Request not found.</div>;
    }

    return (
        <div className="h-full flex flex-col gap-4 md:gap-6 w-full overflow-hidden">
            <div className="shrink-0 flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-5 w-5" />
                </Button>
                <div>
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Reimbursement Request</h2>
                    <p className="text-muted-foreground text-sm">Request details</p>
                </div>
                <div className="ml-auto">{statusBadge(request.status)}</div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="md:col-span-2">
                    <CardHeader><CardTitle>Details</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-sm text-muted-foreground">Employee</p>
                                <p className="font-medium">{request.employee?.name || '-'}</p>
                                <p className="text-sm text-muted-foreground">{request.employee?.employee_code}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Type</p>
                                <p className="font-medium">{request.reimbursement_type?.name || '-'}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Amount</p>
                                <p className="text-xl font-bold">{formatCurrency(request.amount)}</p>
                            </div>
                            <div>
                                <p className="text-sm text-muted-foreground">Expense Date</p>
                                <p className="font-medium">{formatDateDisplay(request.expense_date)}</p>
                            </div>
                        </div>
                        {request.description && (
                            <div>
                                <p className="text-sm text-muted-foreground">Description</p>
                                <p>{request.description}</p>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-muted-foreground">Created</p>
                                <p>{formatDateDisplay(request.createdAt, 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                            <div>
                                <p className="text-muted-foreground">Updated</p>
                                <p>{formatDateDisplay(request.updatedAt, 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader><CardTitle>Actions</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        {canEdit && request.status === 'PENDING' && (
                            <>
                                <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleStatusUpdate('APPROVED')} disabled={actionLoading}>
                                    {actionLoading ? 'Processing...' : 'Approve'}
                                </Button>
                                <Button className="w-full bg-red-600 hover:bg-red-700" onClick={() => handleStatusUpdate('REJECTED')} disabled={actionLoading}>
                                    {actionLoading ? 'Processing...' : 'Reject'}
                                </Button>
                            </>
                        )}
                        {canEdit && request.status === 'APPROVED' && (
                            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={() => handleStatusUpdate('PAID')} disabled={actionLoading}>
                                {actionLoading ? 'Processing...' : 'Mark as Paid'}
                            </Button>
                        )}
                        {request.status === 'REJECTED' && (
                            <p className="text-sm text-muted-foreground text-center">This request has been rejected.</p>
                        )}
                        {request.status === 'PAID' && (
                            <p className="text-sm text-muted-foreground text-center">This request has been paid.</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {request.status_history && request.status_history.length > 0 && (
                <Card>
                    <CardHeader><CardTitle>Status History</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {request.status_history.map((h) => (
                                <div key={h.id} className="flex items-center justify-between text-sm border-b pb-2">
                                    <div className="flex items-center gap-2">
                                        {statusBadge(h.status)}
                                        {h.remarks && <span className="text-muted-foreground">- {h.remarks}</span>}
                                    </div>
                                    <span className="text-muted-foreground">{formatDateDisplay(h.changed_at, 'en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
