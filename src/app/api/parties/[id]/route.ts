import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        return await withCompany(async (company) => {
            const party = await prisma.party.findFirst({
                where: {
                    id,
                    company_id: company?.company_id,
                },
                include: {
                    purchaseEntries: {
                        take: 10,
                        orderBy: { entry_date: 'desc' },
                        include: {
                            project: true,
                        },
                    },
                },
            });

            if (!party) {
                return NextResponse.json(
                    { success: false, message: 'Party not found' },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                message: 'Party fetched successfully',
                data: party,
            });
        });
    } catch (error) {
        console.error('Error fetching party:', error);
        if (error instanceof Error) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, message: 'Failed to fetch party' },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const {
            linked_bank_accounts,
            bank_account_name,
            bank_account_number,
            bank_name,
            bank_ifsc_code,
            bank_opening_balance,
            ...partyData
        } = body;

        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const existingParty = await prisma.party.findFirst({
                where: {
                    id,
                    company_id: company?.company_id,
                },
            });

            if (!existingParty) {
                return NextResponse.json(
                    { success: false, message: 'Party not found' },
                    { status: 404 }
                );
            }

            if (partyData.name !== existingParty.name) {
                const duplicateParty = await prisma.party.findUnique({
                    where: {
                        company_id_name: {
                            company_id: company?.company_id!,
                            name: partyData.name,
                        },
                    },
                });

                if (duplicateParty) {
                    return NextResponse.json(
                        { success: false, message: 'Party with this name already exists' },
                        { status: 400 }
                    );
                }
            }

            const updateData: any = { ...partyData };

            if (bank_account_name !== undefined) updateData.bank_account_name = bank_account_name || null;
            if (bank_account_number !== undefined) updateData.bank_account_number = bank_account_number || null;
            if (bank_name !== undefined) updateData.bank_name = bank_name || null;
            if (bank_ifsc_code !== undefined) updateData.bank_ifsc_code = bank_ifsc_code || null;
            if (bank_opening_balance !== undefined) updateData.bank_opening_balance = bank_opening_balance || 0;

            const party = await prisma.party.update({
                where: { id },
                data: updateData,
            });

            const updatedParty = await prisma.party.findUnique({
                where: { id: party.id },
            });

            await createNotification({
                action: 'Updated',
                entity: 'Party',
                entityId: id,
                entityName: updatedParty?.name || existingParty.name,
                userId: (session?.user as any)?.id,
                link: `/parties`,
            });

            return NextResponse.json({
                success: true,
                message: 'Party updated successfully',
                data: updatedParty,
            });
        });
    } catch (error: any) {
        console.error('Error updating party:', error);
        if (error.name === 'ValidationError') {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }
        if (error instanceof Error) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, message: 'Failed to update party' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const existingParty = await prisma.party.findFirst({
                where: {
                    id,
                    company_id: company?.company_id,
                },
            });

            if (!existingParty) {
                return NextResponse.json(
                    { success: false, message: 'Party not found' },
                    { status: 404 }
                );
            }

            const purchaseEntryCount = await prisma.purchaseEntry.count({
                where: { party_id: id },
            });
            const bankTxnCount = await prisma.bankBookTransaction.count({
                where: { party_id: id, is_deleted: false },
            });
            const cashTxnCount = await prisma.cashBookTransaction.count({
                where: { party_id: id, is_deleted: false },
            });

            if (purchaseEntryCount > 0 || bankTxnCount > 0 || cashTxnCount > 0) {
                return NextResponse.json(
                    { success: false, message: 'Cannot delete party that is in use' },
                    { status: 400 }
                );
            }

            await prisma.party.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'Party',
                entityId: id,
                entityName: existingParty.name,
                userId: (session?.user as any)?.id,
                link: `/parties`,
            });

            return NextResponse.json({
                success: true,
                message: 'Party deleted successfully',
            });
        });
    } catch (error) {
        console.error('Error deleting party:', error);
        if (error instanceof Error) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { success: false, message: 'Failed to delete party' },
            { status: 500 }
        );
    }
}
