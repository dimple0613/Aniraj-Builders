'use server';

import { authorize } from '@/lib/authorize';
import { ReceivableReport } from '@/components/reports/receivable-report';
import { redirect } from 'next/navigation';

export default async function ReceivablePage() {
    try {
        await authorize('REPORTS', 'READ');
    } catch {
        redirect('/unauthorized');
    }

    return <ReceivableReport />;
}
