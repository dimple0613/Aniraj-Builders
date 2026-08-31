'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import VardhiForm from '@/components/vardhi/VardhiForm';
import { Vardhi, VardhiFormData } from '@/types/vardhi';
import axios from 'axios';
import { Loader2 } from 'lucide-react';
import { useParams } from "next/navigation";
import { WorkType } from '@prisma/client';

interface EditVardhiClientProps {
    userRole?: string;
}

export function EditVardhiClient({ userRole }: EditVardhiClientProps) {
    const params = useParams();
    const router = useRouter();
    const [vardhi, setVardhi] = useState<Vardhi | null>(null);
    const [loading, setLoading] = useState(true);
    const [submitLoading, setSubmitLoading] = useState(false);
    const [workTypes, setWorkTypes] = useState<WorkType[]>([]);
    const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);

    const fetchWorkTypes = useCallback(async () => {
        try {
            const work_response = await axios.get('/api/work-type?limit=9999');
            const zone_response = await axios.get('/api/zone-masters?limit=9999');
            const emp_response = await axios.get('/api/employee-management?limit=9999');
            setWorkTypes(work_response.data.data || []);
            setZones(zone_response.data.data || []);
            setEmployees(emp_response.data.data || []);
        } catch {
            console.error('Failed to fetch work types');
        }
    }, []);

    useEffect(() => {
        fetchVardhi();
        fetchWorkTypes();
    }, [params.id]);

    const fetchVardhi = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`/api/vardhi/${params.id}`);
            setVardhi(response.data.data);
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string } } };
            toast.error(err.response?.data?.error || 'Failed to fetch vardhi');
            router.push('/vardhi');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (formData: VardhiFormData) => {
        try {
            setSubmitLoading(true);

            const existingItemsTotal = (formData.vardhiItems || [])
                .filter((item: any) => item.item_id || item.item_name)
                .reduce((sum: number, item: any) => sum + (parseFloat(item.amount) || 0), 0);

            const additionalItemsTotal = (formData.additionalItems || [])
                .filter((item: any) => item.item_id || item.item_name)
                .reduce((sum: number, item: any) => sum + (parseFloat(item.total) || 0), 0);

            const employeesTotal = (formData.employeeIds || [])
                .filter((emp: any) => emp.employee_id)
                .reduce((sum: number, emp: any) => {
                    const baseSalary = parseFloat(emp.salary) || 0;
                    const overtimeHours = parseFloat(emp.overtime_hours) || 0;
                    const overtimeSalary = (emp.is_overtime && overtimeHours > 0) ? (baseSalary / 8) * overtimeHours : 0;
                    return sum + baseSalary + overtimeSalary;
                }, 0);

            const expensesTotal = (formData.expenses || [])
                .filter((exp: any) => exp.particular && exp.amount > 0)
                .reduce((sum: number, exp: any) => sum + (parseFloat(exp.amount) || 0), 0);

            const grandTotal = existingItemsTotal + additionalItemsTotal;

            const submitData = {
                ...formData,
                vardhiEmployees: formData.employeeIds,
                vardhiExpenses: formData.expenses,
                vardhiAdditionalItems: formData.additionalItems,
                existing_items_total: existingItemsTotal,
                additional_items_total: additionalItemsTotal,
                employees_total: employeesTotal,
                expenses_total: expensesTotal,
                grand_total: grandTotal,
                initial_attachment_counts: {
                    report_pdf: (vardhi!.groupedAttachments?.report_pdf || []).length,
                    site_photography: (vardhi!.groupedAttachments?.site_photography || []).length,
                    site_clear_photo: (vardhi!.groupedAttachments?.site_clear_photo || []).length,
                    other_attachment: (vardhi!.groupedAttachments?.other_attachment || []).length,
                },
            };

            await axios.put(`/api/vardhi/${params.id}`, submitData);
            toast.success('Vardhi updated successfully');

            router.push('/vardhi');
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string } } };
            throw new Error(err.response?.data?.error || 'Failed to update vardhi');
        } finally {
            setSubmitLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto p-6 space-y-6">
                <div className="flex items-center justify-center min-h-64">
                    <div className="flex items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span>Loading vardhi details...</span>
                    </div>
                </div>
            </div>
        );
    }

    if (!vardhi) {
        return (
            <div className="max-w-4xl mx-auto p-6 space-y-6">
                <div className="text-center text-muted-foreground">
                    Vardhi not found
                </div>
            </div>
        );
    }


    const initialData = {
        zone_id: vardhi.zone_id,
        zone_name: vardhi.zone?.name,
        varshi_assign_by: vardhi.varshi_assign_by,
        date: new Date(vardhi.date).toISOString().split('T')[0],
        location: vardhi.location,
        vardhi_start_date: new Date(vardhi.vardhi_start_date).toISOString().split('T')[0],
        vardhi_end_date: new Date(vardhi.vardhi_end_date).toISOString().split('T')[0],
        work_type: vardhi.work_type,
        report_pdf: vardhi.groupedAttachments?.report_pdf || [],
        site_photography: vardhi.groupedAttachments?.site_photography || [],
        site_clear_photo: vardhi.groupedAttachments?.site_clear_photo || [],
        other_attachment: vardhi.groupedAttachments?.other_attachment || [],
        vardhiItems: (vardhi as any).vardhiItems?.map((item: any) => ({
            item_id: item.item_id,
            size: item.size,
            item_name: item.item?.item_name,
            unit_id: item.item?.unit_id || '',
            unit_name: item.item?.unit?.unit_name || '',
            ay_id: item.item?.ay_id || '',
            ay_no: item.item?.ay?.ay_no || '',
            qty: item.qty?.toString() || '0',
            rate: item.rate?.toString() || '0',
            amount: item.amount?.toString() || '0',
        })) || [],
        vardhiItems_data: (vardhi as any).vardhiItems?.map((item: any) => ({
            item_id: item.item_id,
            item_name: item.item?.item_name,
            size: item.size,
        })) || [],
        employeeIds: (vardhi as any).vardhiEmployees?.map((emp: any) => ({
            employee_id: emp.employee_id,
            employee_name: emp.employee?.name,
            salary: parseFloat(emp.rate?.toString() || '0'),
            is_overtime: emp.is_overtime,
            overtime_hours: emp.overtime_hours?.toString() || '',
        })) || [],
        expenses: (vardhi as any).vardhiExpenses?.map((exp: any) => ({
            particular: exp.particular,
            amount: exp.amount?.toString() || '0',
        })) || [],
        additionalItems: (vardhi as any).vardhiAdditionalItems?.map((item: any) => ({
            item_id: item.item_id || '',
            item_name: item.item_name,
            unit_id: item.unit_id || item.item?.unit_id || '',
            unit_name: item.unit_name || item.item?.unit?.unit_name || '',
            ay_id: item.item?.ay_id || '',
            ay_no: item.item?.ay?.ay_no || '',
            size: item.size || '',
            qty: item.qty?.toString() || "0",
            rate: item.rate?.toString() || "0",
            total: item.total?.toString() || "0",
        })) || [],
        existing_items_total: (vardhi as any).existing_items_total?.toString() || '0',
        additional_items_total: (vardhi as any).additional_items_total?.toString() || '0',
        grand_total: (vardhi as any).grand_total?.toString() || '0',
        employees_total: (vardhi as any).employees_total?.toString() || '0',
        expenses_total: (vardhi as any).expenses_total?.toString() || '0',
    };

    return (
        <div className="h-full flex-1 flex-col gap-8 md:flex">
            <VardhiForm
                initialData={initialData}
                onSubmit={handleSubmit}
                loading={submitLoading}
                title="Edit Vardhi"
                description="Update vardhi work order details and items"
                submitLabel="Update Vardhi"
                cancelUrl="/vardhi"
                vardhi={vardhi}
                workTypes={workTypes}
                zones={zones}
                employees={employees}
                userRole={userRole}
            />
        </div>
    );
}
