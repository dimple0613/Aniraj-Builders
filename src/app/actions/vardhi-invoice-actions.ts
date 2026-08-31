'use server'

import { prisma } from '@/lib/prisma'
import { withCompany } from '@/lib/company-server'
import { revalidatePath } from 'next/cache'
import { authorize } from '@/lib/authorize'
import { getFinancialYearShort } from '@/lib/financial-year'
import { Prisma } from '@prisma/client'

function serializeDecimal(obj: any): any {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (typeof obj === 'object' && obj.constructor.name === 'Decimal') {
        return Number(obj.toString());
    }
    if (Array.isArray(obj)) {
        return obj.map(item => serializeDecimal(item));
    }
    if (typeof obj === 'object') {
        const result: any = {};
        for (const key in obj) {
            result[key] = serializeDecimal(obj[key]);
        }
        return result;
    }
    return obj;
}

export async function generateInvoiceNumber(estimationId: string, estimationNo: string) {
    return estimationNo;
}

export async function getInvoiceByEstimation(estimationId: string) {
    await authorize('VARDHI_INVOICE', 'READ');
    return withCompany(async (companyId) => {
        const invoice = await prisma.vardhiInvoice.findFirst({
            where: {
                estimation_id: estimationId,
                company_id: companyId?.company_id,
            }
        });
        return serializeDecimal(invoice);
    });
}

export async function createVardhiInvoice(data: any) {
    await authorize('VARDHI_INVOICE', 'CREATE');

    return withCompany(async (company) => {
        const { netPayable, ...invoiceData } = data;

        const invoice = await prisma.vardhiInvoice.create({
            data: {
                ...invoiceData,
                total_amount: netPayable !== undefined ? new Prisma.Decimal(netPayable) : undefined,
                company_id: company.company_id,
            },
        });

        revalidatePath('/bill-generated');
        return serializeDecimal(invoice);
    });
}

export async function updateVardhiInvoice(id: string, data: any) {
    await authorize('VARDHI_INVOICE', 'UPDATE');
    return withCompany(async (companyId) => {
        const { netPayable, ...invoiceData } = data;

        const invoice = await prisma.vardhiInvoice.update({
            where: { id, company_id: companyId?.company_id },
            data: {
                ...invoiceData,
                total_amount: netPayable !== undefined ? new Prisma.Decimal(netPayable) : undefined,
            },
        });

        revalidatePath('/bill-generated');
        return serializeDecimal(invoice);
    });
}

export async function getVardhiEstimationForInvoice(id: string) {
    await authorize('VARDHI_ESTIMATES', 'READ');
    if (!id || typeof id !== 'string' || id.trim() === '') {
        console.error('Invalid estimation ID:', id);
        return null;
    }

    return withCompany(async (companyId) => {
        const estimation = await prisma.vardhiEstimation.findFirst({
            where: {
                id: id,
                company_id: companyId?.company_id,
            },
            include: {
                items: {
                    include: {
                        item: true,
                        unit: true,
                        ay: true,
                    }
                },
                company: true,
                vardhis: true,
            }
        });
        return serializeDecimal(estimation);
    });
}
