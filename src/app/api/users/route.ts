import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import bcrypt from 'bcryptjs';
import { createNotification } from '@/lib/notification-service';
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search')?.trim() || '';
        const sortField = searchParams.get('sortField') || 'createdAt';
        const sortOrder = searchParams.get('sortOrder') || 'desc';

        const validSortFields = ['name', 'email', 'role', 'createdAt'];
        const finalSortField = validSortFields.includes(sortField) ? sortField : 'createdAt';

        const where: any = {};

        if (search) {
            where.OR = [
                { name: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        const result = await withCompany(async (companyContext) => {
            where.company_id = companyContext?.company_id;

            const users = await prisma.user.findMany({
                where,
                orderBy: { [finalSortField]: sortOrder },
                skip: (page - 1) * limit,
                take: limit,
            });

            // Fetch zones separately for users that have zone_id
            const zoneIds = [...new Set(
                users
                    .filter((u: any) => u.zone_id)
                    .map((u: any) => u.zone_id)
            )] as string[];

            const zones = zoneIds.length > 0 ? await prisma.zoneMaster.findMany({
                where: { id: { in: zoneIds } },
                select: { id: true, name: true }
            }) : [];

            const zoneMap = new Map(zones.map((z: any) => [z.id, z.name]));

            const usersWithZone = users.map((user: any) => ({
                ...user,
                zone: user.zone_id ? { id: user.zone_id, name: zoneMap.get(user.zone_id) || null } : null
            }));

            const totalCount = await prisma.user.count({ where });

            return [usersWithZone, totalCount];
        });

        const [data, total] = result as any[];

        return NextResponse.json(
            successResponse('Users fetched successfully', data, {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            })
        );
    } catch (error) {
        console.error('Error fetching users:', error);
        return NextResponse.json(
            errorResponse('Failed to fetch users'),
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const userId = (session?.user as any)?.id;
        const body = await request.json();
        const { username, name, email, role, password, projectIds, profile_photo, zone_id, whatsapp_number } = body;

        if (!username || !name || !email || !role) {
            return NextResponse.json(
                errorResponse('Username, name, email, and role are required'),
                { status: 400 }
            );
        }

        if (role === 'Zone' && !zone_id) {
            return NextResponse.json(
                errorResponse('Zone is required for Zone role'),
                { status: 400 }
            );
        }

        const trimmedUsername = username.trim();
        const trimmedName = name.trim();
        const trimmedEmail = email.trim().toLowerCase();

        if (!trimmedUsername || !trimmedName || !trimmedEmail) {
            return NextResponse.json(
                errorResponse('Username, name, and email are required'),
                { status: 400 }
            );
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            return NextResponse.json(
                errorResponse('Invalid email format'),
                { status: 400 }
            );
        }

        const result = await withCompany(async (companyContext) => {
            let company_id = companyContext?.company_id;

            // For Zone role, derive company_id from the zone if context doesn't have it
            if (!company_id && role === 'Zone' && zone_id) {
                const zone = await prisma.zoneMaster.findUnique({
                    where: { id: zone_id },
                    select: { company_id: true },
                });
                if (zone?.company_id) {
                    company_id = zone.company_id;
                }
            }

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            // Check username uniqueness
            const existingUsername = await prisma.user.findFirst({
                where: { username: trimmedUsername },
            });

            if (existingUsername) {
                return NextResponse.json(
                    errorResponse('Username already exists'),
                    { status: 409 }
                );
            }

            const existingUser = await prisma.user.findFirst({
                where: { email: trimmedEmail },
            });

            if (existingUser) {
                return NextResponse.json(
                    errorResponse('Email already exists'),
                    { status: 409 }
                );
            }

            const hashedPassword = await bcrypt.hash(password || 'password123', 10);

            const user = await prisma.user.create({
                data: {
                    username: trimmedUsername,
                    name: trimmedName,
                    email: trimmedEmail,
                    role: role as any,
                    password: hashedPassword,
                    company_id,
                    zone_id: zone_id || null,
                    profile_photo: profile_photo || null,
                    whatsapp_number: whatsapp_number || null,
                } as any,
            });

            return user;
        });

        if (result instanceof NextResponse) {
            return result;
        }

        // Create notification for SuperAdmin
        await createNotification({
            action: 'Created',
            entity: 'User',
            entityId: result.id,
            entityName: result.name,
            userId: userId as string,
            link: `/users`,
        });

        return NextResponse.json(
            successResponse('User created successfully', result),
            { status: 201 }
        );
    } catch (error: any) {
        if (error.code === 'P2002') {
            if (error.meta?.target?.includes('username')) {
                return NextResponse.json(
                    errorResponse('Username already exists'),
                    { status: 409 }
                );
            }
            return NextResponse.json(
                errorResponse('Email already exists'),
                { status: 409 }
            );
        }
        console.error('Error creating user:', error);
        return NextResponse.json(
            errorResponse('Failed to create user'),
            { status: 500 }
        );
    }
}
