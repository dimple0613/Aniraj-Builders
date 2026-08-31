import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getServerSession, authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';
import { canAddCompany } from '@/lib/company-access';

const rateLimitMap = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT = 30;
const RATE_WINDOW = 60 * 1000;

function isRateLimited(key: string): boolean {
    const now = Date.now();
    const record = rateLimitMap.get(key);

    if (!record || now - record.timestamp > RATE_WINDOW) {
        rateLimitMap.set(key, { count: 1, timestamp: now });
        return false;
    }

    if (record.count >= RATE_LIMIT) {
        return true;
    }

    record.count++;
    return false;
}

export async function GET(request: NextRequest) {
    const clientIP = request.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

    if (isRateLimited(clientIP)) {
        return NextResponse.json(
            { error: 'Too many requests. Please try again later.' },
            { status: 429 }
        );
    }

    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;
        const userCompanyId = (session?.user as any)?.company_id;

        if (!hasPermission(role, 'COMPANY', 'READ')) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search') || '';
        const sortField = searchParams.get('sortField') || 'company_name';
        const sortOrder = searchParams.get('sortOrder') || 'asc';

        const skip = (page - 1) * limit;

        let where: any = search
            ? {
                OR: [
                    { company_name: { contains: search, mode: 'insensitive' as const } },
                    { slug: { contains: search, mode: 'insensitive' as const } },
                ],
            }
            : {};

        // Admin can only see their own company
        if (role === 'Admin' && userCompanyId) {
            where = { ...where, id: userCompanyId };
        }

        const [companies, total] = await Promise.all([
            prisma.company.findMany({
                where,
                skip,
                take: Math.min(limit, 100),
                orderBy: { [sortField]: sortOrder },
                select: {
                    id: true,
                    company_name: true,
                    slug: true,
                    logo: true,
                    plan: true,
                    status: true,
                    address: true,
                    gstin_uin: true,
                    state_name: true,
                    state_code: true,
                    contact: true,
                    hsn_sac: true,
                    module_access: true,
                    approved_by_ranges: true,
                    createdAt: true,
                    updatedAt: true,
                    _count: {
                        select: {
                            users: true,
                        },
                    },
                },
            }),
            prisma.company.count({ where }),
        ]);

        return NextResponse.json({
            data: companies,
            pagination: {
                page,
                pages: Math.ceil(total / limit),
                total,
            },
        });
    } catch (error) {
        console.error('Failed to fetch companies:', error);
        return NextResponse.json(
            { error: 'Failed to fetch companies' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;

        // Only SuperAdmin can create company
        if (!hasPermission(role, 'COMPANY', 'CREATE') || !(await canAddCompany())) {
            return NextResponse.json({ error: 'Access denied. Only SuperAdmin can create company.' }, { status: 403 });
        }

        const body = await request.json();
        const {
            company_name,
            slug,
            plan = 'BASIC',
            logo,
            address,
            gstin_uin,
            state_name,
            state_code,
            contact,
            hsn_sac,
            bill_to,
            buyer_name,
            buyer_address,
            buyer_gstin_uin,
            buyer_state_name,
            buyer_state_code,
            cgst_rate,
            sgst_rate,
            income_tax_rate,
            labour_cess_rate,
            cgst_tds_rate,
            sgst_tds_rate,
            additional_deposit,
            bank_name,
            branch_name,
            ifsc_code,
            swift_code,
            account_no,
            account_holder_name,
            module_access,
            approved_by_ranges,
        } = body;

        if (!company_name || !slug) {
            return NextResponse.json(
                { error: 'Company name and slug are required' },
                { status: 400 }
            );
        }

        const existingCompany = await prisma.company.findUnique({
            where: { slug },
        });

        if (existingCompany) {
            return NextResponse.json(
                { error: 'Company with this slug already exists' },
                { status: 400 }
            );
        }

        const company = await prisma.company.create({
            data: {
                company_name,
                slug,
                plan,
                logo,
                status: 'ACTIVE',
                address,
                gstin_uin,
                state_name,
                state_code,
                contact,
                hsn_sac,
                bill_to,
                buyer_name,
                buyer_address,
                buyer_gstin_uin,
                buyer_state_name,
                buyer_state_code,
                cgst_rate: cgst_rate ? parseFloat(cgst_rate) : null,
                sgst_rate: sgst_rate ? parseFloat(sgst_rate) : null,
                income_tax_rate: income_tax_rate ? parseFloat(income_tax_rate) : null,
                labour_cess_rate: labour_cess_rate ? parseFloat(labour_cess_rate) : null,
                cgst_tds_rate: cgst_tds_rate ? parseFloat(cgst_tds_rate) : null,
                sgst_tds_rate: sgst_tds_rate ? parseFloat(sgst_tds_rate) : null,
                additional_deposit: additional_deposit ? parseFloat(additional_deposit) : null,
                bank_name,
                branch_name,
                ifsc_code,
                swift_code,
                account_no,
                account_holder_name,
                module_access: module_access || null,
                approved_by_ranges: Array.isArray(approved_by_ranges)
                    ? approved_by_ranges.map((r: any) => ({
                        name: String(r.name || '').trim(),
                        amount_from: parseFloat(r.amount_from),
                        amount_to: parseFloat(r.amount_to),
                        field_name: String(r.field_name || '').trim(),
                    }))
                    : Prisma.DbNull,
            },
            select: {
                id: true,
                company_name: true,
                slug: true,
                logo: true,
                plan: true,
                status: true,
                createdAt: true,
                updatedAt: true,
            },
        });

        return NextResponse.json(company, { status: 201 });
    } catch (error) {
        console.error('Failed to create company:', error);
        return NextResponse.json(
            { error: 'Failed to create company' },
            { status: 500 }
        );
    }
}
