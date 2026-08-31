'use server';

import { authorize } from '@/lib/authorize';
import { redirect } from 'next/navigation';
import { TaxInvoiceClient } from '@/components/purchase-entries/tax-invoice/tax-invoice-client';

export default async function TaxInvoicePage() {
    try {
        await authorize('TAX_INVOICE', 'READ');
    } catch {
        redirect('/unauthorized');
    }
    
    return <TaxInvoiceClient />;
}
