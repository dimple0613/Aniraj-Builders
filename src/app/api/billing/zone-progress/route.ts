import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { calculateSizeFromString } from '@/lib/utils/sizeFormatter';

export async function GET(request: NextRequest) {
    try {

        const { searchParams } = new URL(request.url);

        const monthParam = searchParams.get("month");
        const yearParam = searchParams.get("year");
        const zoneId = searchParams.get("zone") || "";
        const search = searchParams.get("search") || "";

        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");

        const months = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ];

        const result = await withCompany(async (company: any) => {

            const companyId = company?.company_id;

            const now = new Date();
            const currentYear = yearParam ? Number(yearParam) : now.getFullYear();
            const currentMonthIndex = monthParam ? months.indexOf(monthParam) : now.getMonth();

            const startDate = new Date(currentYear, currentMonthIndex, 1);
            const endDate = new Date(currentYear, currentMonthIndex + 1, 1);

            const zoneWhere: any = {
                // company_id: companyId
            };

            if (zoneId) {
                zoneWhere.id = zoneId;
            }

            if (search) {
                zoneWhere.name = {
                    contains: search,
                    mode: "insensitive"
                };
            }

            const [zones, total] = await Promise.all([
                prisma.zoneMaster.findMany({
                    where: zoneWhere,
                    orderBy: { file_no: "asc" },
                    skip: (page - 1) * limit,
                    take: limit
                }),
                prisma.zoneMaster.count({ where: zoneWhere })
            ]);

            const zoneIds = zones.map(z => z.id);

            const estimations = await prisma.vardhiEstimation.findMany({
                where: {
                    company_id: companyId,
                    created_at: {
                        gte: startDate,
                        lt: endDate
                    },
                    vardhis: {
                        some: {
                            zone_id: { in: zoneIds }
                        }
                    }
                },

                include: {
                    vardhis: {
                        select: {
                            id: true,
                            created_at: true,
                            work_type: true,
                            zone_id: true,
                            vardhiItems: {
                                select: {
                                    size: true,
                                    item: {
                                        select: {
                                            workTypePrices: {
                                                include: {
                                                    workType: {
                                                        select: { id: true, name: true }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            const zoneMap: any = {};

            zones.forEach(zone => {
                zoneMap[zone.id] = {
                    zoneId: zone.id,
                    zoneName: zone.name,
                    fileNo: zone.file_no,
                    vardhiCount: 0,
                    estimationCount: 0,
                    vardhiAmount: 0,
                    estimationAmount: 0
                }
            });

            estimations.forEach((estimation: any) => {

                estimation.vardhis.forEach((vardhi: any) => {

                    const zone = zoneMap[vardhi.zone_id];
                    if (!zone) return;

                    zone.vardhiCount++;
                    zone.estimationCount++;

                    let vardhiTotal = 0;

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

                        vardhiTotal += qty * rate;

                    });

                    zone.vardhiAmount += vardhiTotal;

                    zone.estimationAmount += Number(estimation.total_amount || 0);

                });

            });

            const data = Object.values(zoneMap).map((z: any) => ({

                ...z,

                difference: z.estimationAmount - z.vardhiAmount,

                progress: z.vardhiAmount
                    ? Math.round((z.estimationAmount / z.vardhiAmount) * 100)
                    : 0

            }));

            return { data, total };

        });

        if (result instanceof NextResponse) {
            return result;
        }

        return NextResponse.json({
            data: result.data,
            pagination: {
                page,
                limit,
                total: result.total,
                pages: Math.ceil(result.total / limit)
            }
        });

    }
    catch (error) {

        console.error("Error fetching zone report:", error);

        return NextResponse.json(
            { error: "Failed to fetch zone report" },
            { status: 500 }
        );

    }
}