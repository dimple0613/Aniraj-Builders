import { getServerSession, authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withCompany } from "@/lib/company-server";
import { notFound } from "next/navigation";
import { EstimationPrintView } from "@/components/bill-generated";

interface Props {
    params: Promise<{ id: string }>;
}

export default async function EstimationPage({ params }: Props) {
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
                    orderBy: { created_at: "asc" },
                },
            },
        });

        if (result) {
            return {
                ...result,
                total_amount: Number(result.total_amount),
            };
        }

        return result;
    });

    if (!estimation) {
        notFound();
    }

    return <EstimationPrintView estimation={estimation as any} />;
}
