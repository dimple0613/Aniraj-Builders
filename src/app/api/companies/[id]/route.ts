import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { getServerSession, authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';
import { canEditCompany } from '@/lib/company-access';

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;
        const userCompanyId = (session?.user as any)?.company_id;

        if (!hasPermission(role, 'COMPANY', 'READ')) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { id } = await context.params;

        // Admin can only view their own company
        if (role === 'Admin' && userCompanyId !== id) {
            return NextResponse.json({ error: 'Access denied. You can only view your own company.' }, { status: 403 });
        }

        const company = await prisma.company.findUnique({
            where: { id },
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
                bill_to: true,
                buyer_name: true,
                buyer_address: true,
                buyer_gstin_uin: true,
                buyer_state_name: true,
                buyer_state_code: true,
                cgst_rate: true,
                sgst_rate: true,
                income_tax_rate: true,
                labour_cess_rate: true,
                cgst_tds_rate: true,
                sgst_tds_rate: true,
                additional_deposit: true,
                bank_name: true,
                branch_name: true,
                ifsc_code: true,
                swift_code: true,
                account_no: true,
                account_holder_name: true,
                module_access: true,
                approved_by_ranges: true,
                createdAt: true,
                updatedAt: true,
                _count: {
                    select: {
                        users: true,
                        projects: true,
                        units: true,
                        Material: true,
                        itemManagements: true,
                    },
                },
            },
        });

        if (!company) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        return NextResponse.json(company);
    } catch (error) {
        console.error('Failed to fetch company:', error);
        return NextResponse.json(
            { error: 'Failed to fetch company' },
            { status: 500 }
        );
    }
}

export async function PUT(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;
        const userCompanyId = (session?.user as any)?.company_id;

        if (!hasPermission(role, 'COMPANY', 'UPDATE') || !(await canEditCompany())) {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const { id } = await context.params;

        // Admin can only update their own company
        if (role === 'Admin' && userCompanyId !== id) {
            return NextResponse.json({ error: 'Access denied. You can only update your own company.' }, { status: 403 });
        }

        const body = await request.json();
        const {
            company_name,
            slug,
            plan,
            status,
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

        const existingCompany = await prisma.company.findUnique({
            where: { id },
        });

        if (!existingCompany) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        if (slug && slug !== existingCompany.slug) {
            const slugExists = await prisma.company.findUnique({
                where: { slug },
            });

            if (slugExists) {
                return NextResponse.json(
                    { error: 'Company with this slug already exists' },
                    { status: 400 }
                );
            }
        }

        const company = await prisma.company.update({
            where: { id },
            data: {
                company_name,
                slug,
                plan,
                status,
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

        return NextResponse.json(company);
    } catch (error) {
        console.error('Failed to update company:', error);
        return NextResponse.json(
            { error: 'Failed to update company' },
            { status: 500 }
        );
    }
}

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;

        // Only SuperAdmin can delete company
        if (!hasPermission(role, 'COMPANY', 'DELETE')) {
            return NextResponse.json({ error: 'Access denied. Only SuperAdmin can delete company.' }, { status: 403 });
        }

        const { id } = await context.params;
        const existingCompany = await prisma.company.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        users: true,
                        projects: true,
                    },
                },
            },
        });

        if (!existingCompany) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        if (existingCompany._count.users > 0 || existingCompany._count.projects > 0) {
            return NextResponse.json(
                { error: 'Cannot delete company with existing users or projects' },
                { status: 400 }
            );
        }

        await prisma.company.delete({
            where: { id },
        });

        return NextResponse.json({ message: 'Company deleted successfully' });
    } catch (error) {
        console.error('Failed to delete company:', error);
        return NextResponse.json(
            { error: 'Failed to delete company' },
            { status: 500 }
        );
    }
}
