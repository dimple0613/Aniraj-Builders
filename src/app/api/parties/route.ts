import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { partySchema } from '@/lib/validations/party';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

export async function GET(request: NextRequest): Promise<Response> {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search') || '';
        const typeFilter = searchParams.get('type')?.split(',').filter(Boolean) || [];

        return await withCompany(async (company) => {
            const where: any = {
                company_id: company?.company_id,
            };

            if (search) {
                where.OR = [
                    { name: { contains: search, mode: 'insensitive' } },
                    { mobile_no: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { gst_no: { contains: search, mode: 'insensitive' } },
                ];
            }

            if (typeFilter.length > 0) {
                where.type = { in: typeFilter };
            }

            const skip = (page - 1) * limit;

            const [data, total] = await Promise.all([
                prisma.party.findMany({ where, skip, take: limit } as any),
                prisma.party.count({ where }),
            ]);

            return NextResponse.json({
                success: true,
                data,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                },
            });
        });

    } catch (error: any) {
        return NextResponse.json(
            { success: false, message: error?.message },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest): Promise<Response> {
    try {
        const body = await request.json();

        const validation = await partySchema.validate(body, { abortEarly: false })
            .catch(err => {
                const msg = err.inner.map((e: any) => `${e.path}: ${e.message}`).join('; ');
                throw new Error(msg);
            });

        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {

            if (!company?.company_id) {
                return NextResponse.json(
                    { success: false, message: "Company missing" },
                    { status: 400 }
                );
            }

            const existing = await prisma.party.findUnique({
                where: {
                    company_id_name: {
                        company_id: company.company_id,
                        name: validation.name,
                    },
                },
            });

            if (existing) {
                return NextResponse.json(
                    { success: false, message: "Party already exists" },
                    { status: 400 }
                );
            }

            const party = await prisma.party.create({
                data: {
                    company_id: company.company_id,
                    name: validation.name,
                    address: validation.address,
                    mobile_no: validation.mobile_no,
                    email: validation.email,
                    gst_no: validation.gst_no,
                    type: validation.type,
                    hide_project_items: (validation as any).hide_project_items ?? false,
                    bank_account_name: validation.bank_account_name,
                    bank_account_number: validation.bank_account_number,
                    bank_name: validation.bank_name,
                    bank_ifsc_code: validation.bank_ifsc_code,
                    bank_opening_balance: validation.bank_opening_balance,
                    current_balance: validation.bank_opening_balance,
                } as any,
            });

            await createNotification({
                action: 'Created',
                entity: 'Party',
                entityId: party.id,
                entityName: party.name,
                userId: (session?.user as any)?.id,
                link: `/parties`,
            });

            return NextResponse.json({
                success: true,
                message: "Created",
                data: party,
            });

        });

    } catch (error: any) {
        return NextResponse.json(
            { success: false, message: error?.message },
            { status: 500 }
        );
    }
}