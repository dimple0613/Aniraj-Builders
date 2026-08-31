'use server';

import { authorize } from '@/lib/authorize';
import { redirect } from 'next/navigation';
import { ChequePrintClient } from '@/components/cheque-print/cheque-print-client';

export default async function ChequePrintPage() {
    try {
        await authorize('CHEQUE_PRINT', 'READ');
    } catch {
        redirect('/unauthorized');
    }
    
    return <ChequePrintClient />;
}
