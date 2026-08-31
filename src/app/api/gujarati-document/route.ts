import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const estimationId = searchParams.get('estimationId');

        if (!estimationId) {
            return NextResponse.json(
                errorResponse('Estimation ID is required'),
                { status: 400 }
            );
        }

        const results = await withCompany(async (companyId) => {
            const tid = companyId?.company_id;
            const document = await prisma.vardhiWaterWorksDepartment.findUnique({
                where: {
                    estimation_id: estimationId,
                    company_id: tid,
                },
            });

            let approved_by_ranges: any[] = [];
            if (tid) {
                const company = await prisma.company.findUnique({
                    where: { id: tid },
                    select: { approved_by_ranges: true },
                });
                approved_by_ranges = (company?.approved_by_ranges as any[]) || [];
            }

            return { document, approved_by_ranges };
        });

        if (results instanceof NextResponse) {
            return results;
        }

        return NextResponse.json({
            success: true,
            message: 'Gujarati document fetched successfully',
            data: results.document,
            approved_by_ranges: results.approved_by_ranges || [],
        });
    } catch (error: any) {
        console.error('Error fetching Gujarati document', error);
        const errorMessage = error.message || 'Failed to fetch Gujarati document';
        return NextResponse.json(
            errorResponse(errorMessage),
            { status: error.message?.includes('COMPANY_CONTEXT_MISSING') ? 401 : 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            estimationId,
            work_summary,
            work_requirement,
            plot_ownership,
            work_type,
            is_duplicate_work,
            estimated_cost_details,
            approving_authority,
            cost_head,
            work_method,
            work_deadline,
            is_work_completed_on_time,
            registration_class,
            emd_details,
            bid_validity,
            liability_period,
            gfr_pwd_compliance,
            is_single_tender,
            single_tender_efforts,
            negotiation_feedback,
            work_agency,
            hod_certificate_no_duplicate,
        } = body;

        if (!estimationId) {
            return NextResponse.json(
                errorResponse('Estimation ID is required'),
                { status: 400 }
            );
        }

        const result = await withCompany(async (companyId) => {
            const tid = companyId?.company_id;
            if (!tid) {
                throw new Error('COMPANY_CONTEXT_MISSING');
            }

            const existing = await prisma.vardhiWaterWorksDepartment.findUnique({
                where: {
                    estimation_id: estimationId,
                },
            });

            if (existing) {
                return await prisma.vardhiWaterWorksDepartment.update({
                    where: { id: existing.id },
                    data: {
                        work_summary: work_summary,
                        work_requirement: work_requirement,
                        plot_ownership: plot_ownership,
                        work_type: work_type,
                        is_duplicate_work: is_duplicate_work,
                        estimated_cost_details: estimated_cost_details,
                        approving_authority: approving_authority,
                        cost_head: cost_head,
                        work_method: work_method,
                        work_deadline: work_deadline,
                        is_work_completed_on_time: is_work_completed_on_time,
                        registration_class: registration_class,
                        emd_details: emd_details,
                        bid_validity: bid_validity,
                        liability_period: liability_period,
                        gfr_pwd_compliance: gfr_pwd_compliance,
                        is_single_tender: is_single_tender,
                        single_tender_efforts: single_tender_efforts,
                        negotiation_feedback: negotiation_feedback,
                        work_agency: work_agency,
                        hod_certificate_no_duplicate: hod_certificate_no_duplicate,
                    },
                });
            } else {
                return await prisma.vardhiWaterWorksDepartment.create({
                    data: {
                        company_id: tid,
                        estimation_id: estimationId,
                        work_summary: work_summary,
                        work_requirement: work_requirement,
                        plot_ownership: plot_ownership,
                        work_type: work_type,
                        is_duplicate_work: is_duplicate_work,
                        estimated_cost_details: estimated_cost_details,
                        approving_authority: approving_authority,
                        cost_head: cost_head,
                        work_method: work_method,
                        work_deadline: work_deadline,
                        is_work_completed_on_time: is_work_completed_on_time,
                        registration_class: registration_class,
                        emd_details: emd_details,
                        bid_validity: bid_validity,
                        liability_period: liability_period,
                        gfr_pwd_compliance: gfr_pwd_compliance,
                        is_single_tender: is_single_tender,
                        single_tender_efforts: single_tender_efforts,
                        negotiation_feedback: negotiation_feedback,
                        work_agency: work_agency,
                        hod_certificate_no_duplicate: hod_certificate_no_duplicate,
                    },
                });
            }
        });

        return NextResponse.json(
            successResponse('Water works department document saved successfully', result)
        );
    } catch (error: any) {
        console.error('Error saving Gujarati document:', error);
        const errorMessage = error.message || 'Failed to save Gujarati document';
        return NextResponse.json(
            errorResponse(errorMessage),
            { status: error.message?.includes('COMPANY_CONTEXT_MISSING') ? 401 : 500 }
        );
    }
}
