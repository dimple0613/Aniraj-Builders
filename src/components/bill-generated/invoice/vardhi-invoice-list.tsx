"use client";

import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import axios from "axios";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Column, DataTable } from "@/components/common/DataTable";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Pencil, Trash2, FileText, Download, Loader2, MoreHorizontal, Eye } from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { DropdownMenuSeparator } from "@radix-ui/react-dropdown-menu";

interface VardhiInvoiceData {
    id: string;
    invoice_no: string;
    invoice_date: string;
    dept_name: string | null;
    buyer_name: string;
    company_name: string;
    remarks: string | null;
    quantity: number;
    amount: number;
    estimation?: {
        id: string;
        estimation_no: string;
        contractor: string;
        work_name: string;
    };
    created_at: string;
}

export function VardhiInvoiceListClient() {
    const [data, setData] = useState<VardhiInvoiceData[]>([]);
    const [loading, setLoading] = useState(false);
    const [deleteItem, setDeleteItem] = useState<VardhiInvoiceData | null>(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [pagination, setPagination] = useState({ page: 1, totalPages: 1 });
    const [search, setSearch] = useState("");
    const router = useRouter();

    const fetchData = useCallback(
        async (page = 1, searchVal = search) => {
            try {
                setLoading(true);
                const params = new URLSearchParams({
                    page: page.toString(),
                    limit: "10",
                    ...(searchVal && { search: searchVal }),
                });
                const response = await axios.get(`/api/bill-generated/invoice?${params}`);
                setData(response.data?.data || response.data || []);
                if (response.data?.pagination) {
                    setPagination({
                        page: response.data.pagination.page,
                        totalPages: response.data.pagination.pages,
                    });
                }
            } catch {
                toast.error("Failed to fetch invoices");
            } finally {
                setLoading(false);
            }
        },
        [search]
    );

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const confirmDelete = async () => {
        if (!deleteItem) return;
        try {
            setDeleteLoading(true);
            await axios.delete(`/api/bill-generated/invoice/${deleteItem.id}`);
            toast.success("Invoice deleted successfully");
            fetchData(pagination.page);
            setDeleteItem(null);
        } catch (e: any) {
            toast.error(e.response?.data?.error || "Failed to delete invoice");
        } finally {
            setDeleteLoading(false);
        }
    };

    const handleDownloadPDF = async (invoice: VardhiInvoiceData) => {
        try {
            const response = await axios.get(`/api/bill-generated/invoice/${invoice.id}/download`, {
                responseType: "blob",
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `invoice-${invoice.invoice_no}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            toast.success("PDF downloaded successfully");
        } catch (error) {
            toast.error("Failed to download PDF");
        }
    };

    const handleViewPDF = async (invoice: VardhiInvoiceData) => {
        try {
            const response = await axios.get(`/api/bill-generated/invoice/${invoice.id}/pdf`, {
                responseType: "blob",
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            window.open(url, '_blank');
        } catch (error) {
            toast.error("Failed to view PDF");
        }
    };

    const columns: Column<VardhiInvoiceData>[] = [
        {
            header: "Invoice No",
            accessorKey: "invoice_no",
            cell: (item) => (
                <Badge variant="outline" className="font-mono px-1.5 py-0">
                    {item.invoice_no}
                </Badge>
            ),
        },
        {
            header: "Date",
            accessorKey: "invoice_date",
            cell: (item) => (
                <span className="text-sm">
                    {new Date(item.invoice_date).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </span>
            ),
        },
        {
            header: "Buyer",
            accessorKey: "buyer_name",
            cell: (item) => (
                <span className="max-w-[150px] block truncate font-medium" title={item.buyer_name}>
                    {item.buyer_name}
                </span>
            ),
        },
        {
            header: "Remarks",
            accessorKey: "remarks",
            cell: (item) => (
                <span className="max-w-[200px] block truncate text-muted-foreground text-sm" title={item.remarks || ''}>
                    {item.remarks || '—'}
                </span>
            ),
        },
        {
            header: "Amount",
            accessorKey: "amount",
            cell: (item) => (
                <span className="font-mono font-bold">
                    ₹{Number(item.amount).toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                </span>
            ),
        },
        {
            header: "Actions",
            accessorKey: "actions",
            cell: (item) => (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <MoreHorizontal className="h-4 w-4" />
                        </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent
                        align="end"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <DropdownMenuItem onClick={() => handleViewPDF(item)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View PDF
                        </DropdownMenuItem>

                        <DropdownMenuItem onClick={() => handleDownloadPDF(item)}>
                            <Download className="mr-2 h-4 w-4" />
                            Download PDF
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                            onClick={() => router.push(`/bill-generated/invoice/view/${item.id}`)}
                        >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                        </DropdownMenuItem>

                        <DropdownMenuSeparator />

                        <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteItem(item)}
                        >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            ),
        },
    ];

    const handleAdd = () => {
        router.push(`/bill-generated`);
    };

    return (
        <div className="flex-1 flex flex-col gap-6">
            <div className="flex items-center justify-between gap-2 shrink-0 flex-wrap">
                <div className="flex flex-col gap-1">
                    <h2 className="text-xl md:text-2xl font-semibold tracking-tight">Vardhi Invoices</h2>
                </div>
            </div>
            <DataTable
                data={data}
                columns={columns}
                loading={loading}
                pagination={pagination}
                onPageChange={(page: number) => fetchData(page)}
                onSearch={(val: string) => {
                    setSearch(val);
                    fetchData(1, val);
                }}
                onAdd={handleAdd}
            />

            <Dialog
                open={!!deleteItem}
                onOpenChange={(open) => {
                    if (!open) setDeleteItem(null);
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Delete Invoice</DialogTitle>
                    </DialogHeader>
                    <DialogDescription className="py-4">
                        Are you sure you want to delete invoice{" "}
                        <strong>{deleteItem?.invoice_no}</strong>?{" "}
                        This action cannot be undone.
                    </DialogDescription>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteItem(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={confirmDelete}
                            disabled={deleteLoading}
                        >
                            {deleteLoading ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
