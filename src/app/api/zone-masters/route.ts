import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { createNotification } from '@/lib/notification-service';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search')?.trim() || '';
        const sortBy = searchParams.get('sortField') || 'file_no';
        const sortOrder = searchParams.get('sortOrder') || 'asc';
        
        const where: any = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { file_no: { contains: search } },
            ];
        }

        const [data, total] = await Promise.all([
            (prisma as any).zoneMaster.findMany({
                where,
                include: {
                    officers: {
                        where: { status: 'CURRENT' },
                        take: 1
                    }
                },
                orderBy: {
                    [sortBy]: sortOrder,
                },
                skip: (page - 1) * limit,
                take: limit,
            }),
            (prisma as any).zoneMaster.count({ where }),
        ]);

        const formattedData = data.map((zone: any) => ({
            ...zone,
            currentOfficer: zone.officers?.[0] || null,
            officers: undefined
        }));

        return NextResponse.json({
            data: formattedData,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Error fetching zone masters:', error);
        return NextResponse.json(
            { error: 'Failed to fetch zone masters' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { name, officers } = body;

        if (!name) {
            return NextResponse.json(
                { error: "Name is required" },
                { status: 400 }
            );
        }

        const zoneMaster = await withCompany(async (company: any) => {
            return await prisma.$transaction(async (tx: any) => {
                const zone = await tx.zoneMaster.create({
                    data: {
                        name,
                        company_id: company?.company_id,
                    },
                });

                if (officers && officers.length > 0) {
                    for (const officer of officers) {
                        if (officer.status === 'CURRENT') {
                            await tx.zoneOfficer.updateMany({
                                where: { zone_id: zone.id, status: 'CURRENT' },
                                data: { status: 'PAST' }
                            });
                        }
                        
                        await tx.zoneOfficer.create({
                            data: {
                                zone_id: zone.id,
                                officer_name: officer.officer_name,
                                contact_no: officer.contact_no,
                                status: officer.status
                            }
                        });
                    }
                }

                return zone;
            });
        });

        // Create notification for Zone Master
        const session = await getServerSession(authOptions);
        await createNotification({
            action: 'Created',
            entity: 'Zone Master',
            entityId: zoneMaster.id,
            entityName: zoneMaster.name,
            userId: (session?.user as any)?.id,
            link: `/zone-masters`,
        });

        return NextResponse.json(zoneMaster, { status: 201 });
 
    } catch (error) {
        console.error("Error creating zone master:", error);
        return NextResponse.json(
            { error: "Failed to create zone master" },
            { status: 500 }
        );
    }
}
