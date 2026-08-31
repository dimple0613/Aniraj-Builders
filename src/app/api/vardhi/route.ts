import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { rename, mkdir } from 'fs/promises';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { Prisma } from '@prisma/client';
import { join } from 'path';
import { generateVardhiNumber, parseVardhiNumber } from '@/lib/vardhi-number';
import { createNotification } from '@/lib/notification-service';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const isSuperAdmin = session?.user?.role === "SuperAdmin";

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search') || '';
        const sortBy = searchParams.get('sortField') || 'created_at';
        const sortOrder = searchParams.get('sortOrder') || 'desc';

        let zoneIds = searchParams.getAll('zone_id');
        if (zoneIds.length === 0) {
            zoneIds = searchParams.getAll('zone_id[]');
        }

        let itemIds = searchParams.getAll('item_id');
        if (itemIds.length === 0) {
            itemIds = searchParams.getAll('item_id[]');
        }

        const dateFrom = searchParams.get('date_from');
        const dateTo = searchParams.get('date_to');
        const startDateFrom = searchParams.get('start_date_from');
        const startDateTo = searchParams.get('start_date_to');
        const endDateFrom = searchParams.get('end_date_from');
        const endDateTo = searchParams.get('end_date_to');
        const monthParam = searchParams.get('month');
        const yearParam = searchParams.get('year');
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const where: any = {};

        // Hide vardhis currently in Bill Tracking; they reappear when moved back to summary
        where.is_in_billing = false;

        const now = new Date();
        const currentYear = yearParam ? Number(yearParam) : now.getFullYear();
        const currentMonthIndex = monthParam ? months.indexOf(monthParam) : now.getMonth();

        if (monthParam) {
            const monthIndex = months.indexOf(monthParam);
            if (monthIndex !== -1) {
                where.date = {
                    gte: new Date(currentYear, monthIndex, 1),
                    lt: new Date(currentYear, monthIndex + 1, 1),
                };
            }
        }

        if (yearParam) {
            where.date = {
                gte: new Date(currentYear, currentMonthIndex, 1),
                lt: new Date(currentYear, currentMonthIndex + 1, 1),
            };
        }

        if (search) {
            where.OR = [
                { vardhi_number: { contains: search, mode: 'insensitive' } },
                { location: { contains: search, mode: 'insensitive' } },
                { varshi_assign_by: { contains: search, mode: 'insensitive' } },
                { zone: { name: { contains: search, mode: 'insensitive' } } }
            ];
        }

        if (zoneIds.length > 0) {
            where.zone_id = { in: zoneIds };
        }

        if (itemIds.length > 0) {
            where.vardhiItems = {
                some: {
                    item_id: { in: itemIds }
                }
            };
        }

        if (dateFrom || dateTo) {
            where.date = {};
            if (dateFrom) where.date.gte = new Date(dateFrom);
            if (dateTo) where.date.lte = new Date(dateTo);
        }

        if (startDateFrom || startDateTo) {
            where.vardhi_start_date = {};
            if (startDateFrom) where.vardhi_start_date.gte = new Date(startDateFrom);
            if (startDateTo) where.vardhi_start_date.lte = new Date(startDateTo);
        }

        if (endDateFrom || endDateTo) {
            where.vardhi_end_date = {};
            if (endDateFrom) where.vardhi_end_date.gte = new Date(endDateFrom);
            if (endDateTo) where.vardhi_end_date.lte = new Date(endDateTo);
        }

        const [data, total] = await withCompany(async (company) => {
            where.company_id = company?.company_id;

            // Zone-based access control: filter by user's zone_id if set
            if (company?.zone_id) {
                where.zone_id = company.zone_id;
            }

            const include: any = {
                zone: {
                    select: {
                        id: true,
                        name: true,
                        file_no: true,
                    },
                },
                vardhiItems: {
                    include: {
                        item: {
                            select: {
                                id: true,
                                item_name: true,
                            },
                        },
                    },
                },
                additionalItems: true,
            };

            if (isSuperAdmin) {
                include.employees = {
                    include: {
                        employee: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                };
                include.expenses = true;
            }

            return Promise.all([
                prisma.vardhi.findMany({
                    where,
                    include,
                    orderBy: {
                        [sortBy]: sortOrder,
                    },
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                prisma.vardhi.count({ where }),
            ]);
        });

        const sanitizedData = isSuperAdmin
            ? data
            : data.map((item: any) => {
                const { employees_total, expenses_total, employees, expenses, ...rest } = item;
                return rest;
            });

        // Build year-wise zone sequence map from ALL matching vardhis (not just current page)
        const allVardhis = await prisma.vardhi.findMany({
            where,
            select: { id: true, zone_id: true, date: true, vardhi_number: true },
            orderBy: { date: 'asc' },
        });
        const zoneSequenceMap: Record<string, number> = {};
        const byZoneYear = new Map<string, typeof allVardhis>();
        for (const v of allVardhis) {
            const year = new Date(v.date).getFullYear();
            const key = `${v.zone_id}_${year}`;
            if (!byZoneYear.has(key)) byZoneYear.set(key, []);
            byZoneYear.get(key)!.push(v);
        }
        byZoneYear.forEach((group) => {
            group.sort((a, b) => {
                const dateDiff = new Date(a.date).getTime() - new Date(b.date).getTime();
                if (dateDiff !== 0) return dateDiff;
                return String(a.vardhi_number).localeCompare(String(b.vardhi_number));
            });
            group.forEach((v, idx) => {
                zoneSequenceMap[v.id] = idx + 1;
            });
        });
        sanitizedData.forEach((item: any) => {
            item.zone_sequence = zoneSequenceMap[item.id] || null;
        });

        return NextResponse.json(
            successResponse('Vardhi records fetched successfully', sanitizedData, {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            })
        );
    } catch (error) {
        console.error('Error fetching vardhi:', error);
        return NextResponse.json(
            errorResponse('Failed to fetch vardhi records'),
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const userId = session?.user?.id;
        const userRole = (session?.user as any)?.role;

        if (!session) {
            return NextResponse.json(
                { success: false, message: "Unauthorized" },
                { status: 401 }
            );
        }

        // Zone users cannot create new vardhi records
        if (userRole === 'Zone') {
            return NextResponse.json(
                { success: false, message: "Forbidden: Zone users cannot create vardhi records" },
                { status: 403 }
            );
        }

        const body = await request.json();

        
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
            report_pdf,
            site_photography,
            site_clear_photo,
            other_attachment,
            existing_items_total,
            employees_total,
            expenses_total,
            additional_items_total,
            grand_total,
        } = body;

        if (
            !zone_id ||
            !varshi_assign_by ||
            !date ||
            !location ||
            !vardhi_start_date ||
            !vardhi_end_date ||
            !work_type
        ) {
            return NextResponse.json(
                { success: false, message: "All required fields must be provided" },
                { status: 400 }
            );
        }

        if (new Date(vardhi_end_date) < new Date(vardhi_start_date)) {
            return NextResponse.json(
                { success: false, message: "End date must be after start date" },
                { status: 400 }
            );
        }

        if (work_type && typeof work_type === 'string' && work_type.length > 0) {
            const allItems = [
                ...(vardhiItems || []).filter((item: any) => item && item.item_id),
                ...(additionalItems || []).filter((item: any) => item && item.item_id)
            ];
 
            for (const item of allItems) {
                const rateStr = item.rate;
                const rate = rateStr === '0' ? 0 : (parseFloat(rateStr) || 0);
                 
                if (rate === 0) {
                    return NextResponse.json(
                        { success: false, message: "Rate must be greater than 0 for selected ANI items or additional items." },
                        { status: 400 }
                    );
                }
            }
        }

        const result = await withCompany(async (company) => {
            if (!company?.company_id) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 }
                );
            }

            return await prisma.$transaction(async (tx) => {
                const { vardhiNumber, globalSequence } = await generateVardhiNumber(
                    company.company_id,
                    zone_id,
                    new Date(date),
                    tx
                );

                const vardhi = await tx.vardhi.create({
                    data: {
                        company_id: company.company_id,
                        zone_id,
                        vardhi_number: vardhiNumber,
                        global_sequence: globalSequence,
                        varshi_assign_by,
                        date: new Date(date),
                        location,
                        vardhi_start_date: new Date(vardhi_start_date),
                        vardhi_end_date: new Date(vardhi_end_date),
                        work_type,
                    },
                    include: {
                        zone: {
                            select: {
                                id: true,
                                name: true,
                                file_no: true,
                            },
                        },
                    },
                });

                // Create vardhi items with amounts
                
                const validItems = vardhiItems?.filter(
                    (item: any) => item && (item.item_id || item.item_name) && (item.size || item.qty)
                ) || [];


                let existingItemsTotal = new Prisma.Decimal(0);
                if (validItems.length > 0) {
                    const itemsWithAmounts = validItems.map((item: any) => {
                        const qty = parseFloat(item.qty) || 0;
                        const rate = parseFloat(item.rate) || 0;
                        const amount = parseFloat(item.amount) || (qty * rate);
                        
                        
                        return {
                            company_id: company.company_id,
                            vardhi_id: vardhi.id,
                            item_id: item.item_id || null,
                            size: item.size || "",
                            qty: new Prisma.Decimal(qty),
                            rate: new Prisma.Decimal(rate),
                            amount: new Prisma.Decimal(amount),
                        };
                    });


                    await tx.vardhiItem.createMany({
                        data: itemsWithAmounts,
                    });

                    existingItemsTotal = itemsWithAmounts.reduce(
                        (sum: Prisma.Decimal, item: any) => sum.plus(item.amount),
                        new Prisma.Decimal(0)
                    );
                } else {
                }

                // Create vardhi employees
                const validEmployees = employeeIds?.filter(
                    (emp: any) => emp && emp.employee_id
                ) || [];


                for (const emp of validEmployees) {
                    const employeePrice = await tx.employeePrice.findFirst({
                        where: {
                            employee_id: emp.employee_id,
                            expiry_date: null,
                        },
                        orderBy: { start_date: 'desc' },
                    });

                    const baseRate = employeePrice?.price || new Prisma.Decimal(0);
                    const isOvertime = emp.is_overtime || false;
                    const overtimeHours = parseFloat(emp.overtime_hours) || 0;

                    await tx.vardhiEmployee.create({
                        data: {
                            vardhi_id: vardhi.id,
                            employee_id: emp.employee_id,
                            company_id: company.company_id,
                            is_overtime: isOvertime,
                            overtime_hours: overtimeHours > 0 ? new Prisma.Decimal(overtimeHours) : null,
                            rate: baseRate,
                        },
                    });
                }

                // Create vardhi expenses
                const validExpenses = expenses?.filter(
                    (exp: any) => exp && exp.particular && exp.amount > 0
                ) || [];

 

                if (validExpenses.length > 0) {
                    const expensesData = validExpenses.map((exp: any) => ({
                        company_id: company.company_id,
                        vardhi_id: vardhi.id,
                        particular: exp.particular,
                        amount: new Prisma.Decimal(exp.amount),
                    }));

                    await tx.vardhiExpense.createMany({
                        data: expensesData,
                    });
                }

                // Create vardhi additional items
                const validAdditionalItems = additionalItems?.filter(
                    (item: any) => item && item.item_name
                ) || [];

                let additionalItemsTotal = new Prisma.Decimal(0);
                if (validAdditionalItems.length > 0) {
                    const additionalItemsData = validAdditionalItems.map((item: any) => ({
                        company_id: company.company_id,
                        vardhi_id: vardhi.id,
                        item_id: item.item_id || null,
                        item_name: item.item_name,
                        size: item.size || "",
                        qty: new Prisma.Decimal(item.qty || 0),
                        rate: new Prisma.Decimal(item.rate || 0),
                        amount: new Prisma.Decimal(item.qty * item.rate || 0),
                        total: new Prisma.Decimal(item.qty * item.rate || 0),
                    }));

                    await tx.vardhiAdditionalItem.createMany({
                        data: additionalItemsData as any,
                    });

                    additionalItemsTotal = additionalItemsData.reduce(
                        (sum: Prisma.Decimal, item: any) => sum.plus(item.total),
                        new Prisma.Decimal(0)
                    );
                }

                const totalsFromFrontend = {
                    existingItemsTotal: new Prisma.Decimal(existing_items_total || 0),
                    employeesTotal: new Prisma.Decimal(employees_total || 0),
                    expensesTotal: new Prisma.Decimal(expenses_total || 0),
                    additionalItemsTotal: new Prisma.Decimal(additional_items_total || 0),
                    grandTotal: new Prisma.Decimal(grand_total || 0),
                    differenceTotal: new Prisma.Decimal((additional_items_total || 0) - (existing_items_total || 0)),
                };


                // Update vardhi with totals from frontend
                const updatedVardhi = await tx.vardhi.update({
                    where: { id: vardhi.id },
                    data: {
                        existing_items_total: totalsFromFrontend.existingItemsTotal,
                        employees_total: totalsFromFrontend.employeesTotal,
                        expenses_total: totalsFromFrontend.expensesTotal,
                        additional_items_total: totalsFromFrontend.additionalItemsTotal,
                        grand_total: totalsFromFrontend.grandTotal,
                        difference_total: totalsFromFrontend.differenceTotal,
                    },
                    include: {
                        zone: {
                            select: {
                                id: true,
                                name: true,
                                file_no: true,
                            },
                        },
                    },
                });

                // Handle attachments
                const attachmentFields = [
                    { key: "report_pdf", data: report_pdf },
                    { key: "site_photography", data: site_photography },
                    { key: "site_clear_photo", data: site_clear_photo },
                    { key: "other_attachment", data: other_attachment },
                ];

                for (const { key, data } of attachmentFields) {
                    if (data && Array.isArray(data) && data.length > 0) {
                        for (const fileData of data) {
                            if (!fileData.file_path) continue;

                            let finalFilePath = fileData.file_path;

                            if (fileData.file_path.includes("/temp/") && userId) {
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
                                    company.company_id,
                                    vardhi.id
                                );

                                const newPath = join(newDir, filename);

                                try {
                                    await mkdir(newDir, { recursive: true });
                                    await rename(oldPath, newPath);
                                    finalFilePath = `/uploads/vardhi/${company.company_id}/${vardhi.id}/${filename}`;
                                } catch (err) {
                                    console.error("Error moving file:", err);
                                }
                            }

                            await tx.vardhiAttachment.upsert({
                                where: {
                                    vardhi_id_type_file_name: {
                                        vardhi_id: vardhi.id,
                                        type: key,
                                        file_name: fileData.file_name || null,
                                    },
                                },
                                create: {
                                    vardhi_id: vardhi.id,
                                    company_id: company.company_id,
                                    type: key,
                                    file_path: finalFilePath,
                                    file_name: fileData.file_name || null,
                                    file_size: fileData.file_size || null,
                                    mime_type: fileData.mime_type || null,
                                },
                                update: {
                                    file_path: finalFilePath,
                                    file_size: fileData.file_size || null,
                                    mime_type: fileData.mime_type || null,
                                },
                            });
                        }
                    }
                }

                return updatedVardhi;
            });
        });

        if (result instanceof NextResponse) {
            return result;
        }

        // Create notification for SuperAdmin
        await createNotification({
            action: 'Created',
            entity: 'Vardhi',
            entityId: result.id,
            entityName: (result as any).vardhi_number,
            userId: userId as string,
            link: `/vardhi/edit/${result.id}`,
        });

        return NextResponse.json(
            {
                success: true,
                message: "Vardhi created successfully",
                data: result,
            },
            { status: 201 }
        );

    } catch (error: any) {
        console.error("Error creating vardhi:", error);
        return NextResponse.json(
            {
                success: false,
                message: error.message || "Failed to create vardhi record",
            },
            { status: 500 }
        );
    }
}
