'use server';

import { authorize } from '@/lib/authorize';
import { GstReport } from '@/components/reports/gst-report';
import { redirect } from 'next/navigation';

export default async function GstPage() {
    try {
        await authorize('REPORTS', 'READ');
    } catch {
        redirect('/unauthorized');
    }

    return <GstReport />;
}
