'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import VardhiForm from '@/components/vardhi/VardhiForm';
import { createPublicVardhi, getPublicVardhiData } from '@/app/actions/public-vardhi-full';
import NotFound from '@/app/not-found';

interface PageProps {
    params: Promise<{
        company_slug: string;
    }>;
}

export default function PublicVardhiAddPage({ params }: PageProps) {
    const router = useRouter();
    const [company, setCompany] = useState<any>(null);
    const [zones, setZones] = useState<any[]>([]);
    const [workTypes, setWorkTypes] = useState<any[]>([]);
    const [items, setItems] = useState<any[]>([]);
    const [employees, setEmployees] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchData() {
            const { company_slug } = await params;

            const result = await getPublicVardhiData(company_slug);
            if (!result.success) {
                setLoading(false);
                return;
            }

            setCompany(result.company);
            setZones(result.zones || []);
            setWorkTypes(result.workTypes || []);
            setItems(result.items || []);
            setEmployees(result.employees || []);

            setLoading(false);
        }

        fetchData();
    }, [params]);

    const handleSubmit = async (formData: any) => {
        const existingItemsTotal = (formData.vardhiItems || [])
            .filter((item: any) => item.item_id || item.item_name)
            .reduce((sum: number, item: any) => sum + (parseFloat(item.amount) || 0), 0);

        const additionalItemsTotal = (formData.additionalItems || [])
            .filter((item: any) => item.item_name || item.item_id)
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

        const result = await createPublicVardhi(dataToSend, company.slug);

        if (!result.success || !result.data) {
            throw new Error(result.error || 'Failed to create vardhi');
        }

        router.push(`/${company.slug}/vardhi/success?vardhi_no=${encodeURIComponent(result.data.vardhi_number)}`);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-gray-600">Loading...</div>
            </div>
        );
    }

    if (!company) {
        return (
            <NotFound />
        );
    }

    if (company.status === 'INACTIVE') {
        return (
            <NotFound />
        );
    }

    return (
        <div className="min-h-screen">
            {company.logo && (
                <div className="text-center mb-4">
                    <img
                        src={company.logo}
                        alt={company.company_name}
                        className="h-16 mx-auto"
                    />
                </div>
            )}
            <VardhiForm
                onSubmit={handleSubmit}
                title="New Vardhi"
                description="Create a new vardhi work order"
                submitLabel="Submit Vardhi"
                cancelUrl={`/${company.slug}`}
                workTypes={workTypes}
                zones={zones}
                items={items}
                employees={employees}
                companySlug={company.slug}
                company_slug={true}
            />
        </div>
    );
}
