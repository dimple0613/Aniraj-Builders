"use client";

import { Formik, Form } from "formik";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
    vardhiValidationSchema,
    vardhiInitialValues,
} from "@/lib/validations/vardhi";
import { VardhiFormData } from "@/types/vardhi";
import { useEffect, useState, useMemo, useRef } from "react";
import axios from "axios";
import BasicInformation from "./BasicInformation";
import Attachments from "./Attachments";
import Employees from "./Employees";
import Expenses from "./Expenses";
import TotalsSummary from "./TotalsSummary";
import AdditionalItems from "./AdditionalItems";
import ItemsDetails from "./ItemsDetails";

interface VardhiFormProps {
    initialData?: VardhiFormData;
    onSubmit: (data: VardhiFormData) => Promise<void>;
    loading?: boolean;
    title?: string;
    description?: string;
    submitLabel?: string;
    cancelUrl?: string;
    vardhi?: any;
    workTypes: any;
    zones: any;
    items?: any;
    employees?: any;
    companySlug?: string;
    userRole?: string;
    company_slug?: any,
}

interface MasterItem {
    id: string;
    item_name: string;
    unit_id: string;
    unit_name: string;
    ay_id?: string | null;
    ay_no?: string | null;
    group_id?: string | null;
    work_type: boolean;
    group?: { id: string; name: string };
    workTypePrices?: Array<{
        work_type_id: string;
        price: number;
        workType?: { id: string; name: string };
    }>;

}

