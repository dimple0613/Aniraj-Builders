'use server';

import { authorize } from '@/lib/authorize';
import { PartyLedgerReport } from '@/components/reports/party-ledger-report';
import { redirect } from 'next/navigation';

export default async function PartyLedgerPage() {
    try {
        await authorize('REPORTS', 'READ');
    } catch {
        redirect('/unauthorized');
    }

    return <PartyLedgerReport />;
}
