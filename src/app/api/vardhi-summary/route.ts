import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse } from '@/lib/api-response';
import { Prisma } from '@prisma/client';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createNotification } from '@/lib/notification-service';
import { getFinancialYearShort } from '@/lib/financial-year';
import { calculateNetPayable } from '../bill-generated/calculate-net-payable';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const isSuperAdmin = session?.user?.role === "SuperAdmin";
        const userRole = (session?.user as any)?.role;
        const userZoneId = (session?.user as any)?.zone_id;

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const includeBilled = searchParams.get('include_billed') === 'true';

        const response = await withCompany(async (company) => {
            if (!company?.company_id) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 }
                );
            }

            const isInBillingFilter = includeBilled ? undefined : false;

            const zones = await prisma.zoneMaster.findMany({
                where: {
                    // Zone users can only see their assigned zone
                    ...(userRole === 'Zone' && userZoneId ? { id: userZoneId } : {}),
                },
                include: {
                    zoneApproval: {
                        where: { company_id: company.company_id },
                        select: { approved_vardhi_ids: true, updated_at: true },
                    },
                    vardhis: {
                         where: {
                             company_id: company.company_id,
                             ...(isInBillingFilter !== undefined ? { is_in_billing: isInBillingFilter } : {}),
                         },
orderBy: { created_at: 'asc' },
                         include: {
                             vardhiItems: {
                                 include: {
                                     item: {
                                         select: {
                                             id: true,
                                             item_name: true,
                                         },
                                     },
                                 },
                             },
                             additionalItems: true,
                             attachments: {
                                 select: {
                                     id: true,
                                     type: true,
                                     file_path: true,
                                     file_name: true,
                                     file_size: true,
                                     mime_type: true,
                                     created_at: true,
                                 },
                                 orderBy: { created_at: "desc" },
                             },
                         },
                     },
                },
            });



            const summaryData = zones
                .map(zone => {
                    const vardhis = zone.vardhis;
                    
                    const existingItemsTotal = vardhis.reduce((sum, v) => {
                        return sum.plus(v.existing_items_total || new Prisma.Decimal(0));
                    }, new Prisma.Decimal(0));

                    const additionalItemsTotal = vardhis.reduce((sum, v) => {
                        return sum.plus(v.additional_items_total || new Prisma.Decimal(0));
                    }, new Prisma.Decimal(0));

                    const grandTotal = vardhis.reduce((sum, v) => {
                        return sum.plus(v.grand_total || new Prisma.Decimal(0));
                    }, new Prisma.Decimal(0));

                    const differenceTotal = vardhis.reduce((sum, v) => {
                        return sum.plus(v.difference_total || new Prisma.Decimal(0));
                    }, new Prisma.Decimal(0));

                    // Calculate expenses_total and employees_total from vardhi records
                    const expensesTotal = vardhis.reduce((sum, v) => {
                        return sum.plus(v.expenses_total || new Prisma.Decimal(0));
                    }, new Prisma.Decimal(0));

                    const employeesTotal = vardhis.reduce((sum, v) => {
                        return sum.plus(v.employees_total || new Prisma.Decimal(0));
                    }, new Prisma.Decimal(0));

                     const startDate = vardhis.length > 0 ? vardhis.reduce((min, v) => {
                         const d = new Date(v.date);
                         return d < min ? d : min;
                     }, new Date(vardhis[0].date)) : null;
 
                     const endDate = vardhis.length > 0 ? vardhis.reduce((max, v) => {
                         const d = new Date(v.date);
                         return d > max ? d : max;
                     }, new Date(vardhis[0].date)) : null;
                     
                      const formatValue = (val: any) => {
                          if (val === null || val === undefined || val === '') return '-';
                          return val;
                      };

                    // Check zone approval status
                    const zoneApproval = (zone as any).zoneApproval?.[0];
                    let approvedVardhiIds: string[] = [];

                    if (zoneApproval) {
                        try {
                            approvedVardhiIds = JSON.parse(zoneApproval.approved_vardhi_ids);
                        } catch {
                            approvedVardhiIds = [];
                        }
                    }

                    const approvedSet = new Set(approvedVardhiIds);
                    const currentVardhiIds = vardhis.map(v => v.id);

                    // Zone is approved only when every current vardhi is part of the
                    // previously approved set. Vardhis that moved to Bill Tracking and
                    // came back remain approved and are never required to be approved again.
                    const isZoneApproved = currentVardhiIds.length > 0 &&
                        currentVardhiIds.every(id => approvedSet.has(id));

                      // Process attachments for each vardhi
                      const processedVardhis = vardhis.map(v => {
                          type GroupedAttachments = Record<string, Array<{
                              id: string;
                              file_path: string;
                              file_name: string;
                              file_size: number | null;
                              mime_type: string | null;
                              created_at: Date;
                          }>>;

                          const groupedAttachments = v.attachments.reduce((acc, att) => {
                              if (!acc[att.type]) {
                                  acc[att.type] = [];
                              }
                              acc[att.type].push({
                                  id: att.id,
                                  file_path: att.file_path,
                                  file_name: att.file_name,
                                  file_size: att.file_size,
                                  mime_type: att.mime_type,
                                  created_at: att.created_at,
                              });
                              return acc;
                          }, {} as GroupedAttachments);
                         
                         return {
                             id: v.id,
                             vardhi_number: formatValue(v.vardhi_number),
                             zone_id: v.zone_id,
                             zone_name: zone.name,
                             location: formatValue(v.location),
                             date: v.date,
                             vardhi_start_date: v.vardhi_start_date,
                             vardhi_end_date: v.vardhi_end_date,
                             work_type: formatValue(v.work_type),
                             existing_items_total: v.existing_items_total?.toString() || '-',
                             additional_items_total: v.additional_items_total?.toString() || '-',
                             ...(isSuperAdmin && {
                                 expenses_total: v.expenses_total?.toString() || '0',
                                 employees_total: v.employees_total?.toString() || '0',
                             }),
                             grand_total: v.grand_total?.toString() || '-',
                             difference_total: v.difference_total?.toString() || '-',
                             site_photography: v.site_photography,
                             site_clear_photo: v.site_clear_photo,
                             attachments: v.attachments.map(att => ({
                                 id: att.id,
                                 type: att.type,
                                 file_path: att.file_path,
                                 file_name: att.file_name,
                                 file_size: att.file_size,
                                 mime_type: att.mime_type,
                                 created_at: att.created_at,
                             })),
                             groupedAttachments,
                             is_approved: approvedSet.has(v.id),
                         };
                      });

                    return {
                        zone_id: zone.id,
                        zone_name: formatValue(zone.name),
                        zone_file_no: formatValue(zone.file_no),
                        vardhi_count: vardhis.length,
                        start_date: startDate,
                        end_date: endDate,
                        existing_items_total: existingItemsTotal.toString() === '0' ? '-' : existingItemsTotal.toString(),
                        additional_items_total: additionalItemsTotal.toString() === '0' ? '-' : additionalItemsTotal.toString(),
                        ...(isSuperAdmin && {
                            expenses_total: expensesTotal.toString() === '0' ? '-' : expensesTotal.toString(),
                            employees_total: employeesTotal.toString() === '0' ? '-' : employeesTotal.toString(),
                        }),
                        difference_total: differenceTotal.toString() === '0' ? '-' : differenceTotal.toString(),
                        grand_total: grandTotal.toString() === '0' ? '-' : grandTotal.toString(),
                        is_zone_approved: isZoneApproved,
                        approved_vardhi_ids: approvedVardhiIds,
                         vardhis: processedVardhis,
                    };
                });

            const total = summaryData.length;
            const paginatedData = summaryData.slice((page - 1) * limit, page * limit);

            return NextResponse.json(
                successResponse('Vardhi summary fetched successfully', paginatedData, {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit) || 1,
                })
            );
        });

        return response;

    } catch (error) {
        console.error('Error fetching vardhi summary:', error);
        return NextResponse.json(
            errorResponse('Failed to fetch vardhi summary'),
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const userRole = (session?.user as any)?.role;

        // Zone users cannot generate bills
        if (userRole === 'Zone') {
            return NextResponse.json(
                { success: false, message: "Forbidden: Zone users cannot generate bills" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { zone_id, vardhi_ids, file_no, month_year } = body;

        if (!zone_id) {
            return NextResponse.json(
                { success: false, message: "Zone ID is required" },
                { status: 400 }
            );
        }

        const response = await withCompany(async (company) => {

            
            if (!company?.company_id) {
                return NextResponse.json(
                    { success: false, message: "Unauthorized" },
                    { status: 401 }
                );
            }

            const result = await prisma.$transaction(async (tx) => {
                // Check zone approval
                const zoneApproval = await tx.zoneApproval.findUnique({
                    where: {
                        company_id_zone_id: {
                            company_id: company.company_id,
                            zone_id: zone_id,
                        }
                    }
                });

                if (!zoneApproval) {
                    return { error: "Zone has not been approved by Zone Officer yet", status: 400 };
                }

                // Verify approved vardhi IDs cover the requested vardhi IDs
                let approvedIds: string[] = [];
                try {
                    approvedIds = JSON.parse(zoneApproval.approved_vardhi_ids);
                } catch {
                    return { error: "Invalid zone approval data", status: 400 };
                }

                const requestedIds = vardhi_ids && vardhi_ids.length > 0 ? vardhi_ids : [];
                const approvedSet = new Set(approvedIds);
                const unapprovedIds = requestedIds.filter((id: string) => !approvedSet.has(id));

                if (unapprovedIds.length > 0) {
                    return { error: "Some vardhis are not approved by Zone Officer", status: 400 };
                }

                const where = {
                    company_id: company.company_id,
                    zone_id,
                    is_in_billing: false,
                    ...(requestedIds.length > 0 ? { id: { in: requestedIds } } : {}),
                };

                const vardhisToUpdate = await tx.vardhi.findMany({
                    where,
                    include: {
                        zone: { select: { name: true, file_no: true } }
                    }
                });

                if (vardhisToUpdate.length === 0) {
                    return { error: "No approved vardhi records found to mark for billing", status: 400 };
                }

                const companyDetails = await tx.company.findUnique({
                    where: { id: company.company_id },
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

                const totalAmount = vardhisToUpdate.reduce(
                    (sum, v) => sum.plus(v.grand_total || new Prisma.Decimal(0)),
                    new Prisma.Decimal(0)
                );

                const fy = getFinancialYearShort(new Date());
                const fyPrefix = `TI${fy}//`;

                const [existingEstimations, existingInvoices] = await Promise.all([
                    tx.vardhiEstimation.findMany({
                        where: { company_id: company.company_id, estimation_no: { startsWith: fyPrefix } },
                        select: { estimation_no: true },
                    }),
                    tx.vardhiInvoice.findMany({
                        where: { invoice_no: { startsWith: fyPrefix } },
                        select: { invoice_no: true },
                    }),
                ]);

                let nextNumber = 1;
                const allNos = [
                    ...existingEstimations.map(e => e.estimation_no),
                    ...existingInvoices.map(i => i.invoice_no),
                ].filter(Boolean);
                for (const no of allNos) {
                    const match = no?.match(/\/\/(\d+)$/);
                    if (match) {
                        const num = parseInt(match[1]);
                        if (num >= nextNumber) nextNumber = num + 1;
                    }
                }
                const estimation_no = `TI${fy}//${nextNumber.toString().padStart(2, '0')}`;

                const firstVardhi = vardhisToUpdate[0];
                const zoneName = firstVardhi.zone?.name || "";
                
                const minDate = vardhisToUpdate.reduce((min, v) => {
                    const d = new Date(v.vardhi_start_date);
                    return d < min ? d : min;
                }, new Date(vardhisToUpdate[0].vardhi_start_date));

                const maxDate = vardhisToUpdate.reduce((max, v) => {
                    const d = new Date(v.vardhi_end_date);
                    return d > max ? d : max;
                }, new Date(vardhisToUpdate[0].vardhi_end_date));

                const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
                const startMonth = `${MONTHS[minDate.getMonth()]}-${String(minDate.getFullYear()).slice(-2)}`;
                const endMonth = `${MONTHS[maxDate.getMonth()]}-${String(maxDate.getFullYear()).slice(-2)}`;
                const monthYearRange = startMonth === endMonth ? startMonth : `${startMonth}/${endMonth}`;

                const work_name = `${zoneName} એ માં વિવિધ જગ્યાએ પાણીની લાઇનના મરામત કામો (${monthYearRange})`;

                const contractor = companyDetails?.company_name || "Pending";
                const zone_no = zoneName;
                const generatedFileNo = file_no || firstVardhi.zone?.file_no?.toString() || "";
                const generatedMonthYear = month_year || monthYearRange;

                const estimation = await tx.vardhiEstimation.create({
                    data: {
                        company_id: company.company_id,
                        estimation_no,
                        contractor: contractor.trim(),
                        work_name: work_name,
                        file_no: generatedFileNo || null,
                        zone_no: zone_no || null,
                        month_year: generatedMonthYear || null,
                        status: 'DRAFT',
                        total_amount: totalAmount,
                        vardhis: {
                            connect: vardhisToUpdate.map(v => ({ id: v.id }))
                        }
                    },
                    include: {
                        vardhis: {
                            select: {
                                id: true,
                                vardhi_number: true,
                                zone: { select: { name: true, file_no: true } }
                            }
                        }
                    }
                });

                const invoiceNetPayable = calculateNetPayable({
                    amount: Number(totalAmount),
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

                const subtotal = Number(totalAmount);
                const cgstPerc = companyDetails?.cgst_rate || 0;
                const sgstPerc = companyDetails?.sgst_rate || 0;
                const totalGstRate = cgstPerc + sgstPerc;
                const taxtotal = totalGstRate > 0 ? subtotal - (100 / (100 + totalGstRate)) * subtotal : 0;
                const cgstAmt = Number(taxtotal.toFixed(2)) / 2;
                const sgstAmt = Number(taxtotal.toFixed(2)) / 2;
                const grossTotal = Number((subtotal - cgstAmt - sgstAmt).toFixed(2));
                const itAmt = Number(((grossTotal * (companyDetails?.income_tax_rate || 0)) / 100).toFixed(2));
                const labourCessAmt = Number(((grossTotal * (companyDetails?.labour_cess_rate || 0)) / 100).toFixed(2));
                const cgstTdsAmt = Number(((grossTotal * (companyDetails?.cgst_tds_rate || 0)) / 100).toFixed(2));
                const sgstTdsAmt = Number(((grossTotal * (companyDetails?.sgst_tds_rate || 0)) / 100).toFixed(2));

                await tx.vardhiInvoice.create({
                    data: {
                        company_id: company.company_id,
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
                        description: work_name || '',
                        hsn_sac: companyDetails?.hsn_sac || null,
                        quantity: new Prisma.Decimal(1),
                        amount: totalAmount,
                        total_amount: new Prisma.Decimal(invoiceNetPayable),
                        cgst_percent: companyDetails?.cgst_rate || null,
                        cgst_amount: new Prisma.Decimal(cgstAmt),
                        sgst_percent: companyDetails?.sgst_rate || null,
                        sgst_amount: new Prisma.Decimal(sgstAmt),
                        it_percent: companyDetails?.income_tax_rate || null,
                        it_amount: new Prisma.Decimal(itAmt),
                        labour_cess_percent: companyDetails?.labour_cess_rate || null,
                        labour_cess_amount: new Prisma.Decimal(labourCessAmt),
                        cgst_tds_percent: companyDetails?.cgst_tds_rate || null,
                        cgst_tds_amount: new Prisma.Decimal(cgstTdsAmt),
                        sgst_tds_percent: companyDetails?.sgst_tds_rate || null,
                        sgst_tds_amount: new Prisma.Decimal(sgstTdsAmt),
                        add_deposit_percent: companyDetails?.additional_deposit || null,
                        add_deposit_amount: new Prisma.Decimal(0),
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

                // Copy vardhi items to VardhiEstimationItem
                for (const vardhi of vardhisToUpdate) {
                    const vardhiItems = await tx.vardhiItem.findMany({
                        where: { vardhi_id: vardhi.id },
                        include: {
                            item: true
                        }
                    });

                    if (vardhiItems.length > 0) {
                        const estimationItems = vardhiItems.map(item => ({
                            company_id: company.company_id,
                            estimation_id: estimation.id,
                            item_id: item.item_id,
                            size: item.size,
                            rate: item.rate || new Prisma.Decimal(0),
                            unit_id: item.item?.unit_id || null,
                            ay_id: item.item?.ay_id || null,
                            quantity: item.qty || new Prisma.Decimal(0),
                            amount: item.amount || new Prisma.Decimal(0),
                        }));

                        await tx.vardhiEstimationItem.createMany({
                            data: estimationItems as any
                        });
                    }

                    // Copy additional items
                    const additionalItems = await tx.vardhiAdditionalItem.findMany({
                        where: { vardhi_id: vardhi.id }
                    });

                    if (additionalItems.length > 0) {
                        const additionalEstimationItems = additionalItems.map(item => ({
                            company_id: company.company_id,
                            estimation_id: estimation.id,
                            item_id: (item as any).item_id || null,
                            custom_name: item.item_name,
                            size: item.size,
                            rate: item.rate || new Prisma.Decimal(0),
                            unit_id: null,
                            quantity: item.qty || new Prisma.Decimal(0),
                            amount: item.amount || new Prisma.Decimal(0),
                        }));

                        await tx.vardhiEstimationItem.createMany({
                            data: additionalEstimationItems as any
                        });
                    }
                }

                await tx.vardhi.updateMany({
                    where,
                    data: {
                        is_in_billing: true,
                    },
                });

                return { 
                    success: true, 
                    data: { 
                        estimation,
                        vardhiCount: vardhisToUpdate.length
                    }
                };
            });

            if (result && 'error' in result) {
                return NextResponse.json(
                    { success: false, message: result.error },
                    { status: result.status }
                );
            }

            // Create notification for Bill Generated
            const session = await getServerSession(authOptions);
            await createNotification({
                action: 'Created',
                entity: 'Bill Generated',
                entityId: result.data.estimation.id,
                entityName: result.data.estimation.estimation_no,
                userId: (session?.user as any)?.id,
                link: `/bill-generated`,
            });

            return NextResponse.json(
                successResponse('Billing generated successfully', result.data)
            );
        });
 
        return response;
 
    } catch (error: any) {
        console.error('Error generating billing:', error);
        return NextResponse.json(
            errorResponse(error.message || 'Failed to generate billing'),
            { status: 500 }
        );
    }
}
