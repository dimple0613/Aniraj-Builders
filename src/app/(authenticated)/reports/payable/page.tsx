'use server';

import { authorize } from '@/lib/authorize';
import { PayableReport } from '@/components/reports/payable-report';
import { redirect } from 'next/navigation';

export default async function PayablePage() {
    try {
        await authorize('REPORTS', 'READ');
    } catch {
        redirect('/unauthorized');
    }

    return <PayableReport />;
}
