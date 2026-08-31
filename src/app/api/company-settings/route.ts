import { NextRequest, NextResponse } from 'next/server';
import { getServerSession, authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;

        if (role !== 'SuperAdmin') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        let setting = await prisma.companyAccessSetting.findFirst();

        if (!setting) {
            setting = await prisma.companyAccessSetting.create({
                data: {
                    allow_add_company: true,
                    allow_edit_company: true,
                },
            });
        }

        return NextResponse.json({ data: setting });
    } catch (error) {
        console.error('[COMPANY_SETTINGS_GET]', error);
        return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        const role = (session?.user as any)?.role;

        if (role !== 'SuperAdmin') {
            return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }

        const body = await request.json();
        const { allow_add_company, allow_edit_company } = body;

        let setting = await prisma.companyAccessSetting.findFirst();

        if (!setting) {
            setting = await prisma.companyAccessSetting.create({
                data: {
                    allow_add_company: allow_add_company ?? true,
                    allow_edit_company: allow_edit_company ?? true,
                },
            });
        } else {
            setting = await prisma.companyAccessSetting.update({
                where: { id: setting.id },
                data: {
                    allow_add_company,
                    allow_edit_company,
                },
            });
        }

        return NextResponse.json({ data: setting });
    } catch (error) {
        console.error('[COMPANY_SETTINGS_PUT]', error);
        return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
    }
}
