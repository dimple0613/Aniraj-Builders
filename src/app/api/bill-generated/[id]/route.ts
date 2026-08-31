import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { createNotification } from '@/lib/notification-service';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const estimation = await withCompany(async (companyId) => {
            const company_id = companyId?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const estimation = await prisma.vardhiEstimation.findFirst({
                where: {
                    id,
                    company_id,
                },
                include: {
                    vardhis: {
                        select: {
                            id: true,
                            vardhi_number: true,
                            location: true,
                            work_type: true,
                            date: true,
                            vardhi_start_date: true,
                            vardhi_end_date: true,
                            zone: {
                                select: {
                                    id: true,
                                    name: true,
                                    file_no: true,
                                }
                            },
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
                            }
                        }
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
                            ay: true
                        },
                        orderBy: { created_at: 'asc' }
                    }
                },
            });

            if (!estimation) {
                return NextResponse.json(errorResponse('Estimation not found'), { status: 404 });
            }

            return estimation;
        });

        if (estimation instanceof NextResponse) {
            return estimation;
        }

        return NextResponse.json(
            successResponse('Estimation fetched successfully', estimation)
        );
    } catch (error: any) {
        console.error('Error fetching estimation:', error);
        return NextResponse.json(
            errorResponse(error.message || 'Failed to fetch estimation'),
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { contractor, work_name, items, status, file_no, zone_no, month_year, vardhi_ids } = body;

        if (!contractor?.trim()) {
            return NextResponse.json(
                errorResponse('Contractor name is required'),
                { status: 400 }
            );
        }
        if (!work_name?.trim()) {
            return NextResponse.json(
                errorResponse('Work name is required'),
                { status: 400 }
            );
        }
        if (!items || items.length === 0) {
            return NextResponse.json(
                errorResponse('At least one item is required'),
                { status: 400 }
            );
        }

        const result = await withCompany(async (companyId) => {
            const company_id = companyId?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existing = await prisma.vardhiEstimation.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(errorResponse('Estimation not found'), { status: 404 });
            }

            if (existing.status === 'APPROVED') {
                return NextResponse.json(
                    errorResponse('Approved estimations cannot be edited'),
                    { status: 400 }
                );
            }

            const updatedEstimation = await prisma.$transaction(async (tx) => {
                const totalAmount = items.reduce((sum: number, item: any) =>
                    sum + (parseFloat(item.rate) || 0) * (parseFloat(item.quantity) || 0), 0
                );

                await tx.vardhiEstimation.update({
                    where: { id },
                    data: {
                        contractor: contractor.trim(),
                        work_name: work_name.trim(),
                        file_no: file_no || null,
                        zone_no: zone_no || null,
                        month_year: month_year || null,
                        status: status || existing.status,
                        total_amount: totalAmount,
                        ...(vardhi_ids ? {
                            vardhis: {
                                set: vardhi_ids.map((vId: string) => ({ id: vId }))
                            }
                        } : {})
                    }
                });

                await tx.vardhiEstimationItem.deleteMany({ where: { estimation_id: id } });

                if (items && items.length > 0) {
                    await tx.vardhiEstimationItem.createMany({
                        data: items.map((item: any) => ({
                            company_id,
                            estimation_id: id,
                            item_id: item.item_id || null,
                            custom_name: item.custom_name || null,
                            size: item.size || null,
                            rate: parseFloat(item.rate) || 0,
                            unit_id: item.unit_id || null,
                            ay_id: item.ay_id || null,
                            quantity: parseFloat(item.quantity) || 0,
                            amount: parseFloat(item.amount) || 0,
                        }))
                    });
                }

                return tx.vardhiEstimation.findUnique({
                    where: { id },
                    include: {
                        vardhis: { include: { zone: true }, orderBy: { created_at: 'asc' } },
                        items: {
                            include: {
                                item: { include: { unit: true, ay: true } },
                                unit: true,
                                ay: true
                            }
                        }
                    }
                });
            });

            // Create notification for Bill Tracking
            const session = await getServerSession(authOptions);
            await createNotification({
                action: 'Updated',
                entity: 'Bill Tracking',
                entityId: id,
                entityName: existing.estimation_no,
                userId: (session?.user as any)?.id,
                link: `/bill-generated/${id}`,
            });

            return updatedEstimation;
        });
 
        if (result instanceof NextResponse) {
            return result;
        }
 
        return NextResponse.json(
            successResponse('Estimation updated successfully', result)
        );
    } catch (error) {
        console.error('Error updating estimation:', error);
        return NextResponse.json(
            errorResponse('Failed to update estimation'),
            { status: 500 }
        );
    }
}


export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        const result = await withCompany(async (companyId) => {
            const company_id = companyId?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existing = await prisma.vardhiEstimation.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(errorResponse('Estimation not found'), { status: 404 });
            }

            if (existing.status !== 'DRAFT') {
                return NextResponse.json(
                    errorResponse('Only DRAFT estimations can be deleted'),
                    { status: 400 }
                );
            }

            // Delete invoices and estimation in a single transaction
            await prisma.$transaction(async (tx) => {
                await tx.vardhiInvoice.deleteMany({
                    where: { estimation_id: id },
                });

                await tx.vardhiEstimation.delete({
                    where: { id },
                });
            });

            // Create notification for Bill Tracking
            const session = await getServerSession(authOptions);
            await createNotification({
                action: 'Deleted',
                entity: 'Bill Tracking',
                entityId: id,
                entityName: existing.estimation_no,
                userId: (session?.user as any)?.id,
                link: `/bill-generated`,
            });

            return successResponse('Estimation and related invoices deleted successfully');
        });
 
        if (result instanceof NextResponse) {
            return result;
        }
 
        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error deleting estimation:', error);
        return NextResponse.json(
            errorResponse(error.message || 'Failed to delete estimation'),
            { status: 500 }
        );
    }
}