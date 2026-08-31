import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';
import { createNotification } from '@/lib/notification-service';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;
        const companyId = (session?.user as any)?.company_id;

        if (!hasPermission(role, 'AY_MASTER', 'READ')) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search') || '';
        const sortField = searchParams.get('sortField') || 'ay_no';
        const sortOrder = searchParams.get('sortOrder') || 'asc';

        const skip = (page - 1) * limit;

        const where: any = {};

        if (role !== 'SuperAdmin' && companyId) {
            where.company_id = companyId;
        }

        if (search) {
            where.ay_no = { contains: search, mode: 'insensitive' as const };
        }

        const [data, total] = await Promise.all([
            prisma.aYMaster.findMany({
                where,
                skip,
                take: limit,
                orderBy: {
                    [sortField]: sortOrder,
                },
                select: {
                    id: true,
                    ay_no: true,
                    createdAt: true,
                    updatedAt: true,
                    company_id: true,
                    company: {
                        select: {
                            company_name: true,
                        },
                    },
                    _count: {
                        select: {
                            itemManagements: true,
                        },
                    },
                },
            }),
            prisma.aYMaster.count({ where }),
        ]);

        return NextResponse.json({
            data,
            pagination: {
                page,
                pages: Math.ceil(total / limit),
                total,
                limit,
            },
        });
    } catch (error) {
        console.error('Error fetching AY masters:', error);
        return NextResponse.json(
            { error: 'Failed to fetch AY masters' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;
        const companyId = (session?.user as any)?.company_id;
        if (!hasPermission(role, 'AY_MASTER', 'CREATE')) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const body = await request.json();
        const { ay_no } = body;

        if (!ay_no) {
            return NextResponse.json(
                { error: 'AY name is required' }, // Changed error message
                { status: 400 }
            );
        }

        const trimmedAyNo = ay_no.trim(); // Added this line back as it was removed in the instruction but needed for existingAY check

        const finalCompanyId = role === 'SuperAdmin' ? body.company_id || companyId : companyId;

        if (!finalCompanyId) {
            return NextResponse.json(
                { error: 'Company ID is required' },
                { status: 400 }
            );
        }

        const existingAY = await prisma.aYMaster.findFirst({
            where: {
                company_id: finalCompanyId,
                ay_no: {
                    equals: trimmedAyNo,
                    mode: 'insensitive',
                },
            },
        });

        if (existingAY) {
            return NextResponse.json(
                { error: 'AY number already exists for this company' },
                { status: 409 }
            );
        }

        const ayMaster = await prisma.aYMaster.create({
            data: {
                ay_no: trimmedAyNo,
                company_id: finalCompanyId,
            },
            select: {
                id: true,
                ay_no: true,
                company_id: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        await createNotification({
            action: 'Created',
            entity: 'Item Number',
            entityId: ayMaster.id,
            entityName: ayMaster.ay_no,
            userId: (session?.user as any)?.id,
            link: `/maintenance-sor`,
        });

        return NextResponse.json(ayMaster, { status: 201 });

    } catch (error) {
        console.error('Error creating AY master:', error);
        return NextResponse.json(
            { error: 'Failed to create AY master' },
            { status: 500 }
        );
    }
}
