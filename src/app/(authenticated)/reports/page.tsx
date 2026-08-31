'use server';

import { authorize } from '@/lib/authorize';
import { ReportsClient } from '@/components/reports/reports-client';
import { redirect } from 'next/navigation';

export default async function ReportsPage() {
    try {
        await authorize('REPORTS', 'READ');
    } catch {
        redirect('/unauthorized');
    }

    return <ReportsClient />;
}
