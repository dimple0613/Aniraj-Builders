'use server';

import { authorize } from '@/lib/authorize';
import { ProjectCostReport } from '@/components/reports/project-cost-report';
import { redirect } from 'next/navigation';

export default async function ProjectCostPage() {
    try {
        await authorize('REPORTS', 'READ');
    } catch {
        redirect('/unauthorized');
    }

    return <ProjectCostReport />;
}
