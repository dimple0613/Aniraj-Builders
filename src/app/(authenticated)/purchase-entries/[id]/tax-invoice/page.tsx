import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { notFound } from 'next/navigation';
import PurchaseTaxInvoicePage from './page-client';

interface PageProps {
    params: Promise<{ id: string }>;
}

export default async function PurchaseTaxInvoicePageWrapper({ params }: PageProps) {
    const { id } = await params;

    return await withCompany(async (company) => {
        const companyId = company?.company_id!;

        const purchaseEntry: any = await prisma.purchaseEntry.findFirst({
            where: {
                id,
                company_id: companyId,
            },
            include: {
                party: true,
                project: true,
                materials: {
                    include: {
                        capitalSOR: true,
                    },
                },
                locations: {
                    include: {
                        location: true,
                    },
                },
            },
        } as any);

        if (!purchaseEntry) {
            notFound();
        }

        const companyData = await prisma.company.findFirst({
            where: { id: companyId },
        });

        const bankAccounts = await prisma.account.findMany({
            where: {
                company_id: companyId,
                type: "BANK",
                is_active: true,
            },
            select: {
                id: true,
                account_name: true,
                account_number: true,
                bank_name: true,
                ifsc_code: true,
            },
        });

        return (
            <PurchaseTaxInvoicePage
                purchaseEntry={purchaseEntry as any}
                company={companyData as any}
                bankAccounts={bankAccounts as any}
            />
        );
    });
}
