'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import VardhiForm from '@/components/vardhi/VardhiForm';
import { VardhiFormData } from '@/types/vardhi';
import axios from 'axios';
import { WorkType } from '@prisma/client';

export function AddVardhiClient() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
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
        fetchWorkTypes();
    }, []);

    const handleSubmit = async (formData: VardhiFormData) => {
        try {
            setLoading(true);

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

            const dataToSend = {
                ...formData,
                existing_items_total: existingItemsTotal,
                additional_items_total: additionalItemsTotal,
                employees_total: employeesTotal,
                expenses_total: expensesTotal,
                grand_total: grandTotal,
            };


            const response = await axios.post('/api/vardhi', dataToSend);
            toast.success(`Vardhi Created Successfully – Vardhi No: ${response.data.data.vardhi_number}`);

            router.push('/vardhi');
        } catch (error: unknown) {
            const err = error as { response?: { data?: { error?: string } } };
            throw new Error(err.response?.data?.error || 'Failed to create vardhi');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className=" flex flex-col gap-4 md:gap-6  w-full ">
            <VardhiForm
                onSubmit={handleSubmit}
                loading={loading}
                title="New Vardhi"
                description="Create a new vardhi work order with items"
                submitLabel="Create Vardhi"
                cancelUrl="/vardhi"
                workTypes={workTypes}
                zones={zones}
                employees={employees}
            />
        </div>
    );
}
