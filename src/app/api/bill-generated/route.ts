import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { Prisma } from '@prisma/client';
import { createNotification } from '@/lib/notification-service';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { calculateNetPayable } from './calculate-net-payable';
import { getFinancialYearShort } from '@/lib/financial-year';

const STAGE_ORDER: Record<string, number> = {
    'file_submitted': 1,
    'store_report': 2,
    'submitted_for_approved': 3,
    'approved': 4,
    'bill_prepaid': 5,
    'bill_audit': 6,
    'bill_account': 7,
    'payment_received': 8,
};

async function generatDailyReportNumber(companyId: string): Promise<string> {
    const fy = getFinancialYearShort(new Date());
    const lastEstimation = await prisma.vardhiEstimation.findFirst({
        where: { company_id: companyId },
        orderBy: { created_at: 'desc' },
    });

    let nextNumber = 1;
    if (lastEstimation && lastEstimation.estimation_no) {
        const lastNumMatch = lastEstimation.estimation_no.match(/\/\/(\d+)$/);
        if (lastNumMatch) {
            nextNumber = parseInt(lastNumMatch[1]) + 1;
        }
    }

    return `TI${fy}//${nextNumber.toString().padStart(2, '0')}`;
}

function validatDailyReportData(data: any): { valid: boolean; error?: string } {
    if (!data.contractor?.trim()) {
        return { valid: false, error: 'Contractor name is required' };
    }
    if (!data.work_name?.trim()) {
        return { valid: false, error: 'Work name is required' };
    }
    if (!data.vardhi_ids || data.vardhi_ids.length === 0) {
        return { valid: false, error: 'At least one Vardhi is required' };
    }
    if (!data.items || data.items.length === 0) {
        return { valid: false, error: 'At least one item is required' };
    }

    for (const item of data.items) {
        if (!item.unit_id) {
            return { valid: false, error: 'Unit is required for all items' };
        }
        const qty = parseFloat(item.quantity);
        if (isNaN(qty) || qty <= 0) {
            return { valid: false, error: 'Quantity must be greater than 0' };
        }
        const rate = parseFloat(item.rate);
        if (isNaN(rate) || rate < 0) {
            return { valid: false, error: 'Rate must be 0 or greater' };
        }
    }

    return { valid: true };
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';
        const status = searchParams.get('status') || '';
        const month = searchParams.get('month') || '';
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');

        const results = await withCompany(async (companyId) => {
            const tid = companyId?.company_id;
            const where: any = {
                company_id: tid,
            };

            if (status) {
                where.status = status;
            }

            if (month) {
                where.month_year = { contains: month, mode: 'insensitive' };
            }

            if (search) {
                where.OR = [
                    { estimation_no: { contains: search, mode: 'insensitive' } },
                    { contractor: { contains: search, mode: 'insensitive' } },
                    { work_name: { contains: search, mode: 'insensitive' } },
                ];
            }

            const [company, data, total] = await Promise.all([
                tid ? prisma.company.findUnique({
                    where: { id: tid },
                    select: {
                        cgst_rate: true,
                        sgst_rate: true,
                        income_tax_rate: true,
                        labour_cess_rate: true,
                        cgst_tds_rate: true,
                        sgst_tds_rate: true,
                        additional_deposit: true,
                        approved_by_ranges: true,
                    }
                }) : Promise.resolve(null),
                prisma.vardhiEstimation.findMany({
                    where,
                    select: {
                        id: true,
                        company_id: true,
                        estimation_no: true,
                        contractor: true,
                        work_name: true,
                        file_no: true,
                        zone_no: true,
                        month_year: true,
                        total_amount: true,
                        status: true,
                        current_stage: true,
                        created_at: true,
                        updated_at: true,
                        file_submitted_date: true,
                        store_report_date: true,
                        submitted_for_approved_date: true,
                        approved_date: true,
                        approved_no: true,
                        bill_prepaid_date: true,
                        bill_audit_date: true,
                        bill_account_date: true,
                        payment_received_date: true,
                        vardhis: {
                            select: {
                                id: true,
                                vardhi_number: true,
                                zone: { select: { name: true, file_no: true } }
                            }
                        },
                        _count: {
                            select: { items: true }
                        },
                        invoices: {
                            select: {
                                id: true,
                                amount: true,
                                quantity: true,
                                total_amount: true,
                                cgst_percent: true,
                                sgst_percent: true,
                                is_cgst_enabled: true,
                                is_sgst_enabled: true,
                                it_percent: true,
                                is_it_enabled: true,
                                labour_cess_percent: true,
                                is_labour_cess_enabled: true,
                                cgst_tds_percent: true,
                                is_cgst_tds_enabled: true,
                                sgst_tds_percent: true,
                                is_sgst_tds_enabled: true,
                                add_deposit_percent: true,
                                is_add_deposit_enabled: true,
                            },
                            take: 1,
                        }
                    },
                    orderBy: [
                        { created_at: 'desc' },
                    ],
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                prisma.vardhiEstimation.count({ where }),
            ]);

            const processedData = data.map((item: any) => {
                const invoice = item.invoices?.[0];

                if (invoice) {
                    return { ...item, total_amount: Number(invoice.total_amount ?? 0), invoices: undefined };
                }

                const netPayable = calculateNetPayable({
                    amount: Number(item.total_amount || 0),
                    quantity: 1,
                    cgstPercent: company?.cgst_rate || 0,
                    sgstPercent: company?.sgst_rate || 0,
                    isCgstEnabled: true,
                    isSgstEnabled: true,
                    itPercent: company?.income_tax_rate || 0,
                    isItEnabled: true,
                    labourCessPercent: company?.labour_cess_rate || 0,
                    isLabourCessEnabled: true,
                    cgstTdsPercent: company?.cgst_tds_rate || 0,
                    isCgstTdsEnabled: true,
                    sgstTdsPercent: company?.sgst_tds_rate || 0,
                    isSgstTdsEnabled: true,
                    addDepositPercent: company?.additional_deposit || 0,
                    isAddDepositEnabled: false,
                });
                return { ...item, total_amount: netPayable, invoices: undefined };
            });

            return { data: processedData, total, approved_by_ranges: company?.approved_by_ranges || [] };
        });

        if (results instanceof NextResponse) {
            return results;
        }

        // Sort data by current_stage order
        // Incomplete stages (Change button) first, completed stages (View button) last
        const sortedData = [...results.data].sort((a: any, b: any) => {
            const orderA = STAGE_ORDER[a.current_stage || 'file_submitted'] || 99;
            const orderB = STAGE_ORDER[b.current_stage || 'file_submitted'] || 99;
            
            if (orderA !== orderB) {
                return orderA - orderB;
            }
            
            // Secondary: Incomplete stages first, completed stages last
            // A record is "completed" only if at final stage AND has payment_received_date
            const isCompleted = (item: any) => {
                return item.current_stage === 'payment_received' && !!item.payment_received_date;
            };
            
            const completedA = isCompleted(a) ? 1 : 0;
            const completedB = isCompleted(b) ? 1 : 0;
            
            return completedA - completedB;
        });

        return NextResponse.json(
            successResponse('Bill Tracking records fetched successfully', sortedData, {
                page,
                limit,
                total: results.total,
                pages: Math.ceil(results.total / limit),
                approved_by_ranges: (results.approved_by_ranges as any[]) || [],
            })
        );
    } catch (error: any) {
        console.error('Error fetching Bill Tracking records', error);
        const errorMessage = error.message || 'Failed to fetch Bill Tracking records';
        return NextResponse.json(
            errorResponse(errorMessage),
            { status: error.message?.includes('COMPANY_CONTEXT_MISSING') ? 401 : 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { contractor, work_name, vardhi_ids, items, status, file_no, zone_no, month_year } = body;

        const validation = validatDailyReportData({ contractor, work_name, vardhi_ids, items });
        if (!validation.valid) {
            return NextResponse.json(
                errorResponse(validation.error || 'Validation failed'),
                { status: 400 }
            );
        }

        const result = await withCompany(async (companyId) => {
            const tid = companyId?.company_id;
            if (!tid) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const estimation_no = await generatDailyReportNumber(tid);

            return prisma.$transaction(async (tx) => {
                const totalAmount = items.reduce((sum: number, item: any) =>
                    sum + (parseFloat(item.rate) || 0) * (parseFloat(item.quantity) || 0), 0
                );

                const companyDetails = await tx.company.findUnique({
                    where: { id: tid },
                    select: {
                        company_name: true,
                        address: true,
                        gstin_uin: true,
                        state_name: true,
                        state_code: true,
                        contact: true,
                        buyer_name: true,
                        buyer_address: true,
                        buyer_gstin_uin: true,
                        buyer_state_name: true,
                        buyer_state_code: true,
                        hsn_sac: true,
                        cgst_rate: true,
                        sgst_rate: true,
                        income_tax_rate: true,
                        labour_cess_rate: true,
                        cgst_tds_rate: true,
                        sgst_tds_rate: true,
                        additional_deposit: true,
                        bank_name: true,
                        branch_name: true,
                        ifsc_code: true,
                        swift_code: true,
                        account_no: true,
                        account_holder_name: true,
                    }
                });

                const estimation = await tx.vardhiEstimation.create({
                    data: {
                        company_id: tid,
                        estimation_no,
                        contractor: contractor.trim(),
                        work_name: work_name.trim(),
                        file_no: file_no || null,
                        zone_no: zone_no || null,
                        month_year: month_year || null,
                        status: status || 'DRAFT',
                        total_amount: totalAmount,
                        vardhis: {
                            connect: vardhi_ids.map((id: string) => ({ id }))
                        }
                    }
                });

                const invoiceNetPayable = calculateNetPayable({
                    amount: totalAmount,
                    quantity: 1,
                    cgstPercent: companyDetails?.cgst_rate || 0,
                    sgstPercent: companyDetails?.sgst_rate || 0,
                    isCgstEnabled: true,
                    isSgstEnabled: true,
                    itPercent: companyDetails?.income_tax_rate || 0,
                    isItEnabled: true,
                    labourCessPercent: companyDetails?.labour_cess_rate || 0,
                    isLabourCessEnabled: true,
                    cgstTdsPercent: companyDetails?.cgst_tds_rate || 0,
                    isCgstTdsEnabled: true,
                    sgstTdsPercent: companyDetails?.sgst_tds_rate || 0,
                    isSgstTdsEnabled: true,
                    addDepositPercent: companyDetails?.additional_deposit || 0,
                    isAddDepositEnabled: false,
                });

                await tx.vardhiInvoice.create({
                    data: {
                        company_id: tid,
                        estimation_id: estimation.id,
                        invoice_no: estimation.estimation_no,
                        invoice_date: new Date(),
                        company_name: companyDetails?.company_name || '',
                        company_address: companyDetails?.address || null,
                        company_gstin: companyDetails?.gstin_uin || null,
                        company_state: companyDetails?.state_name || null,
                        company_state_code: companyDetails?.state_code || null,
                        company_contact: companyDetails?.contact || null,
                        buyer_name: companyDetails?.buyer_name || '',
                        buyer_address: companyDetails?.buyer_address || null,
                        buyer_gstin: companyDetails?.buyer_gstin_uin || null,
                        buyer_state: companyDetails?.buyer_state_name || null,
                        buyer_state_code: companyDetails?.buyer_state_code || null,
                        description: work_name.trim() || '',
                        hsn_sac: companyDetails?.hsn_sac || null,
                        quantity: 1,
                        amount: totalAmount,
                        total_amount: invoiceNetPayable,
                        cgst_percent: companyDetails?.cgst_rate || null,
                        sgst_percent: companyDetails?.sgst_rate || null,
                        it_percent: companyDetails?.income_tax_rate || null,
                        labour_cess_percent: companyDetails?.labour_cess_rate || null,
                        cgst_tds_percent: companyDetails?.cgst_tds_rate || null,
                        sgst_tds_percent: companyDetails?.sgst_tds_rate || null,
                        add_deposit_percent: companyDetails?.additional_deposit || null,
                        is_cgst_enabled: true,
                        is_sgst_enabled: true,
                        is_it_enabled: true,
                        is_labour_cess_enabled: true,
                        is_cgst_tds_enabled: true,
                        is_sgst_tds_enabled: true,
                        is_add_deposit_enabled: false,
                        account_holder_name: companyDetails?.account_holder_name || null,
                        bank_name: companyDetails?.bank_name || null,
                        account_no: companyDetails?.account_no || null,
                        branch_name: companyDetails?.branch_name || null,
                        ifsc_code: companyDetails?.ifsc_code || null,
                        swift_code: companyDetails?.swift_code || null,
                    },
                });

                if (items && items.length > 0) {
                    await tx.vardhiEstimationItem.createMany({
                        data: items.map((item: any) => ({
                            company_id: tid,
                            estimation_id: estimation.id,
                            item_id: item.item_id || null,
                            custom_name: item.custom_name || null,
                            size: item.size || null,
                            rate: parseFloat(item.rate) || 0,
                            unit_id: item.unit_id || null,
                            ay_id: item.ay_id || null,
                            quantity: parseFloat(item.quantity) || 0,
                            amount: (parseFloat(item.rate) || 0) * (parseFloat(item.quantity) || 0),
                        }))
                    });
                }

                return tx.vardhiEstimation.findUnique({
                    where: { id: estimation.id },
                    include: {
                        vardhis: {
                            include: {
                                zone: true
                            }
                        },
                        items: {
                            include: {
                                item: {
                                    include: { unit: true, ay: true }
                                },
                                unit: true,
                                ay: true
                            }
                        }
                    }
                });
            });
        });

        if (result instanceof NextResponse) {
            return result;
        }

        // Create notification for Bill Tracking
        const session = await getServerSession(authOptions);
        await createNotification({
            action: 'Created',
            entity: 'Bill Tracking',
            entityId: result.id,
            entityName: result.estimation_no,
            userId: (session?.user as any)?.id,
            link: `/bill-generated`,
        });

        return NextResponse.json(
            successResponse('Bill Tracking created successfully', result),
            { status: 201 }
        );
    } catch (error: any) {
        console.error('Error creating Bill Tracking:', error);
        const errorMessage = error.message || 'Failed to create Bill Tracking';
        return NextResponse.json(
            errorResponse(errorMessage),
            { status: error.message?.includes('COMPANY_CONTEXT_MISSING') ? 401 : 500 }
        );
    }
}
