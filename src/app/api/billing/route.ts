import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCompany } from "@/lib/company-server";
import { errorResponse, successResponse } from "@/lib/api-response";
import { calculateSizeFromString } from "@/lib/utils/sizeFormatter";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        const search = searchParams.get("search") || "";
        const status = searchParams.get("status") || "";
        const monthParam = searchParams.get("month");
        const yearParam = searchParams.get("year");


        const zone = searchParams.get("zone") || "";

        const sortField = searchParams.get("sortField") || "created_at";
        const sortOrder = searchParams.get("sortOrder") || "desc";

        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        const results = await withCompany(async (companyId: any) => {
            const where: any = {
                company_id: companyId?.company_id,
            };

            if (status) {
                where.status = status;
            }

            if (search) {
                where.OR = [
                    { estimation_no: { contains: search, mode: "insensitive" } },
                    { contractor: { contains: search, mode: "insensitive" } },
                    { work_name: { contains: search, mode: "insensitive" } },
                ];
            }

            const now = new Date();

            const currentYear = yearParam ? Number(yearParam) : now.getFullYear();
            const currentMonthIndex = monthParam ? months.indexOf(monthParam) : now.getMonth();



            if (monthParam && months.includes(monthParam)) {
                const monthIndex = months.indexOf(monthParam);

                where.created_at = {
                    gte: new Date(currentYear, monthIndex, 1),
                    lt: new Date(currentYear, monthIndex + 1, 1),
                };
            }

            if (yearParam && !monthParam) {
                where.created_at = {
                    gte: new Date(currentYear, 0, 1),
                    lt: new Date(currentYear + 1, 0, 1),
                };
            }
            // Zone filter
            if (zone) {
                where.vardhis = {
                    some: {
                        zone_id: zone,
                    },
                };
            }

            const [data, total] = await Promise.all([
                prisma.vardhiEstimation.findMany({
                    where,
                    include: {
                        vardhis: {
                            select: {
                                id: true,
                                created_at: true,
                                vardhi_number: true,
                                work_type: true,
                                zone_id: true,
                                zone: {
                                    select: {
                                        name: true,
                                        file_no: true,
                                    },
                                },
                                vardhiItems: {
                                    select: {
                                        item: {
                                            select: {
                                                workTypePrices: {
                                                    include: {
                                                        workType: {
                                                            select: { id: true, name: true },
                                                        },
                                                    },
                                                },
                                            },
                                        },
                                        size: true,
                                    },
                                },
                            },
                        },
                        _count: {
                            select: { items: true },
                        },
                    },
                    orderBy: {
                        [sortField]: sortOrder,
                    },
                    skip: (page - 1) * limit,
                    take: limit,
                }),

                prisma.vardhiEstimation.count({ where }),
            ]);

            const formattedData = data.map((estimation: any) => {
                let oldExpense = 0;

                estimation.vardhis.forEach((vardhi: any) => {
                    const createdAtDate = new Date(estimation.created_at);
                    const work_type = vardhi.work_type;

                    vardhi.vardhiItems.forEach((vi: any) => {
                        let rate = 0;
                        const workTypePrices = vi.item?.workTypePrices || [];

                        if (workTypePrices.length) {
                            const sameWorkTypePrices = workTypePrices
                                .filter((wtp: any) => wtp.workType?.id === work_type)
                                .sort(
                                    (a: any, b: any) =>
                                        new Date(a.start_date).getTime() -
                                        new Date(b.start_date).getTime()
                                );

                            let activePrices = sameWorkTypePrices.find((wtp: any) => {
                                const startDate = new Date(wtp.start_date).getTime();
                                const expiryDate = wtp.expiry_date
                                    ? new Date(wtp.expiry_date).getTime()
                                    : Infinity;

                                return (
                                    startDate <= createdAtDate.getTime() &&
                                    createdAtDate.getTime() <= expiryDate
                                );
                            });

                            if (!activePrices) {
                                activePrices = sameWorkTypePrices.find(
                                    (wtp: any) =>
                                        new Date(wtp.start_date).getTime() >
                                        createdAtDate.getTime()
                                );
                            }

                            rate = activePrices ? Number(activePrices.price) : 0;
                        }

                        let qty = 0;

                        qty = calculateSizeFromString(vi.size);

                        oldExpense += qty * rate;
                    });
                });

                const total_amount = Number(estimation.total_amount || 0);
                const difference = total_amount - oldExpense;

                const monthLabel =
                    new Date(estimation.created_at).toLocaleString("en-US", {
                        month: "long",
                    }) + " " +
                    new Date(estimation.created_at).getFullYear();

                return {
                    ...estimation,
                    month: monthLabel,
                    oldExpense,
                    difference,
                };
            });

            return {
                data: formattedData,
                total,
            };
        });

        if (results instanceof NextResponse) {
            return results;
        }

        return NextResponse.json(
            successResponse("Bill Tracking records fetched successfully", results.data, {
                page,
                limit,
                total: results.total,
                pages: Math.ceil(results.total / limit),
            })
        );
    } catch (error: any) {
        console.error("Error fetching Bill Tracking records:", error);

        const errorMessage = error.message || "Failed to fetch Bill Tracking records";

        return NextResponse.json(errorResponse(errorMessage), {
            status: error.message?.includes("COMPANY_CONTEXT_MISSING") ? 401 : 500,
        });
    }
}