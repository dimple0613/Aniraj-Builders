import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';
import { createNotification } from '@/lib/notification-service';
import { logCreateActivity } from '@/lib/activityLogger';

export async function GET(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;
        const companyId = (session?.user as any)?.company_id;

        if (!hasPermission(role, 'UNIT', 'READ')) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search') || '';
        const sortField = searchParams.get('sortField') || 'id';
        const sortOrder = searchParams.get('sortOrder') || 'asc';

        const skip = (page - 1) * limit;

        const where: any = {};

        if (search) {
            where.unit_name = { contains: search, mode: 'insensitive' as const };
        }

        const [units, total] = await Promise.all([
            prisma.unit.findMany({
                where,
                skip,
                take: limit,
                orderBy: { [sortField]: sortOrder },
                select: {
                    id: true,
                    unit_name: true,
                    company_id: true,
                    createdAt: true,
                    updatedAt: true,
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
            prisma.unit.count({ where }),
        ]);

        return NextResponse.json({
            data: units,
            pagination: {
                page,
                pages: Math.ceil(total / limit),
                total,
                limit,
            },
        });
    } catch (error) {
        console.error('Error fetching units:', error);
        return NextResponse.json(
            { error: 'Failed to fetch units' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;
        const companyId = (session?.user as any)?.company_id;

        if (!hasPermission(role, 'UNIT', 'CREATE')) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const body = await request.json();
        const { unit_name } = body;

        if (!unit_name || !unit_name.toString().trim()) {
            return NextResponse.json(
                { error: 'Unit name is required' },
                { status: 400 }
            );
        }

        const trimmedName = unit_name.toString().trim();
        const finalCompanyId = role === 'SuperAdmin' ? body.company_id || companyId : companyId;

        if (!finalCompanyId) {
            return NextResponse.json(
                { error: 'Company ID is required' },
                { status: 400 }
            );
        }

        const existingUnit = await prisma.unit.findFirst({
            where: {
                unit_name: {
                    equals: trimmedName,
                    mode: 'insensitive',
                },
            },
        });

        if (existingUnit) {
            return NextResponse.json(
                { error: 'Unit with this name already exists' },
                { status: 409 }
            );
        }

        const unit = await prisma.unit.create({
            data: {
                unit_name: trimmedName,
                company_id: finalCompanyId,
            },
            select: {
                id: true,
                unit_name: true,
                company_id: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        await createNotification({
            action: 'Created',
            entity: 'Unit',
            entityId: unit.id,
            entityName: unit.unit_name,
            userId: (session?.user as any)?.id,
            link: `/maintenance-sor`,
        });
        await logCreateActivity({
            companyId: finalCompanyId,
            userId: (session?.user as any)?.id,
            entityType: 'unit',
            entityId: unit.id,
            entityName: unit.unit_name,
        });

        return NextResponse.json(unit, { status: 201 });
    } catch (error) {
        console.error('Error creating unit:', error);
        return NextResponse.json(
            { error: 'Failed to create unit' },
            { status: 500 }
        );
    }
}
