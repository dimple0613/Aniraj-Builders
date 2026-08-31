import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function formatDateCode(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = MONTHS[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    return `${day}${month}${year}`;
}

function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return hash;
}

function getShortPartyName(name: string): string {
    const cleaned = name.replace(/[^a-zA-Z\s]/g, '').trim().toUpperCase();
    const words = cleaned.split(/\s+/);
    if (words.length === 1) {
        return words[0].substring(0, 4);
    }
    return words
        .slice(0, 2)
        .map((w) => w[0])
        .join('');
}

async function generateUniqueEntryNo(
    companyId: string,
    partyId: string,
    entryDate: Date
): Promise<string> {
    const party = await prisma.party.findFirst({
        where: { id: partyId, company_id: companyId },
        select: { name: true },
    });

    if (!party) {
        throw new Error('Party not found');
    }

    const shortName = getShortPartyName(party.name);
    const dateCode = formatDateCode(entryDate);
    const prefix = `${shortName}/${dateCode}/`;

    const startOfDay = new Date(entryDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(entryDate);
    endOfDay.setHours(23, 59, 59, 999);

    const lastEntry = await prisma.purchaseEntry.findFirst({
        where: {
            company_id: companyId,
            party_id: partyId,
            entry_date: {
                gte: startOfDay,
                lte: endOfDay,
            },
        },
        orderBy: { entry_no: 'desc' },
    });

    const lastNumber = lastEntry?.entry_no
        ? parseInt(lastEntry.entry_no.split('/').pop() || '0', 10) || 0
        : 0;

    return `${prefix}${lastNumber + 1}`;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search') || '';
        const voucherType = searchParams.get('voucher_type');
        const accountType = searchParams.get('account_type');
        const transactionType = searchParams.get('transaction_type');
        const projectId = searchParams.get('project_id');
        const partyId = searchParams.get('party_id');
        const startDate = searchParams.get('start_date');
        const endDate = searchParams.get('end_date');
        const sortBy = searchParams.get('sortField') || 'entry_date';
        const sortOrder = searchParams.get('sortOrder') || 'desc';
        const paymentStatus = searchParams.get('payment_status');

        return await withCompany(async (company) => {
            const where: any = {
                company_id: company?.company_id,
            };

            if (search) {
                where.OR = [
                    { instrument_no: { contains: search, mode: 'insensitive' } },
                    { remark: { contains: search, mode: 'insensitive' } },
                    { entry_no: { contains: search, mode: 'insensitive' } },
                ];
            }

            if (voucherType) where.voucher_type = voucherType;
            if (accountType) where.account_type = accountType;
            if (transactionType) where.transaction_type = transactionType;
            if (projectId) where.project_id = projectId;
            if (partyId) where.party_id = partyId;

            if (startDate || endDate) {
                where.entry_date = {};
                if (startDate) where.entry_date.gte = new Date(startDate);
                if (endDate) where.entry_date.lte = new Date(endDate);
            }

            const skip = (page - 1) * limit;

            const [data, total, employees] = await Promise.all([
                prisma.purchaseEntry.findMany({
                    where,
                    skip,
                    take: limit,
                    orderBy: { [sortBy]: sortOrder },
                    include: {
                        party: true,
                        project: true,
                        receivedByEmployee: {
                            select: { id: true, name: true },
                        },
                        materials: {
                            include: {
                                capitalSOR: true,
                            },
                        },
                        locations: {
                            include: {
                                location: true,
                            },
                        },
                    },
                }),
                prisma.purchaseEntry.count({ where }),
                prisma.employee.findMany({
                    where: { company_id: company?.company_id },
                    select: { id: true, name: true },
                }),
            ]);

            const employeeMap = new Map(employees.map((e: any) => [e.id, e.name]));
            const purchaseEntryIds = data.map((p: any) => p.id);
            
            const bankTransactions = await prisma.bankBookTransaction.findMany({
                where: {
                    company_id: company?.company_id,
                    narration: {
                        contains: 'Payment for Purchase Entry',
                    },
                    is_deleted: false,
                },
                select: {
                    narration: true,
                    id: true,
                },
            });

            const cashTransactions = await prisma.cashBookTransaction.findMany({
                where: {
                    company_id: company?.company_id,
                    particular: {
                        contains: 'Payment for Purchase Entry',
                    },
                    is_deleted: false,
                },
                select: {
                    particular: true,
                    id: true,
                },
            });

            const paidEntryIds = new Set<string>();
            [...bankTransactions, ...cashTransactions].forEach((t: any) => {
                const txnNarration = t.narration || t.particular;
                if (!txnNarration) return;
                const hashIndex = txnNarration.indexOf('#');
                if (hashIndex !== -1) {
                    const entryId = txnNarration.substring(hashIndex + 1).trim();
                    if (entryId) {
                        paidEntryIds.add(entryId);
                    }
                }
            });

            const dataWithPaymentStatus = data.map((entry: any) => {
                const hasPayment = paidEntryIds.has(entry.id);
                const dbStatus = entry.payment_status;
                let isPaid = hasPayment;
                let paymentStatusDisplay = 'UNPAID';
                
                if (dbStatus === 'PAID' || (hasPayment && !dbStatus)) {
                    isPaid = true;
                    paymentStatusDisplay = 'PAID';
                } else if (dbStatus === 'PARTIAL') {
                    isPaid = true;
                    paymentStatusDisplay = 'PARTIAL';
                } else {
                    isPaid = false;
                    paymentStatusDisplay = 'UNPAID';
                }
                
                let receivedByDisplay = null;
                if (entry.received_by) {
                    receivedByDisplay = entry.receivedByEmployee?.name || entry.custom_name || entry.received_by;
                } else if (entry.custom_name && entry.custom_name !== '-') {
                    receivedByDisplay = entry.custom_name;
                }
                
                return {
                    ...entry,
                    isPaid,
                    paymentStatus: paymentStatusDisplay,
                    receivedByName: receivedByDisplay,
                };
            });

            let filteredData = dataWithPaymentStatus;
            if (paymentStatus === 'paid') {
                filteredData = dataWithPaymentStatus.filter((e: any) => e.isPaid);
            } else if (paymentStatus === 'unpaid') {
                filteredData = dataWithPaymentStatus.filter((e: any) => !e.isPaid);
            }

            const totalFiltered = filteredData.length;
            const paginatedData = filteredData.slice(skip, skip + limit);

            return NextResponse.json({
                success: true,
                message: 'Purchase entries fetched successfully',
                data: paginatedData,
                pagination: {
                    page,
                    limit,
                    total: totalFiltered,
                    pages: Math.ceil(totalFiltered / limit),
                },
            });
        });
    } catch (error) {
        console.error('Error fetching purchase entries:', error);
        if (error instanceof Error) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, message: 'Failed to fetch purchase entries' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const body = await request.json();
        const { 
            entry_date, 
            voucher_type, 
            account_type, 
            transaction_type, 
            project_id, 
            party_id, 
            instrument_no, 
            gst_percent,
            gst_total,
            received_by,
            custom_name,
            location_ids, 
            remark, 
            materials 
        } = body;

        if (!entry_date || !party_id) {
            return NextResponse.json(
                { success: false, message: 'Entry date and party are required' },
                { status: 400 }
            );
        }

        if (!project_id) {
            return NextResponse.json(
                { success: false, message: 'Project is required' },
                { status: 400 }
            );
        }

        if (!materials || materials.length === 0) {
            return NextResponse.json(
                { success: false, message: 'At least one material is required' },
                { status: 400 }
            );
        }

        return await withCompany(async (company) => {
            const companyId = company?.company_id!;

            // Validate that the party_id references an existing party in this company
            const existingParty = await prisma.party.findFirst({
                where: { id: party_id, company_id: companyId },
                select: { id: true, name: true },
            });

            if (!existingParty) {
                return NextResponse.json(
                    { success: false, message: 'Selected party not found. Please select a valid party from the list.' },
                    { status: 400 }
                );
            }

            // Ensure Material records exist for all material IDs
            const allMaterials = await prisma.material.findMany({
                where: { company_id: companyId },
                select: { id: true, name: true },
            });
            const materialByName = new Map(allMaterials.map((m) => [m.name, m.id]));
            const materialById = new Set(allMaterials.map((m) => m.id));

            for (const m of materials) {
                const materialId = m.capital_sor_id || m.material_id;
                if (materialId) {
                    const capitalSor = await prisma.capitalSOR.findUnique({
                        where: { id: materialId },
                        select: { item_name: true },
                    });
                    if (capitalSor?.item_name) {
                        const existingId = materialByName.get(capitalSor.item_name);
                        let resolvedId: string;
                        if (existingId) {
                            await prisma.material.update({
                                where: { id: existingId },
                                data: { rate: m.rate || 0 },
                            });
                            resolvedId = existingId;
                        } else if (materialById.has(materialId)) {
                            await prisma.material.update({
                                where: { id: materialId },
                                data: { rate: m.rate || 0 },
                            });
                            resolvedId = materialId;
                        } else {
                            const created = await prisma.material.create({
                                data: {
                                    id: materialId,
                                    company_id: companyId,
                                    name: capitalSor.item_name,
                                    rate: m.rate || 0,
                                    updatedAt: new Date(),
                                },
                            });
                            resolvedId = created.id;
                            materialById.add(resolvedId);
                            materialByName.set(capitalSor.item_name, resolvedId);
                        }
                        // Remap the material ID so the transaction uses the correct Material record
                        m.capital_sor_id = resolvedId;
                        m.material_id = resolvedId;
                    }
                }
            }

            const shortName = getShortPartyName(existingParty.name);
            const dateCode = formatDateCode(new Date(entry_date));
            const prefix = `${shortName}/${dateCode}/`;

            const purchaseEntry = await prisma.$transaction(async (tx) => {
                const lastEntry = await tx.purchaseEntry.findFirst({
                    where: { company_id: companyId },
                    orderBy: { sr_no: 'desc' },
                });

                const srNo = (lastEntry?.sr_no || 0) + 1;

                const lastWithPrefix = await tx.purchaseEntry.findFirst({
                    where: { entry_no: { startsWith: prefix } },
                    orderBy: { entry_no: 'desc' },
                });

                let entryNumber = 1;
                if (lastWithPrefix?.entry_no) {
                    const parts = lastWithPrefix.entry_no.split('/');
                    const lastNum = parseInt(parts[parts.length - 1], 10);
                    if (!isNaN(lastNum)) entryNumber = lastNum + 1;
                }

                const entryNo = `${prefix}${entryNumber}`;

                return tx.purchaseEntry.create({
                    data: {
                        company_id: companyId,
                        sr_no: srNo,
                        entry_no: entryNo,
                        entry_date: new Date(entry_date),
                        voucher_type: voucher_type || 'PURCHASE',
                        account_type: account_type || 'DEBIT',
                        transaction_type: transaction_type || 'LOCAL',
                        project_id: project_id || null,
                        party_id: party_id,
                        instrument_no: instrument_no || null,
                        gst_percent: gst_percent || 0,
                        gst_total: gst_total || 0,
                        received_by: received_by || null,
                        custom_name: custom_name || null,
                        remark: remark || null,
                        materials: {
                            create: materials.map((m: { capital_sor_id?: string; material_id?: string; qty: number; rate: number; total: number; gst_percent?: number; subcontractor_ids?: string[] }) => ({
                                company_id: companyId,
                                material_id: m.capital_sor_id || m.material_id,
                                qty: m.qty,
                                rate: m.rate,
                                total: m.total,
                                gst_percent: m.gst_percent || 0,
                                subcontractor_ids: m.subcontractor_ids?.length ? JSON.stringify(m.subcontractor_ids) : null,
                            })),
                        },
                        locations: location_ids && location_ids.length > 0
                            ? {
                                create: location_ids.map((locId: string) => ({
                                    company_id: companyId,
                                    location_id: locId,
                                })),
                            }
                            : undefined,
                    },
                    include: {
                        materials: true,
                        locations: {
                            include: {
                                location: true,
                            },
                        },
                    },
                });
            });

            if (project_id) {
                const project = await prisma.project.findFirst({
                    where: { id: project_id, company_id: companyId },
                });
                if (project) {
                    await prisma.project.update({
                        where: { id: project_id },
                        data: {
                            start_date: new Date(entry_date),
                            status: 'IN_PROGRESS',
                        },
                    });
                }
            }

            for (const m of materials) {
                const materialId = m.capital_sor_id || m.material_id;
                if (m.update_price && materialId) {
                    await prisma.materialPriceHistory.updateMany({
                        where: {
                            material_id: materialId,
                            expire_date: null,
                        },
                        data: {
                            expire_date: new Date(entry_date),
                        },
                    });

                    await prisma.materialPriceHistory.create({
                        data: {
                            company_id: companyId,
                            material_id: materialId,
                            rate: m.rate,
                            start_date: new Date(entry_date),
                        },
                    });

                    await prisma.material.update({
                        where: { id: materialId },
                        data: { rate: m.rate },
                    });
                }
            }

            await createNotification({
                action: 'Created',
                entity: 'Purchase Entry',
                entityId: purchaseEntry.id,
                entityName: purchaseEntry.entry_no || undefined,
                userId: (session?.user as any)?.id,
                link: `/purchase-entries`,
            });

            return NextResponse.json({
                success: true,
                message: 'Purchase entry created successfully',
                data: purchaseEntry,
            });
        });
    } catch (error: any) {
        console.error('Error creating purchase entry:', error);
        if (error instanceof Error) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, message: 'Failed to create purchase entry' },
            { status: 500 }
        );
    }
}

