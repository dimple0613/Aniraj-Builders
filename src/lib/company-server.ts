import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { companyContext } from '@/lib/company-context-server';
import { getServerSession, authOptions } from '@/lib/auth';
import { CompanyStore } from '@/types';

export async function withCompany<T>(fn: (store: CompanyStore) => Promise<T>, isSuperAdmin = false): Promise<T> {
    try {
        const session = await getServerSession(authOptions);
        const company_idFromSession = (session?.user as any)?.company_id;
        const zone_idFromSession = (session?.user as any)?.zone_id;
        const userRole = (session?.user as any)?.role;

        // For Zone users, we need to get company_id from the zone
        if (userRole === 'Zone' && zone_idFromSession && !company_idFromSession) {
            const zone = await prisma.zoneMaster.findUnique({
                where: { id: zone_idFromSession },
                select: { company_id: true }
            });

            if (zone) {
                const store: CompanyStore = {
                    company_id: zone.company_id,
                    zone_id: zone_idFromSession,
                    isSuperAdmin
                };
                return companyContext.run(store, () => fn(store));
            }
        }

        if (company_idFromSession) {
            const store: CompanyStore = {
                company_id: company_idFromSession,
                zone_id: zone_idFromSession,
                isSuperAdmin
            };
            return companyContext.run(store, () => fn(store));
        }

        const headerList = await headers();
        const company_idFromHeader = headerList.get('x-company-id');
        const slug = headerList.get('x-company-slug');

        if (company_idFromHeader) {
            const store: CompanyStore = {
                company_id: company_idFromHeader,
                zone_id: undefined,
                isSuperAdmin
            };
            return companyContext.run(store, () => fn(store));
        }

        if (slug) {
            const company = await prisma.company.findUnique({
                where: { slug }
            });

            if (company) {
                const store: CompanyStore = {
                    company_id: company.id,
                    zone_id: undefined,
                    isSuperAdmin
                };
                return companyContext.run(store, () => fn(store));
            }
        }

        // SuperAdmin fallback: use the first available company
        if (userRole === 'SuperAdmin') {
            const firstCompany = await prisma.company.findFirst({
                where: { status: 'ACTIVE' },
                orderBy: { createdAt: 'asc' },
            });

            if (firstCompany) {
                const store: CompanyStore = {
                    company_id: firstCompany.id,
                    zone_id: undefined,
                    isSuperAdmin: true,
                };
                return companyContext.run(store, () => fn(store));
            }
        }

        throw new Error(
            'COMPANY_CONTEXT_MISSING: Unable to resolve company context. ' +
            'User session does not contain company_id and no valid company headers found.'
        );
    } catch (error) {
        console.error('Error in withCompany:', error);
        throw error;
    }
}

export async function withSuperAdmin<T>(fn: (store: CompanyStore) => Promise<T>): Promise<T> {
    return withCompany(fn, true);
}

export async function getCurrentCompanyId(): Promise<string> {
    return withCompany(async (company) => company.company_id);
}

export function applyZoneFilter(query: any, user: { role: string; zone_id: string | null }) {
    if (user.role === 'Zone' && user.zone_id) {
        return {
            ...query,
            where: {
                ...query.where,
                zone_id: user.zone_id
            }
        };
    }
    return query;
}