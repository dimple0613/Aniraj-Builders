'use server';

import { authorize } from '@/lib/authorize';
import { redirect } from 'next/navigation';
import { BelongingsTransferClient } from '@/components/belongings-transfer/belongings-transfer-client';

export default async function BelongingsTransferPage() {
    try {
        await authorize('BELONGINGS_TRANSFER', 'READ');
    } catch {
        redirect('/unauthorized');
    }
    
    return <BelongingsTransferClient />;
}
