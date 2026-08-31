import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { purchaseEntryFullSchema } from '@/lib/validations/purchase';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        return await withCompany(async (company) => {
                const entry = await prisma.purchaseEntry.findFirst({
                where: {
                    id,
                    company_id: company?.company_id,
                },
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
            });

            if (!entry) {
                return NextResponse.json(
                    { success: false, message: 'Purchase entry not found' },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                message: 'Purchase entry fetched successfully',
                data: entry,
            });
        });
    } catch (error) {
        console.error('Error fetching purchase entry:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to fetch purchase entry' },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        const { id } = await params;
        const body = await request.json();

        if (body.payment_status && !body.materials) {
            return await withCompany(async (company) => {
                const companyId = company?.company_id!;
                
                const existingEntry = await prisma.purchaseEntry.findFirst({
                    where: { id, company_id: companyId },
                });

                if (!existingEntry) {
                    return NextResponse.json(
                        { success: false, message: 'Purchase entry not found' },
                        { status: 404 }
                    );
                }

                await prisma.purchaseEntry.update({
                    where: { id },
                    data: { payment_status: body.payment_status },
                });

                return NextResponse.json({
                    success: true,
                    message: 'Payment status updated successfully',
                });
            });
        }

        const validatedData = await purchaseEntryFullSchema.validate(body, { abortEarly: false });

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
            materials,
        } = validatedData;

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
                    { success: false, message: 'Project not found' },
                    { status: 404 }
                );
            }

            await prisma.purchaseEntry.update({
                where: { id },
                data: {
                    entry_date: new Date(entry_date),
                    voucher_type: voucher_type || 'PURCHASE VOUCHER',
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

            // Ensure Material records exist for all material IDs
            if (materials && materials.length > 0) {
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
            }

            await prisma.purchaseEntryMaterial.deleteMany({
                where: { purchase_entry_id: id },
            });

            await prisma.purchaseEntryLocation.deleteMany({
                where: { purchase_entry_id: id },
            });

            if (materials && materials.length > 0) {
                await prisma.purchaseEntryMaterial.createMany({
                    data: materials.map((m: any) => ({
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

                for (const m of materials) {
                    const materialId = m.capital_sor_id || m.material_id;
                    if ((m as any).update_price && materialId) {
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
            }

            if (location_ids && location_ids.length > 0) {
                const validLocationIds = location_ids.filter((locId): locId is string => !!locId);
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

            if (project_id) {
                await prisma.project.update({
                    where: { id: project_id },
                    data: {
                        start_date: new Date(entry_date),
                        status: 'IN_PROGRESS',
                    },
                });
            }

            const updatedEntry = await prisma.purchaseEntry.findUnique({
                where: { id },
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
            });

            await createNotification({
                action: 'Updated',
                entity: 'Purchase Entry',
                entityId: id,
                entityName: updatedEntry?.entry_no || existingEntry.entry_no || undefined,
                userId: (session?.user as any)?.id,
                link: `/purchase-entries`,
            });

            return NextResponse.json({
                success: true,
                message: 'Purchase entry updated successfully',
                data: updatedEntry,
            });
        });
    } catch (error: any) {
        console.error('Error updating purchase entry:', error);
        if (error.name === 'ValidationError') {
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

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        const { id } = await params;

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

            await createNotification({
                action: 'Deleted',
                entity: 'Purchase Entry',
                entityId: id,
                entityName: existingEntry.entry_no || undefined,
                userId: (session?.user as any)?.id,
                link: `/purchase-entries`,
            });

            return NextResponse.json({
                success: true,
                message: 'Purchase entry deleted successfully',
            });
        });
    } catch (error) {
        console.error('Error deleting purchase entry:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to delete purchase entry' },
            { status: 500 }
        );
    }
}