export async function PUT(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, message: 'Purchase entry ID is required' },
                { status: 400 }
            );
        }

        const body = await request.json();
        const { 
            entry_date, 
            voucher_type, 
            account_type, 
            transaction_type, 
            project_id, 
            party_id, 
            instrument_no, 
            gst_percent,
            gst_total,
            received_by,
            custom_name,
            location_ids, 
            remark, 
            materials 
        } = body;

        if (!project_id) {
            return NextResponse.json(
                { success: false, message: 'Project is required' },
                { status: 400 }
            );
        }

        return await withCompany(async (company) => {
            const companyId = company?.company_id!;

            const existingEntry = await prisma.purchaseEntry.findFirst({
                where: {
                    id,
                    company_id: companyId,
                },
            });

            if (!existingEntry) {
                return NextResponse.json(
                    { success: false, message: 'Purchase entry not found' },
                    { status: 404 }
                );
            }

            const shouldRegenerateEntryNo =
                existingEntry.party_id !== party_id ||
                new Date(existingEntry.entry_date).toDateString() !== new Date(entry_date).toDateString();

            let entryNo = existingEntry.entry_no;
            if (shouldRegenerateEntryNo) {
                entryNo = await generateUniqueEntryNo(
                    companyId,
                    party_id,
                    new Date(entry_date)
                );
            }

            await prisma.purchaseEntryMaterial.deleteMany({
                where: { purchase_entry_id: id },
            });

            await prisma.purchaseEntryLocation.deleteMany({
                where: { purchase_entry_id: id },
            });

            const updatedEntry = await prisma.purchaseEntry.update({
                where: { id },
                data: {
                    entry_date: new Date(entry_date),
                    voucher_type: voucher_type || 'PURCHASE',
                    account_type: account_type || 'DEBIT',
                    transaction_type: transaction_type || 'LOCAL',
                    project_id: project_id || null,
                    party_id: party_id,
                    instrument_no: instrument_no || null,
                    gst_percent: gst_percent || 0,
                    gst_total: gst_total || 0,
                    received_by: received_by || null,
                    custom_name: custom_name || null,
                    remark: remark || null,
                } as any,
            });

            await prisma.purchaseEntryMaterial.createMany({
                data: materials.map((m: { capital_sor_id?: string; material_id?: string; qty: number; rate: number; total?: number; gst_percent?: number; subcontractor_ids?: string[] }) => ({
                    company_id: companyId,
                    purchase_entry_id: id,
                    material_id: m.capital_sor_id || m.material_id,
                    qty: m.qty,
                    rate: m.rate,
                    total: m.total ?? (m.qty * m.rate),
                    gst_percent: m.gst_percent || 0,
                    subcontractor_ids: m.subcontractor_ids?.length ? JSON.stringify(m.subcontractor_ids) : null,
                })),
            });

            if (location_ids && location_ids.length > 0) {
                const validLocationIds = (location_ids as string[]).filter(Boolean);
                if (validLocationIds.length > 0) {
                    await prisma.purchaseEntryLocation.createMany({
                        data: validLocationIds.map((locId: string) => ({
                            company_id: companyId,
                            purchase_entry_id: id,
                            location_id: locId,
                        })),
                    });
                }
            }

            for (const m of materials) {
                const materialId = m.capital_sor_id || m.material_id;
                if (m.update_price && materialId) {
                    await prisma.materialPriceHistory.updateMany({
                        where: {
                            material_id: materialId,
                            expire_date: null,
                        },
                        data: {
                            expire_date: new Date(entry_date),
                        },
                    });

                    await prisma.materialPriceHistory.create({
                        data: {
                            company_id: companyId,
                            material_id: materialId,
                            rate: m.rate,
                            start_date: new Date(entry_date),
                        },
                    });

                    await prisma.material.update({
                        where: { id: materialId },
                        data: { rate: m.rate },
                    });
                }
            }

            const purchaseEntry = await prisma.purchaseEntry.findUnique({
                where: { id },
                include: {
                    party: true,
                    project: true,
                    receivedByEmployee: {
                        select: { id: true, name: true },
                    },
                    materials: {
                        include: {
                            material: true,
                        },
                    },
                    locations: {
                        include: {
                            location: true,
                        },
                    },
                },
            } as any);

            return NextResponse.json({
                success: true,
                message: 'Purchase entry updated successfully',
                data: purchaseEntry,
            });
        });
    } catch (error: any) {
        console.error('Error updating purchase entry:', error);
        if (error instanceof Error) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, message: 'Failed to update purchase entry' },
            { status: 500 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, message: 'Purchase entry ID is required' },
                { status: 400 }
            );
        }

        return await withCompany(async (company) => {
            const existingEntry = await prisma.purchaseEntry.findFirst({
                where: {
                    id,
                    company_id: company?.company_id,
                },
            });

            if (!existingEntry) {
                return NextResponse.json(
                    { success: false, message: 'Purchase entry not found' },
                    { status: 404 }
                );
            }

            await prisma.purchaseEntryMaterial.deleteMany({
                where: { purchase_entry_id: id },
            });

            await prisma.purchaseEntryLocation.deleteMany({
                where: { purchase_entry_id: id },
            });

            await prisma.purchaseEntry.delete({
                where: { id },
            });

            return NextResponse.json({
                success: true,
                message: 'Purchase entry deleted successfully',
            });
        });
    } catch (error: any) {
        console.error('Error deleting purchase entry:', error);
        if (error instanceof Error) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, message: 'Failed to delete purchase entry' },
            { status: 500 }
        );
    }
}
