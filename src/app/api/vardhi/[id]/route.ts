import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCompany } from "@/lib/company-server";
import {
    successResponse,
    errorResponse,
    unauthorizedResponse,
} from "@/lib/api-response";
import {
    regenerateVardhiNumber,
    getNextDailyIndexForDate,
    parseVardhiNumber,
} from "@/lib/vardhi-number";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createNotification } from "@/lib/notification-service";

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await context.params;
        const session = await getServerSession(authOptions);
        const userRole = (session?.user as any)?.role;
        const userZoneId = (session?.user as any)?.zone_id;

        if (!id) {
            return NextResponse.json(errorResponse("ID is required"), {
                status: 400,
            });
        }

        const data = await withCompany(async (company) => {
            const vardhi = await prisma.vardhi.findUnique({
                where: { id },
                include: {
                    zone: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                    vardhiItems: {
                        include: {
                            item: {
                                select: {
                                    id: true,
                                    item_name: true,
                                    unit_id: true,
                                    unit: { select: { id: true, unit_name: true } },
                                    ay: { select: { id: true, ay_no: true } },
                                },
                            },
                        },
                    },
                    employees: {
                        include: {
                            employee: {
                                include: {
                                    prices: true,
                                },
                            },
                        },
                    },
                    expenses: true,
                    additionalItems: {
                        include: {
                            item: {
                                select: {
                                    id: true,
                                    item_name: true,
                                    unit_id: true,
                                    unit: { select: { id: true, unit_name: true } },
                                    ay: { select: { id: true, ay_no: true } },
                                },
                            },
                        },
                    },
                    attachments: {
                        select: {
                            id: true,
                            type: true,
                            file_path: true,
                            file_name: true,
                            file_size: true,
                            mime_type: true,
                            created_at: true,
                        },
                        orderBy: { created_at: "desc" },
                    },
                },
            });

            if (!vardhi) {
                return NextResponse.json(errorResponse("Vardhi record not found"), {
                    status: 404,
                });
            }

            if (company?.company_id && vardhi.company_id !== company.company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 403 });
            }

            // Zone-based access control: Zone users can only view vardhis from their zone
            if (userRole === "Zone" && userZoneId) {
                if (vardhi.zone_id !== userZoneId) {
                    return NextResponse.json(
                        errorResponse(
                            "Forbidden: You can only access vardhis from your assigned zone",
                        ),
                        { status: 403 },
                    );
                }
            }

            const groupedAttachments = vardhi.attachments.reduce(
                (acc, att) => {
                    if (!acc[att.type]) {
                        acc[att.type] = [];
                    }
                    acc[att.type].push({
                        id: att.id,
                        file_path: att.file_path,
                        file_name: att.file_name,
                        file_size: att.file_size,
                        mime_type: att.mime_type,
                        created_at: att.created_at,
                    });
                    return acc;
                },
                {} as Record<
                    string,
                    Array<{
                        id: string;
                        file_path: string;
                        file_name: string;
                        file_size: number | null;
                        mime_type: string | null;
                        created_at: Date;
                    }>
                >,
            );

            return {
                id: vardhi.id,
                company_id: vardhi.company_id,
                zone_id: vardhi.zone_id,
                vardhi_number: vardhi.vardhi_number,
                varshi_assign_by: vardhi.varshi_assign_by,
                date: vardhi.date,
                location: vardhi.location,
                vardhi_start_date: vardhi.vardhi_start_date,
                vardhi_end_date: vardhi.vardhi_end_date,
                work_type: vardhi.work_type,
                is_in_billing: vardhi.is_in_billing,
                existing_items_total: vardhi.existing_items_total,
                employees_total: vardhi.employees_total,
                expenses_total: vardhi.expenses_total,
                additional_items_total: vardhi.additional_items_total,
                grand_total: vardhi.grand_total,
                difference_total: vardhi.difference_total,
                created_at: vardhi.created_at,
                updated_at: vardhi.updated_at,
                zone: vardhi.zone,
                vardhiItems: vardhi.vardhiItems.map((item) => ({
                    id: item.id,
                    item_id: item.item_id,
                    size: item.size,
                    qty: item.qty,
                    rate: item.rate,
                    amount: item.amount,
                    item: item.item,
                })),
                vardhiEmployees: vardhi.employees.map((emp) => ({
                    id: emp.id,
                    employee_id: emp.employee_id,
                    overtime_hours: emp.overtime_hours,
                    is_overtime: emp.is_overtime,
                    rate: emp.rate,
                    employee: emp.employee,
                })),
                vardhiExpenses: vardhi.expenses.map((exp) => ({
                    id: exp.id,
                    particular: exp.particular,
                    amount: exp.amount,
                })),
                vardhiAdditionalItems: vardhi.additionalItems.map((add) => ({
                    id: add.id,
                    item_id: (add as any).item_id || "",
                    item_name: add.item_name,
                    item: add.item,
                    size: add.size || "",
                    qty: add.qty?.toString() || "0",
                    rate: add.rate?.toString() || "0",
                    total: add.total?.toString() || "0",
                })),
                attachments: vardhi.attachments.map((att) => ({
                    id: att.id,
                    type: att.type,
                    file_path: att.file_path,
                    file_name: att.file_name,
                    file_size: att.file_size,
                    mime_type: att.mime_type,
                    created_at: att.created_at,
                })),
                groupedAttachments,
            };
        });

        if (data instanceof NextResponse) {
            return data;
        }

        return NextResponse.json(
            successResponse("Vardhi record fetched successfully", data),
        );
    } catch (error) {
        console.error("Error fetching vardhi:", error);
        return NextResponse.json(errorResponse("Failed to fetch vardhi record"), {
            status: 500,
        });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        const userId = (session?.user as any)?.id;
        const userName = (session?.user as any)?.name;
        const userRole = (session?.user as any)?.role;
        const userZoneId = (session?.user as any)?.zone_id;
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
            vardhiEmployees,
            vardhiExpenses,
            vardhiAdditionalItems,
            report_pdf,
            site_photography,
            site_clear_photo,
            other_attachment,
            existing_items_total,
            employees_total,
            expenses_total,
            additional_items_total,
            grand_total,
            initial_attachment_counts,
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
                errorResponse("All required fields must be provided"),
                { status: 400 },
            );
        }

        if (new Date(vardhi_end_date) < new Date(vardhi_start_date)) {
            return NextResponse.json(
                errorResponse("End date must be after start date"),
                { status: 400 },
            );
        }

        if (work_type && typeof work_type === "string" && work_type.length > 0) {
            const allItems = [
                ...(vardhiItems || []).filter((item: any) => item && item.item_id),
                ...(vardhiAdditionalItems || []).filter(
                    (item: any) => item && item.item_id,
                ),
            ];

            for (const item of allItems) {
                const rateStr = item.rate;
                const rate = rateStr === "0" ? 0 : parseFloat(rateStr) || 0;

                if (rate === 0) {
                    return NextResponse.json(
                        {
                            success: false,
                            message:
                                "Rate must be greater than 0 for selected ANI items or additional items.",
                        },
                        { status: 400 },
                    );
                }
            }
        }

        let existingVardhiForChanges: any = null;

        const result = await withCompany(async (company) => {
            if (!company?.company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existingVardhi = await prisma.vardhi.findUnique({
                where: { id },
                select: {
                    company_id: true,
                    is_in_billing: true,
                    zone_id: true,
                    date: true,
                    vardhi_number: true,
                    global_sequence: true,
                    location: true,
                },
            });

            if (!existingVardhi) {
                return NextResponse.json(errorResponse("Vardhi not found"), {
                    status: 404,
                });
            }

            if (existingVardhi.company_id !== company.company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 403 });
            }

            // Zone-based access control: Zone users can only edit vardhis from their zone
            if (userRole === "Zone" && userZoneId) {
                if (existingVardhi.zone_id !== userZoneId) {
                    return NextResponse.json(
                        errorResponse(
                            "Forbidden: You can only edit vardhis from your assigned zone",
                        ),
                        { status: 403 },
                    );
                }
            }

            if (existingVardhi.is_in_billing) {
                return NextResponse.json(
                    errorResponse("Cannot edit vardhi that is already in billing"),
                    { status: 403 },
                );
            }

            // Capture existing data for change tracking (only for Zone Officer edits)
            if (userRole === "Zone") {
                existingVardhiForChanges = await prisma.vardhi.findUnique({
                    where: { id },
                    include: {
                        vardhiItems: {
                            include: {
                                item: {
                                    select: { item_name: true },
                                },
                            },
                        },
                        additionalItems: true,
                        attachments: true,
                    },
                });
            }

            return await prisma.$transaction(
                async (tx) => {
                const existingItemsTotal = existing_items_total || 0;
                const additionalItemsTotal = additional_items_total || 0;
                const employeesTotal = employees_total || 0;
                const expensesTotal = expenses_total || 0;
                const grandTotal =
                    grand_total ||
                    existingItemsTotal +
                    additionalItemsTotal +
                    employeesTotal +
                    expensesTotal;
                const differenceTotal = additionalItemsTotal - existingItemsTotal;

                const newDate = new Date(date);
                const zoneChanged = existingVardhi.zone_id !== zone_id;
                const dateChanged = existingVardhi.date.getTime() !== newDate.getTime();

                let newVardhiNumber = existingVardhi.vardhi_number;
                let newGlobalSequence = existingVardhi.global_sequence;
                let updateGlobalSeq = false;

                if (zoneChanged || dateChanged) {
                    let newDailyIndex = await getNextDailyIndexForDate(zone_id, newDate, tx, id);
                    const oldParts = existingVardhi.vardhi_number.split('//');
                    if (oldParts.length === 3) {
                        updateGlobalSeq = true;
                    } else {
                        newGlobalSequence = parseInt(oldParts[3], 10) || 1;
                    }

                    let attempts = 0;
                    while (attempts < 100) {
                        const { vardhiNumber, globalSequence } = await regenerateVardhiNumber(
                            zone_id,
                            newDate,
                            newGlobalSequence,
                            newDailyIndex,
                            updateGlobalSeq,
                            tx
                        );
                        newVardhiNumber = vardhiNumber;
                        newGlobalSequence = globalSequence;
                        const existing = await tx.vardhi.findUnique({ where: { vardhi_number: newVardhiNumber } });
                        if (!existing) break;
                        newDailyIndex++;
                        attempts++;
                    }
                }

                const updateData: any = {
                    zone_id,
                    varshi_assign_by,
                    date: newDate,
                    location,
                    vardhi_number: newVardhiNumber,
                    vardhi_start_date: new Date(vardhi_start_date),
                    vardhi_end_date: new Date(vardhi_end_date),
                    work_type,
                    existing_items_total: existingItemsTotal,
                    additional_items_total: additionalItemsTotal,
                    employees_total: employeesTotal,
                    expenses_total: expensesTotal,
                    grand_total: grandTotal,
                    difference_total: differenceTotal,
                };
                if (updateGlobalSeq) {
                    updateData.global_sequence = newGlobalSequence;
                }

                const vardhi = await tx.vardhi.update({
                    where: { id },
                    data: updateData,
                });

                await tx.vardhiItem.deleteMany({
                    where: { vardhi_id: id },
                });

                const validItems = (vardhiItems || []).filter(
                    (item: any) => item && item.item_id,
                );

                if (validItems.length > 0) {
                    await tx.vardhiItem.createMany({
                        data: validItems.map((item: any) => ({
                            company_id: company.company_id,
                            vardhi_id: id,
                            item_id: item.item_id,
                            size: item.size || "",
                            qty: parseFloat(item.qty) || 0,
                            rate: parseFloat(item.rate) || 0,
                            amount: parseFloat(item.amount) || 0,
                        })),
                    });
                }

                await tx.vardhiEmployee.deleteMany({
                    where: { vardhi_id: id },
                });

                const validEmployees = (vardhiEmployees || []).filter(
                    (emp: any) => emp && emp.employee_id,
                );

                if (validEmployees.length > 0) {
                    const seen = new Set();
                    const deduped = validEmployees.filter((emp: any) => {
                        if (seen.has(emp.employee_id)) return false;
                        seen.add(emp.employee_id);
                        return true;
                    });
                    await tx.vardhiEmployee.createMany({
                        data: deduped.map((emp: any) => ({
                            company_id: company.company_id,
                            vardhi_id: id,
                            employee_id: emp.employee_id,
                            is_overtime: emp.is_overtime || false,
                            overtime_hours: parseFloat(emp.overtime_hours) || 0,
                            rate: parseFloat(emp.salary) || 0,
                        })),
                    });
                }

                await tx.vardhiExpense.deleteMany({
                    where: { vardhi_id: id },
                });

                const validExpenses = (vardhiExpenses || []).filter(
                    (exp: any) => exp && exp.particular,
                );

                if (validExpenses.length > 0) {
                    await tx.vardhiExpense.createMany({
                        data: validExpenses.map((exp: any) => ({
                            company_id: company.company_id,
                            vardhi_id: id,
                            particular: exp.particular,
                            amount: parseFloat(exp.amount) || 0,
                        })),
                    });
                }

                await tx.vardhiAdditionalItem.deleteMany({
                    where: { vardhi_id: id },
                });

                const validAdditionalItems = (vardhiAdditionalItems || []).filter(
                    (item: any) => item && item.item_name,
                );

                if (validAdditionalItems.length > 0) {
                    await tx.vardhiAdditionalItem.createMany({
                        data: validAdditionalItems.map((item: any) => ({
                            company_id: company.company_id,
                            vardhi_id: id,
                            item_id: item.item_id || null,
                            item_name: item.item_name,
                            size: item.size || "",
                            qty: parseFloat(item.qty) || 0,
                            rate: parseFloat(item.rate) || 0,
                            amount: parseFloat(item.qty) * parseFloat(item.rate) || 0,
                            total: parseFloat(item.total) || 0,
                        })) as any,
                    });
                }

                const attachmentFields = [
                    { key: "report_pdf", data: report_pdf },
                    { key: "site_photography", data: site_photography },
                    { key: "site_clear_photo", data: site_clear_photo },
                    { key: "other_attachment", data: other_attachment },
                ];

                for (const { key, data } of attachmentFields) {
                    if (data && Array.isArray(data)) {
                        const existingAttachments = await tx.vardhiAttachment.findMany({
                            where: { vardhi_id: id, type: key },
                            select: { id: true },
                        });
                        const existingIds = new Set(
                            existingAttachments.map((a: { id: string }) => a.id),
                        );
                        const newIds = new Set(
                            (data || []).filter((f: any) => f.id).map((f: any) => f.id),
                        );

                        const toDelete = [...existingIds].filter(
                            (id: string) => !newIds.has(id),
                        );
                        if (toDelete.length > 0) {
                            await tx.vardhiAttachment.deleteMany({
                                where: { id: { in: toDelete } },
                            });
                        }

                        for (const fileData of data || []) {
                            if (fileData.file_path && !fileData.id) {
                                await tx.vardhiAttachment.create({
                                    data: {
                                        vardhi_id: id,
                                        company_id: company.company_id,
                                        type: key,
                                        file_path: fileData.file_path,
                                        file_name: fileData.file_name || null,
                                        file_size: fileData.file_size || null,
                                        mime_type: fileData.mime_type || null,
                                    },
                                });
                            }
                        }
                    }
                }

                const updatedVardhi = await tx.vardhi.findUnique({
                    where: { id },
                    include: {
                        zone: {
                            select: {
                                id: true,
                                name: true,
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
                        employees: {
                            include: {
                                employee: {
                                    select: {
                                        id: true,
                                        name: true,
                                    },
                                },
                            },
                        },
                        expenses: true,
                        additionalItems: true,
                        attachments: {
                            select: {
                                id: true,
                                type: true,
                                file_path: true,
                                file_name: true,
                                file_size: true,
                                mime_type: true,
                                created_at: true,
                            },
                            orderBy: { created_at: "desc" },
                        },
                    },
                });

                return updatedVardhi;
            }, { timeout: 30000 });
        });

        if (result instanceof NextResponse) {
            return result;
        }

        // Build detailed change tracking for Zone Officer edits
        let changes: { field: string; oldValue: string; newValue: string }[] = [];
        if (userRole === "Zone" && existingVardhiForChanges) {
            if (existingVardhiForChanges.location !== location) {
                changes.push({ field: "Address", oldValue: existingVardhiForChanges.location || "", newValue: location || "" });
            }

            const initCounts: Record<string, number> = initial_attachment_counts || {};
            const newAttFields: Record<string, any[]> = { report_pdf, site_photography, site_clear_photo, other_attachment };
            for (const [type, files] of Object.entries(newAttFields)) {
                const oldByType = initCounts[type] ?? 0;
                const newByType = (files || []).filter((f: any) => f.file_path).length;
                if (newByType !== oldByType) {
                    changes.push({ field: `Attachments - ${type}`, oldValue: `${oldByType} file(s)`, newValue: `${newByType} file(s)` });
                }
            }

            const oldItems = existingVardhiForChanges.vardhiItems || [];
            const newItems = (vardhiItems || []).filter((i: any) => i.item_id);

            const itemMaxLen = Math.max(oldItems.length, newItems.length);
            for (let i = 0; i < itemMaxLen; i++) {
                const oi = oldItems[i];
                const ni = newItems[i];
                if (oi && ni && oi.item_id !== ni.item_id) {
                    const oldName = oi.item?.item_name || oi.item_name || 'Unknown';
                    changes.push({ field: 'Item Details - (changed)', oldValue: `${oldName} (${oi.size || ''})`, newValue: `${ni.item_name || 'Unknown'} (${ni.size || ''})` });
                } else if (oi && ni && (oi.size !== ni.size || parseFloat(oi.rate || 0) !== parseFloat(ni.rate || 0))) {
                    changes.push({ field: `Item Details - ${ni.item_name || 'Unknown'}`, oldValue: `Size: ${oi.size || ''}`, newValue: `Size: ${ni.size || ''}` });
                } else if (oi && !ni) {
                    const name = oi.item?.item_name || oi.item_name || 'Unknown';
                    changes.push({ field: `Item Details - ${name} (deleted)`, oldValue: `Size: ${oi.size || ''}`, newValue: "[Deleted]" });
                } else if (!oi && ni) {
                    changes.push({ field: `Item Details - ${ni.item_name || 'Unknown'} (added)`, oldValue: "[New]", newValue: `Size: ${ni.size || ''}` });
                }
            }

            const oldAddItems = existingVardhiForChanges.additionalItems || [];
            const newAddItems = (vardhiAdditionalItems || []).filter((i: any) => i.item_name);

            const addMaxLen = Math.max(oldAddItems.length, newAddItems.length);
            for (let i = 0; i < addMaxLen; i++) {
                const oi = oldAddItems[i];
                const ni = newAddItems[i];
                if (oi && ni && oi.item_name !== ni.item_name) {
                    changes.push({ field: 'Additional Items - (changed)', oldValue: `${oi.item_name} (${oi.size || ''})`, newValue: `${ni.item_name} (${ni.size || ''})` });
                } else if (oi && ni && (oi.size !== ni.size || Number(oi.qty) !== parseFloat(ni.qty || 0))) {
                    changes.push({ field: `Additional Items - ${ni.item_name}`, oldValue: `Size: ${oi.size || ''}`, newValue: `Size: ${ni.size || ''}` });
                } else if (oi && !ni) {
                    changes.push({ field: `Additional Items - ${oi.item_name} (deleted)`, oldValue: `Size: ${oi.size || ''}`, newValue: "[Deleted]" });
                } else if (!oi && ni) {
                    changes.push({ field: `Additional Items - ${ni.item_name} (added)`, oldValue: "[New]", newValue: `Size: ${ni.size || ''}` });
                }
            }

            // Totals summary
            const oldExistingTotal = Number(existingVardhiForChanges.existing_items_total || 0);
            const newExistingTotal = Number(existing_items_total || 0);
            const oldAdditionalTotal = Number(existingVardhiForChanges.additional_items_total || 0);
            const newAdditionalTotal = Number(additional_items_total || 0);
            const oldGrandTotal = Number(existingVardhiForChanges.grand_total || 0);
            const newGrandTotal = Number(grand_total || 0);
            changes.push({ field: 'Existing Items total', oldValue: `₹${oldExistingTotal}`, newValue: `₹${newExistingTotal}` });
            changes.push({ field: 'Additional Items total', oldValue: `₹${oldAdditionalTotal}`, newValue: `₹${newAdditionalTotal}` });
            changes.push({ field: 'Final Total', oldValue: `₹${oldGrandTotal}`, newValue: `₹${newGrandTotal}` });
        }

        // Create notification
        const vardhiNumber = (result as any).vardhi_number;
        if (userRole === "Zone" && changes.length > 0) {
            await createNotification({
                action: "Updated",
                entity: "Vardhi",
                entityId: id,
                entityName: vardhiNumber,
                userId: userId as string,
                link: `/vardhi/edit/${id}`,
                message: JSON.stringify({ text: `${userName || 'Zone Officer'} / Zone Officer updated Vardhi ${vardhiNumber}`, changes }),
            });
        } else if (userRole !== "Zone") {
            await createNotification({
                action: "Updated",
                entity: "Vardhi",
                entityId: id,
                entityName: vardhiNumber,
                userId: userId as string,
                link: `/vardhi/edit/${id}`,
            });
        }

        return NextResponse.json(
            successResponse("Vardhi updated successfully", result),
        );
    } catch (error: any) {
        console.error("Error updating vardhi:", error);
        return NextResponse.json(
            errorResponse(error.message || "Failed to update vardhi record"),
            { status: 500 },
        );
    }
}

