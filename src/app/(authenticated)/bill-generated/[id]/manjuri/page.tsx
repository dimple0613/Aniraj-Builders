import { getServerSession, authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withCompany } from "@/lib/company-server";
import { notFound } from "next/navigation";
import { ManjuriPrintView } from "@/components/bill-generated";

interface Props {
    params: Promise<{ id: string }>;
}

export default async function ManjuriPage({ params }: Props) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        return <div>Please sign in to view this page.</div>;
    }

    const { id } = await params;

    const estimation = await withCompany(async (companyContext) => {
        const company_id = companyContext?.company_id;

        const result = await prisma.vardhiEstimation.findFirst({
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
                            },
                        },
                    },
                },
                items: {
                    include: {
                        item: {
                            select: {
                                id: true,
                                item_name: true,
                            },
                        },
                        unit: {
                            select: {
                                id: true,
                                unit_name: true,
                            },
                        },
                        ay: {
                            select: {
                                id: true,
                                ay_no: true,
                            },
                        },
                    },
                    orderBy: { created_at: "asc" },
                },
            },
        });

        if (!result) return null;

        // Convert Prisma Decimal → plain object
        const safeResult = JSON.parse(JSON.stringify(result));

        return safeResult;
    });

    if (!estimation) {
        notFound();
    }

    return <ManjuriPrintView estimation={estimation} />;
}