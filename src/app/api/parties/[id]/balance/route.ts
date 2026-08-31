import { NextRequest, NextResponse } from 'next/server';
import { withCompany } from '@/lib/company-server';
import { AccountingValidator } from '@/lib/accounting/validator';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: partyId } = await params;

        return await withCompany(async (company) => {
            const partyBalance = await AccountingValidator.getPartyBalanceById(partyId, company?.company_id || '');

            return NextResponse.json({
                success: true,
                data: {
                    party_id: partyId,
                    receivable: partyBalance.receivable,
                    payable: partyBalance.payable,
                },
            });
        });
    } catch (error) {
        console.error('Error fetching party balance:', error);
        return NextResponse.json(
            { success: false, message: 'Failed to fetch party balance' },
            { status: 500 }
        );
    }
}
