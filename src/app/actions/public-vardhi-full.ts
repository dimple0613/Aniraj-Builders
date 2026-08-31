'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { VardhiFormData } from '@/types/vardhi';
import { mkdir, rename } from 'fs/promises';
import { join } from 'path';
import { generateVardhiNumber } from '@/lib/vardhi-number';
import { createNotification } from '@/lib/notification-service';

const rateLimitMap = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 5;

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record || now - record.timestamp > RATE_LIMIT_WINDOW) {
        rateLimitMap.set(ip, { count: 1, timestamp: now });
        return true;
    }

    if (record.count >= RATE_LIMIT_MAX) {
        return false;
    }

    record.count++;
    return true;
}

function sanitizeInput(input: string): string {
    return input.replace(/[<>'"]/g, '').trim();
}

export async function createPublicVardhi(
    formData: VardhiFormData,
    companySlug: string
) {
    try {

        const company = await prisma.company.findUnique({
            where: { slug: companySlug },
            select: { id: true, company_name: true, status: true },
        });

        if (!company) {
            return { success: false, error: 'Company not found' };
        }

        if (company.status !== 'ACTIVE') {
            return { success: false, error: 'Company is not active' };
        }

        const {
            zone_id,
            varshi_assign_by,
            date,
            location,
            vardhi_start_date,
            vardhi_end_date,
            work_type,
            vardhiItems,
            employeeIds,
            expenses,
            additionalItems,
            existing_items_total,
            additional_items_total,
            employees_total,
            expenses_total,
            grand_total,
            report_pdf,
            site_photography,
            site_clear_photo,
            other_attachment
        } = formData;

        const total_labor = String(formData.total_labor || '0');
        const vardhi_expense = String(grand_total || existing_items_total || formData.vardhi_expense || '0');

        if (
            !zone_id ||
            !varshi_assign_by ||
            !date ||
            !location ||
            !vardhi_start_date ||
            !vardhi_end_date ||
            !work_type
        ) { 
            return { success: false, error: 'All required fields must be provided' };
        }

        if (new Date(vardhi_end_date) < new Date(vardhi_start_date)) {
            return { success: false, error: 'End date must be after start date' };
        }

        const validItems =
            vardhiItems?.filter((item: any) => item && item.item_id) || [];

        if (validItems.length === 0 && (!additionalItems || additionalItems.length === 0)) {
            return { success: false, error: 'At least one item is required' };
        }

        const vardhi = await prisma.$transaction(async (tx) => {

            const { vardhiNumber, globalSequence } = await generateVardhiNumber(
                company.id,
                zone_id,
                new Date(date),
                tx
            );

            const parseDecimal = (val: any) => val ? parseFloat(String(val)) : 0;

            const created = await tx.vardhi.create({
                data: {
                    company_id: company.id,
                    zone_id,
                    vardhi_number: vardhiNumber,
                    global_sequence: globalSequence,
                    varshi_assign_by,
                    date: new Date(date),
                    location,
                    vardhi_start_date: new Date(vardhi_start_date),
                    vardhi_end_date: new Date(vardhi_end_date),
                    work_type,
                    existing_items_total: parseDecimal(existing_items_total),
                    additional_items_total: parseDecimal(additional_items_total),
                    employees_total: parseDecimal(employees_total),
                    expenses_total: parseDecimal(expenses_total),
                    grand_total: parseDecimal(grand_total),
                }
            });

            if (validItems.length > 0) {
                await tx.vardhiItem.createMany({
                    data: validItems.map((item) => ({
                        company_id: company.id,
                        vardhi_id: created.id,
                        item_id: item.item_id,
                        size: item.size || '',
                        qty: parseFloat(item.qty) || 0,
                        rate: parseFloat(item.rate) || 0,
                        amount: parseFloat(item.amount) || 0,
                    }))
                });
            }

            if (employeeIds && employeeIds.length > 0) {
                const validEmployees = employeeIds.filter((e: any) => e.employee_id);
                if (validEmployees.length > 0) {
                    await tx.vardhiEmployee.createMany({
                        data: validEmployees.map((emp: any) => ({
                            company_id: company.id,
                            vardhi_id: created.id,
                            employee_id: emp.employee_id,
                            is_overtime: emp.is_overtime || false,
                            overtime_hours: parseFloat(emp.overtime_hours) || 0,
                            rate: parseFloat(emp.salary) || 0,
                        }))
                    });
                }
            }

            if (expenses && expenses.length > 0) {
                const validExpenses = expenses.filter((e: any) => e.particular && e.amount > 0);
                if (validExpenses.length > 0) {
                    await tx.vardhiExpense.createMany({
                        data: validExpenses.map((exp: any) => ({
                            company_id: company.id,
                            vardhi_id: created.id,
                            particular: exp.particular,
                            amount: parseFloat(exp.amount) || 0,
                        }))
                    });
                }
            }

            if (additionalItems && additionalItems.length > 0) {
                const validAdditionalItems = additionalItems.filter((item: any) => item.item_name || item.item_id);
                if (validAdditionalItems.length > 0) {
                    await tx.vardhiAdditionalItem.createMany({
                        data: validAdditionalItems.map((item: any) => ({
                            company_id: company.id,
                            vardhi_id: created.id,
                            item_id: item.item_id || null,
                            item_name: item.item_name || item.custom_name || '',
                            size: item.size || '',
                            qty: parseFloat(item.qty) || 0,
                            rate: parseFloat(item.rate) || 0,
                            amount: parseFloat(item.amount) || 0,
                            total: parseFloat(item.total) || 0,
                        }))
                    });
                }
            }

            const attachmentFields = [
                { key: "report_pdf", data: report_pdf },
                { key: "site_photography", data: site_photography },
                { key: "site_clear_photo", data: site_clear_photo },
                { key: "other_attachment", data: other_attachment }
            ];

            for (const { key, data } of attachmentFields) {

                if (!data || !Array.isArray(data)) continue;

                for (const fileData of data) {

                    if (!fileData.file_path) continue;

                    let finalFilePath = fileData.file_path;

                    if (fileData.file_path.includes("/temp/")) {

                        const oldPath = join(
                            process.cwd(),
                            "public",
                            fileData.file_path
                        );

                        const filename =
                            fileData.file_path.split("/").pop() ||
                            `${key}_${Date.now()}`;

                        const newDir = join(
                            process.cwd(),
                            "public",
                            "uploads",
                            "vardhi",
                            company.id,
                            created.id
                        );

                        const newPath = join(newDir, filename);

                        try {

                            await mkdir(newDir, { recursive: true });

                            await rename(oldPath, newPath);

                            finalFilePath =
                                `/uploads/vardhi/${company.id}/${created.id}/${filename}`;

                        } catch (err) {
                            console.error("Error moving file:", err);
                        }
                    }

                    await tx.vardhiAttachment.create({
                        data: {
                            vardhi_id: created.id,
                            company_id: company.id,
                            type: key,
                            file_path: finalFilePath,
                            file_name: fileData.file_name || "",
                            file_size: fileData.file_size || null,
                            mime_type: fileData.mime_type || null,
                        }
                    });

                }
            }

            return created;
        });

        await createNotification({
            action: 'Created',
            entity: 'Vardhi',
            entityId: vardhi.id,
            entityName: vardhi.vardhi_number,
            userName: 'Unknown User',
        });

        revalidatePath(`/${companySlug}/vardhi/add`);

        return {
            success: true,
            message: "Vardhi created successfully",
            data: vardhi
        };

    } catch (error: any) {

        console.error('Public Vardhi submission error:', error);

        return {
            success: false,
            error: error.message || 'Unexpected error occurred',
        };
    }
}
export async function getPublicVardhiData(company_slug: string) {

    if (!company_slug) {
        return { success: false, error: "Invalid company slug" };
    }

    const company = await prisma.company.findUnique({
        where: { slug: company_slug },
        select: {
            id: true,
            company_name: true,
            slug: true,
            logo: true,
            plan: true,
            status: true,
            address: true,
            gstin_uin: true,
            state_name: true,
            state_code: true,
            contact: true,
            hsn_sac: true,
            createdAt: true,
            updatedAt: true,
        }
    });

    if (!company) {
        return { success: false, error: "Company not found" };
    }

    if (company.status !== "ACTIVE") {
        return { success: false, error: "Company inactive" };
    }
    const where: any = {};
    where.deletedAt = null;
    const [zones, workTypes, items, employees] = await Promise.all([
        prisma.zoneMaster.findMany({
            select: { id: true, name: true, file_no: true },
            orderBy: { name: "asc" },
        }),
        prisma.workType.findMany({
            where,
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        }),
        prisma.itemManagement.findMany({
            select: {
                id: true,
                item_name: true,
                unit_id: true,
                ay_id: true,
                group_id: true,
                work_type: true,
                unit: { select: { id: true, unit_name: true } },
                ay: { select: { id: true, ay_no: true } },
                // group: { select: { id: true, name: true } },
                searchPreferences: {
                    select: { id: true, value: true },
                },
                workTypePrices: {
                    select: {
                        id: true,
                        price: true,
                        start_date: true,
                        expiry_date: true,
                        workType: { select: { id: true } },
                    },
                    orderBy: { start_date: 'desc' },
                },
            },
            orderBy: { item_name: "asc" },
        }),
        prisma.employee.findMany({
            select: {
                id: true,
                name: true,
                prices: {
                    select: {
                        id: true,
                        price: true,
                        start_date: true,
                        expiry_date: true,
                    },
                    orderBy: { start_date: 'desc' },
                },
            },
            orderBy: { name: "asc" },
        }),
    ]);

    const formattedEmployees = employees.map((emp: any) => {
        const salaryHistory = emp.prices || [];
        const current = salaryHistory.find((p: any) => p.expiry_date === null);
        return { ...emp, currentSalary: current?.price?.toString() || '0' };
    });

    const formattedItems = items.map((item: any) => {
        const now = new Date();
        const prices = item.workTypePrices || [];
        const active = prices.find((p: any) => {
            const start = new Date(p.start_date).getTime();
            const end = p.expiry_date ? new Date(p.expiry_date).getTime() : Infinity;
            return start <= now.getTime() && now.getTime() <= end;
        });
        return { ...item, currentRate: active?.price?.toString() || '0' };
    });

    return {
        success: true,
        company,
        zones,
        workTypes,
        items: formattedItems,
        employees: formattedEmployees,
    };
}