// Handle update for Zone users - only additional items
async function handleZoneUserUpdate(
    id: string,
    body: any,
    session: any,
    userZoneId: string | null,
    userId: string,
) {
    const { vardhiAdditionalItems, additional_items_total } = body;

    return await withCompany(async (company) => {
        if (!company?.company_id) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }

        const existingVardhi = await prisma.vardhi.findUnique({
            where: { id },
            select: { company_id: true, zone_id: true, is_in_billing: true },
        });

        if (!existingVardhi) {
            return NextResponse.json(errorResponse("Vardhi not found"), { status: 404 });
        }

        if (existingVardhi.company_id !== company.company_id) {
            return NextResponse.json(unauthorizedResponse(), { status: 403 });
        }

        if (existingVardhi.zone_id !== userZoneId) {
            return NextResponse.json(
                errorResponse("Forbidden: You can only edit vardhis from your assigned zone"),
                { status: 403 },
            );
        }

        if (existingVardhi.is_in_billing) {
            return NextResponse.json(
                errorResponse("Cannot edit vardhi that is already in billing"),
                { status: 403 },
            );
        }

        // Check that only allowed fields are present
        const allowedFields = ["vardhiAdditionalItems", "additionalItems", "additional_items_total"];
        const allFields = Object.keys(body);
        for (const field of allFields) {
            if (!allowedFields.includes(field)) {
                return NextResponse.json(
                    errorResponse(`Zone users can only edit Additional Items. Field '${field}' is not allowed.`),
                    { status: 403 },
                );
            }
        }

        const result = await prisma.$transaction(async (tx) => {
            const additionalItemsTotal = additional_items_total || 0;

            await tx.vardhiAdditionalItem.deleteMany({
                where: { vardhi_id: id },
            });

            const validAdditionalItems = (vardhiAdditionalItems || []).filter(
                (item: any) => item && item.item_name,
            );

            if (validAdditionalItems.length > 0) {
                await tx.vardhiAdditionalItem.createMany({
                    data: validAdditionalItems.map((item: any) => ({
                        company_id: company.company_id,
                        vardhi_id: id,
                        item_id: item.item_id || null,
                        item_name: item.item_name,
                        size: item.size || "",
                        qty: parseFloat(item.qty) || 0,
                        rate: parseFloat(item.rate) || 0,
                        amount: parseFloat(item.qty) * parseFloat(item.rate) || 0,
                        total: parseFloat(item.total) || 0,
                    })) as any,
                });
            }

            const updatedVardhi = await tx.vardhi.update({
                where: { id },
                data: { additional_items_total: additionalItemsTotal },
                include: {
                    zone: { select: { id: true, name: true } },
                    additionalItems: true,
                },
            });

            return updatedVardhi;
        });

        // Create notification
        await createNotification({
            action: "Updated",
            entity: "Vardhi",
            entityId: id,
            entityName: result.vardhi_number,
            userId: userId as string,
            link: `/vardhi/edit/${id}`,
        });

        return NextResponse.json(
            successResponse("Vardhi updated successfully", result),
        );
    });
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);
        const userId = (session?.user as any)?.id;
        const userRole = (session?.user as any)?.role;
        const userZoneId = (session?.user as any)?.zone_id;

        let deletedVardhiNumber: string | undefined;

        const result = await withCompany(async (company) => {
            if (!company?.company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existingVardhi = await prisma.vardhi.findUnique({
                where: { id },
                select: { company_id: true, zone_id: true, vardhi_number: true },
            });

            if (!existingVardhi) {
                return NextResponse.json(errorResponse("Vardhi not found"), {
                    status: 404,
                });
            }

            if (existingVardhi.company_id !== company.company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 403 });
            }

            // Zone-based access control: Zone users can only delete vardhis from their zone
            if (userRole === "Zone" && userZoneId) {
                if (existingVardhi.zone_id !== userZoneId) {
                    return NextResponse.json(
                        errorResponse(
                            "Forbidden: You can only delete vardhis from your assigned zone",
                        ),
                        { status: 403 },
                    );
                }
            }

            deletedVardhiNumber = existingVardhi.vardhi_number;

            await prisma.$transaction(async (tx) => {
                await tx.vardhiItem.deleteMany({
                    where: { vardhi_id: id },
                });

                await tx.vardhiEmployee.deleteMany({
                    where: { vardhi_id: id },
                });

                await tx.vardhiExpense.deleteMany({
                    where: { vardhi_id: id },
                });

                await tx.vardhiAdditionalItem.deleteMany({
                    where: { vardhi_id: id },
                });

                await tx.vardhiAttachment.deleteMany({
                    where: { vardhi_id: id },
                });

                await tx.vardhi.delete({
                    where: { id },
                });
            });

            return successResponse("Vardhi record deleted successfully");
        });

        if (result instanceof NextResponse) {
            return result;
        }

        // Create notification for SuperAdmin
        await createNotification({
            action: "Deleted",
            entity: "Vardhi",
            entityId: id,
            entityName: deletedVardhiNumber,
            userId: userId as string,
            link: `/vardhi`,
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error("Error deleting vardhi:", error);
        return NextResponse.json(errorResponse("Failed to delete vardhi record"), {
            status: 500,
        });
    }
}