export default function VardhiForm({
    initialData,
    onSubmit,
    loading = false,
    title = "New Vardhi",
    description = "Create a new vardhi record with items",
    submitLabel = "Create Vardhi",
    cancelUrl = "/vardhi",
    vardhi,
    workTypes,
    zones,
    items,
    employees,
    companySlug,
    userRole,
    company_slug = false
}: VardhiFormProps) {
    const isZoneRole = userRole?.toLowerCase() === "zone";
    const originalItemCount = initialData?.vardhiItems?.length || 0;
    const originalAdditionalItemCount = initialData?.additionalItems?.length || 0;
    const hasChangesRef = useRef(true);

    const handleSubmit = async (values: VardhiFormData, { resetForm }: any) => {
        try {
            if (!hasChangesRef.current) {
                toast.error("No changes detected. Please modify at least one field before updating.");
                return;
            }
            await onSubmit(values);
            if (!initialData) {
                resetForm();
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to save vardhi");
        }
    };

    const [itemSearchOpen, setItemSearchOpen] = useState<number | null>(null);
    const [allMasterItems, setAllMasterItems] = useState<MasterItem[]>([]);
    const [allEmployees, setAllEmployees] = useState<any[]>([]);

    const computedInitialValues = initialData || {
        ...vardhiInitialValues,
        work_type:
            workTypes?.[3]?.id ??
            workTypes?.[2]?.id ??
            workTypes?.[1]?.id ??
            workTypes?.[0]?.id ??
            "",
    };

    useEffect(() => {
        if (items == undefined) {
            const loadInitialData = async () => {
                try {
                    const [itemsRes] = await Promise.all([
                        axios.get("/api/item-management?limit=999999"),
                    ]);

                    setAllMasterItems(
                        itemsRes.data?.data || itemsRes.data || items || [],
                    );
                } catch (error) {
                    console.error("Failed to load initial data:", error);
                    toast.error("Failed to load initial data");
                }
            };

            loadInitialData();
        } else {
            setAllMasterItems(items || []);
        }

        if (employees == undefined || employees.length == 0) {
            const loadEmployees = async () => {
                try {
                    const empRes = await axios.get(
                        "/api/employee-management?limit=999999",
                    );

                    setAllEmployees(empRes.data?.data || []);
                } catch (error) {
                    console.error("Failed to load employees:", error);
                }
            };
            loadEmployees();
        } else {
            setAllEmployees(employees || []);
        }
    }, [items]);

    return (
        <div className="">
            <Formik
                initialValues={computedInitialValues}
                validationSchema={vardhiValidationSchema}
                onSubmit={handleSubmit}
                enableReinitialize
            >
                {({ values, errors, touched, setFieldValue, isSubmitting }) => {
                    const hasChanges = useMemo(() => {
                        if (!initialData) return true;
                        if (values.zone_id !== initialData.zone_id) return true;
                        if (values.date !== initialData.date) return true;
                        if (values.varshi_assign_by !== initialData.varshi_assign_by) return true;
                        if (values.work_type !== initialData.work_type) return true;
                        if (values.vardhi_start_date !== initialData.vardhi_start_date) return true;
                        if (values.vardhi_end_date !== initialData.vardhi_end_date) return true;
                        if (values.location !== initialData.location) return true;
                        const curItems = (values.vardhiItems || []).map((i: any) => ({ id: i.item_id, size: i.size, rate: String(i.rate) }));
                        const initItems = (initialData.vardhiItems || []).map((i: any) => ({ id: i.item_id, size: i.size, rate: String(i.rate) }));
                        if (JSON.stringify(curItems) !== JSON.stringify(initItems)) return true;
                        const curAdd = (values.additionalItems || []).map((i: any) => ({ name: i.item_name, size: i.size, qty: String(i.qty), rate: String(i.rate) }));
                        const initAdd = (initialData.additionalItems || []).map((i: any) => ({ name: i.item_name, size: i.size, qty: String(i.qty), rate: String(i.rate) }));
                        if (JSON.stringify(curAdd) !== JSON.stringify(initAdd)) return true;
                        const curEmp = (values.employeeIds || []).map((i: any) => ({ id: i.employee_id, overtime: i.is_overtime, hours: String(i.overtime_hours) }));
                        const initEmp = (initialData.employeeIds || []).map((i: any) => ({ id: i.employee_id, overtime: i.is_overtime, hours: String(i.overtime_hours) }));
                        if (JSON.stringify(curEmp) !== JSON.stringify(initEmp)) return true;
                        const curExp = (values.expenses || []).map((i: any) => ({ particular: i.particular, amount: String(i.amount) }));
                        const initExp = (initialData.expenses || []).map((i: any) => ({ particular: i.particular, amount: String(i.amount) }));
                        if (JSON.stringify(curExp) !== JSON.stringify(initExp)) return true;
                        for (const field of ['report_pdf', 'site_photography', 'site_clear_photo', 'other_attachment'] as const) {
                            if (((values as any)[field] || []).length !== ((initialData as any)[field] || []).length) return true;
                        }
                        return false;
                    }, [values, initialData]);
                    hasChangesRef.current = hasChanges;
                    const progress = useMemo(() => {
                        let filled = 0;
                        let total = 0;

                        const staticFields = [
                            values.zone_id,
                            values.varshi_assign_by,
                            values.date,
                            values.location,
                            values.vardhi_start_date,
                            values.vardhi_end_date,
                            values.work_type,
                        ];

                        staticFields.forEach(field => {
                            total++;
                            if (field && field.toString().trim() !== '') {
                                filled++;
                            }
                        });

                        total++;
                        if (values.vardhiItems && values.vardhiItems.length > 0 && values.vardhiItems.some((item: any) => item.item_id || item.item_name)) {
                            filled++;
                        }

                        total++;
                        if (values.employeeIds && values.employeeIds.length > 0 && values.employeeIds.some((emp: any) => emp.employee_id)) {
                            filled++;
                        }

                        total++;
                        if (values.expenses && values.expenses.length > 0 && values.expenses.some((exp: any) => exp.particular && exp.amount > 0)) {
                            filled++;
                        }

                        total++;
                        if (values.additionalItems && values.additionalItems.length > 0 && values.additionalItems.some((item: any) => item.item_name || item.item_id)) {
                            filled++;
                        }

                        const attachmentFields = [
                            'site_photography',
                            'site_clear_photo',
                            'other_attachment',
                            'report_pdf',
                        ] as const;

                        attachmentFields.forEach(field => {
                            total++;
                            const val = values[field as keyof typeof values];
                            if (Array.isArray(val) && val.length > 0) {
                                filled++;
                            }
                        });

                        return total > 0 ? Math.round((filled / total) * 100) : 0;
                    }, [values]);

                    return (
                        <>
                            <div className={company_slug ? " -mt-[1.5rem] -ml-[1.5rem] -mr-[1.5rem] " :  " -mt-[1.5rem] -ml-[1.5rem] -mr-[1.5rem] sticky top-[48px]"}>
                                <div className="w-full h-1.5 bg-red-500 rounded-full overflow-hidden mb-4 w-[calc(100%+3rem)]">
                                    <div className="h-full bg-blue-600 transition-all duration-300 " style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                            <Form className="space-y-6">
                                <div className="flex items-end justify-between gap-2 shrink-0 flex-wrap">
                                    <div className="flex flex-col gap-1">
                                        <h2 className="text-xl md:text-2xl font-semibold tracking-tight">
                                            {title}
                                        </h2>
                                        <p className="text-muted-foreground text-sm">{description}</p>
                                    </div>
                                    {vardhi ? (
                                        <div className="flex items-center gap-2">
                                            <div className="flex items-center gap-4">
                                                <div className="bg-primary/10 px-4 py-2 rounded-lg">
                                                    <span className="text-sm text-muted-foreground">
                                                        Vardhi Number:
                                                    </span>
                                                    <span className="ml-2 font-semibold text-sm text-muted-foreground">
                                                        {vardhi.vardhi_number}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    ) : null}
                                </div>
                                <BasicInformation
                                    setFieldValue={setFieldValue}
                                    zones={zones}
                                    touched={touched}
                                    errors={errors}
                                    workTypes={workTypes}
                                    disabled={isZoneRole}
                                />
                                <Attachments
                                    values={values}
                                    setFieldValue={setFieldValue}
                                    vardhi={vardhi}
                                    companySlug={companySlug}
                                    isZoneRole={isZoneRole}
                                />
                                <Employees
                                    values={values}
                                    setFieldValue={setFieldValue}
                                    allEmployees={allEmployees}
                                    createdAtDate={vardhi?.created_at || null}
                                    touched={touched}
                                    errors={errors}
                                    disabled={isZoneRole}
                                />
                                <Expenses
                                    values={values}
                                    touched={touched}
                                    errors={errors}
                                    disabled={isZoneRole}
                                />
                                <ItemsDetails
                                    values={values}
                                    itemSearchOpen={itemSearchOpen}
                                    setItemSearchOpen={setItemSearchOpen}
                                    setFieldValue={setFieldValue}
                                    allMasterItems={allMasterItems}
                                    touched={touched}
                                    errors={errors}
                                    workType={workTypes?.find(
                                        (wt: any) => wt.id === values.work_type,
                                    )}
                                    createdAtDate={vardhi?.created_at || null}
                                    isZoneRole={isZoneRole}
                                    originalItemCount={originalItemCount}
                                />
                                <AdditionalItems
                                    values={values}
                                    itemSearchOpen={itemSearchOpen}
                                    setItemSearchOpen={setItemSearchOpen}
                                    setFieldValue={setFieldValue}
                                    allMasterItems={allMasterItems}
                                    workType={workTypes?.find(
                                        (wt: any) => wt.id === values.work_type,
                                    )}
                                    createdAtDate={vardhi?.created_at || null}
                                    touched={touched}
                                    errors={errors}
                                    isZoneRole={isZoneRole}
                                    originalItemCount={originalAdditionalItemCount}
                                />
                                <TotalsSummary values={values} />
                                <div className="flex justify-end gap-3 pt-2">
                                    <Button type="submit" disabled={isSubmitting || loading || !hasChanges}>
                                        {isSubmitting || loading
                                            ? "Saving..."
                                            : vardhi
                                                ? "Update"
                                                : "Create"}
                                    </Button>
                                </div>
                            </Form>
                        </>
                    );
                }}
            </Formik>
        </div>
    );
}
