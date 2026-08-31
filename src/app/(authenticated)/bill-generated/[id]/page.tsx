import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth";
import { notFound } from "next/navigation";
import BillViewAccordion from "@/components/bill-generated/bill-view-accordion";
import { prisma } from "@/lib/prisma";
import { withCompany } from "@/lib/company-server";

function serializeDecimal(obj: any): any {
    if (obj === null || obj === undefined) {
        return obj;
    }
    if (typeof obj === 'object' && obj.constructor.name === 'Decimal') {
        return Number(obj.toString());
    }
    if (Array.isArray(obj)) {
        return obj.map((item: any) => serializeDecimal(item));
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

interface Props {
    params: Promise<{ id: string }>;
}

export default async function VardhiDailyReportViewPage({ params }: Props) {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return <div>Please sign in to view this page.</div>;
    }

    const { id } = await params;

    const estimationData = await withCompany(async (companyId) => {
        const company_id = companyId?.company_id;

        if (!company_id) {
            return { data: null };
        }

        const estimation = await prisma.vardhiEstimation.findFirst({
            where: {
                id,
                company_id,
            },
            include: {
                company: true,
                vardhis: {
                    orderBy: { created_at: 'asc' },
                    include: {
                        vardhiItems: {
                            include: {
                                item: {
                                    include: {
                                        unit: true,
                                        ay: true,
                                    }
                                },
                            },
                            orderBy: { created_at: 'asc' }
                        },
                        additionalItems: {
                            include: {
                                item: {
                                    include: {
                                        unit: true,
                                        ay: true,
                                    }
                                },
                            },
                            orderBy: { created_at: 'asc' }
                        },
                        zone: true,
                    },
                },
                items: {
                    include: {
                        item: {
                            include: {
                                unit: true,
                                ay: true,
                            }
                        },
                        unit: true,
                        ay: true,
                    },
                    orderBy: { created_at: 'asc' }
                },
            },
        });

        if (!estimation) {
            return { data: null };
        }

        const invoice = await prisma.vardhiInvoice.findFirst({
            where: {
                estimation_id: id,
                company_id,
            },
            orderBy: { created_at: 'desc' },
        });

        return { data: { estimation, invoice: invoice ? serializeDecimal(invoice) : null } };
    });

    const { estimation: est, invoice: inv } = (estimationData as any)?.data || {};

    if (!est) {
        notFound();
    }

    const invoiceData = inv;
    const invoice = invoiceData ? {
        id: invoiceData.id,
        invoice_no: invoiceData.invoice_no,
        invoice_date: invoiceData.invoice_date,
        dept_name: invoiceData.dept_name,
        dept_bill_no: invoiceData.dept_bill_no,
        dept_bill_date: invoiceData.dept_bill_date,
        mb_no: invoiceData.mb_no,
        mb_page_no: invoiceData.mb_page_no,
        ra_bill_no: invoiceData.ra_bill_no,
        remarks: invoiceData.remarks,
        company_name: invoiceData.company_name,
        company_address: invoiceData.company_address,
        company_gstin: invoiceData.company_gstin,
        company_state: invoiceData.company_state,
        company_state_code: invoiceData.company_state_code,
        company_contact: invoiceData.company_contact,
        buyer_name: invoiceData.buyer_name,
        buyer_address: invoiceData.buyer_address,
        buyer_gstin: invoiceData.buyer_gstin,
        buyer_state: invoiceData.buyer_state,
        buyer_state_code: invoiceData.buyer_state_code,
        description: invoiceData.description,
        hsn_sac: invoiceData.hsn_sac,
        quantity: invoiceData.quantity,
        amount: invoiceData.amount,
        total_amount: invoiceData.total_amount,
        cgst_percent: invoiceData.cgst_percent,
        cgst_amount: invoiceData.cgst_amount,
        sgst_percent: invoiceData.sgst_percent,
        sgst_amount: invoiceData.sgst_amount,
        it_percent: invoiceData.it_percent,
        it_amount: invoiceData.it_amount,
        labour_cess_percent: invoiceData.labour_cess_percent,
        labour_cess_amount: invoiceData.labour_cess_amount,
        cgst_tds_percent: invoiceData.cgst_tds_percent,
        cgst_tds_amount: invoiceData.cgst_tds_amount,
        sgst_tds_percent: invoiceData.sgst_tds_percent,
        sgst_tds_amount: invoiceData.sgst_tds_amount,
        add_deposit_percent: invoiceData.add_deposit_percent,
        add_deposit_amount: invoiceData.add_deposit_amount,
        is_cgst_enabled: invoiceData.is_cgst_enabled ?? true,
        is_sgst_enabled: invoiceData.is_sgst_enabled ?? true,
        is_it_enabled: invoiceData.is_it_enabled ?? true,
        is_labour_cess_enabled: invoiceData.is_labour_cess_enabled ?? true,
        is_cgst_tds_enabled: invoiceData.is_cgst_tds_enabled ?? true,
        is_sgst_tds_enabled: invoiceData.is_sgst_tds_enabled ?? true,
        is_add_deposit_enabled: invoiceData.is_add_deposit_enabled ?? false,
        account_holder_name: invoiceData.account_holder_name,
        bank_name: invoiceData.bank_name,
        account_no: invoiceData.account_no,
        branch_name: invoiceData.branch_name,
        ifsc_code: invoiceData.ifsc_code,
        swift_code: invoiceData.swift_code,
    } : null;

    const companyData = est.company ? {
        id: est.company.id,
        company_name: est.company.company_name,
        address: est.company.address,
        gstin_uin: est.company.gstin_uin,
        state_name: est.company.state_name,
        state_code: est.company.state_code,
        contact: est.company.contact,
        buyer_name: est.company.buyer_name || est.contractor,
        buyer_address: est.company.buyer_address,
        buyer_gstin_uin: est.company.buyer_gstin_uin,
        buyer_state_name: est.company.buyer_state_name,
        buyer_state_code: est.company.buyer_state_code,
        hsn_sac: est.company.hsn_sac,
        cgst_rate: Number(est.company.cgst_rate) || 0,
        sgst_rate: Number(est.company.sgst_rate) || 0,
        income_tax_rate: Number(est.company.income_tax_rate) || 0,
        labour_cess_rate: Number(est.company.labour_cess_rate) || 0,
        cgst_tds_rate: Number(est.company.cgst_tds_rate) || 0,
        sgst_tds_rate: Number(est.company.sgst_tds_rate) || 0,
        additional_deposit: Number(est.company.additional_deposit) || 0,
        account_holder_name: est.company.account_holder_name,
        bank_name: est.company.bank_name,
        account_no: est.company.account_no,
        branch_name: est.company.branch_name,
        ifsc_code: est.company.ifsc_code,
        swift_code: est.company.swift_code,
    } : null;

    const formattedEstimation = {
        id: est.id,
        estimation_no: est.estimation_no,
        contractor: est.contractor,
        work_name: est.work_name,
        file_no: est.file_no,
        zone_no: est.zone_no,
        month_year: est.month_year,
        total_amount: Number(est.total_amount),
        created_at: est.created_at,
        company: companyData,
        items: est.items?.map((item: any) => ({
            ...item,
            rate: Number(item.rate),
            quantity: Number(item.quantity),
            amount: Number(item.amount),
        })) || [],
        vardhis: est.vardhis?.map((v: any) => ({
            ...v,
            name: v.location,
            date: v.date,
            vardhi_number: v.vardhi_number,
            vardhi_start_date: v.vardhi_start_date,
            vardhi_end_date: v.vardhi_end_date,
            work_type: v.work_type,
            location: v.location,
            zone: v.zone,
            vardhiItems: (v.vardhiItems || []).map((vi: any) => ({
                ...vi,
                item: vi.item,
                unit: vi.item?.unit || null,
            })),
            additionalItems: v.additionalItems?.map((ai: any) => ({
                ...ai,
                item: ai.item || null,
                unit: ai.item?.unit || null,
            })) || [],
        })) || [],
    };

    return <BillViewAccordion estimation={formattedEstimation as any} invoice={invoice} />;
}
