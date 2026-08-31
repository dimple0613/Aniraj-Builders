"use server";

import { prisma } from "@/lib/prisma";
import { withCompany } from "@/lib/company-server";
import { getServerSession, authOptions } from "@/lib/auth";

export async function getDashboardStats() {
    const session = await getServerSession(authOptions);
    const role = (session?.user as any)?.role as any;
    const companyId = session?.user?.company_id || ''
    if (role === 'SuperAdmin') return getSuperAdminStats(companyId);

    return withCompany(async (store) => {
        const companyId = store?.company_id;
        if (role === 'Admin') return getAdminStats(companyId || '');
        if (role === 'Accountant') return getAccountantStats(companyId || '');
        if (role === 'Supervisor') return getSupervisorStats(session?.user?.id || '');
        if (role === 'DataEntry') return getDataEntryStats(session?.user?.id || '');
        return null;
    });
}

async function getSuperAdminStats(companyId?: string) {
    const now = new Date()

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOf6Months = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    const companyFilter = companyId ? { company_id: companyId } : {}

    const [
        totalCompanies,
        newCompaniesThisMonth,
        totalUsers,
        newUsersThisMonth,
        totalVardhi,
        newVardhiThisMonth,
        totalEstimations,
        monthlyRevenue,
        visitorsLast6Months,
        totalItems,
        newItemsThisMonth,
        stageCounts
    ] = await Promise.all([

        prisma.company.count({
            // where: companyId ? { id: companyId } : {}
        }),

        prisma.company.count({
            where: {
                // ...(companyId ? { id: companyId } : {}),
                createdAt: { gte: startOfMonth }
            }
        }),

        prisma.user.count({
            where: companyFilter
        }),

        prisma.user.count({
            where: {
                ...companyFilter,
                createdAt: { gte: startOfMonth }
            }
        }),

        prisma.vardhi.count({
            where: companyFilter
        }),

        prisma.vardhi.count({
            where: {
                ...companyFilter,
                created_at: { gte: startOfMonth }
            }
        }),

        prisma.vardhiEstimation.count({
            where: companyFilter
        }),

        prisma.vardhiEstimation.aggregate({
            where: {
                ...companyFilter,
                created_at: { gte: startOfMonth }
            },
            _sum: {
                total_amount: true
            }
        }),

        prisma.vardhiEstimation.groupBy({
            by: ["created_at"],
            where: {
                ...companyFilter,
                created_at: { gte: startOf6Months }
            },
            _sum: {
                total_amount: true
            },
            orderBy: {
                created_at: "asc"
            }
        }),

        prisma.itemManagement.count({
            // where: companyFilter
        }),

        prisma.itemManagement.count({
            where: {
                // ...companyId ? { id: companyId } : {},
                createdAt: { gte: startOfMonth }
            }
        }),

        (prisma.vardhiEstimation as any).groupBy({
            by: ['current_stage'],
            where: companyFilter,
            _count: true,
        })
    ])

    const stageCountsMap: Record<string, number> = {
        'file_submitted': 0,
        'store_report': 0,
        'submitted_for_approved': 0,
        'approved': 0,
        'bill_prepaid': 0,
        'bill_audit': 0,
        'bill_account': 0,
        'payment_received': 0,
    };
    
    stageCounts.forEach((item: any) => {
        if (item.current_stage) {
            stageCountsMap[item.current_stage] = item._count;
        }
    });

    return {
        type: "SUPER_ADMIN",

        metrics: [
            {
                label: "Vardhi Created",
                value: totalVardhi,
                description: `${newVardhiThisMonth} added this month`,
                message: "Trending up this month",
                icon: "activity"
            },
            {
                label: "Companies",
                value: totalCompanies,
                description: `${newCompaniesThisMonth} new companies this month`,
                message: "Business growth increasing",
                icon: "building"
            },
            {
                label: "Registered Users",
                value: totalUsers,
                description: `${newUsersThisMonth} joined this month`,
                message: "User acquisition improving",
                icon: "users"
            },
            {
                label: "Revenue This Month",
                value: monthlyRevenue._sum.total_amount ?? 0,
                description: "Income generated this month",
                message: "Trending up this month",
                icon: "indian-rupee"
            },
            {
                label: "Billing Records",
                value: totalEstimations,
                description: "Total billing estimations created",
                message: "Down this period",
                icon: "calculator"
            },
            {
                label: "Total Items",
                value: totalItems,
                description: `${newItemsThisMonth} added this month`,
                message: "Inventory growing",
                icon: "package"
            }
        ],

        stageMetrics: [
            {
                label: "File Created",
                value: stageCountsMap['file_submitted'],
                icon: "file"
            },
            {
                label: "Store Report",
                value: stageCountsMap['store_report'],
                icon: "store"
            },
            {
                label: "Submitted for Approved",
                value: stageCountsMap['submitted_for_approved'],
                icon: "clipboard"
            },
            {
                label: "Approved",
                value: stageCountsMap['approved'],
                icon: "check"
            },
            {
                label: "Bill Prepaid",
                value: stageCountsMap['bill_prepaid'],
                icon: "receipt"
            },
            {
                label: "Bill Audit",
                value: stageCountsMap['bill_audit'],
                icon: "audit"
            },
            {
                label: "Bill Account",
                value: stageCountsMap['bill_account'],
                icon: "account"
            },
            {
                label: "Payment Received",
                value: stageCountsMap['payment_received'],
                icon: "payment"
            },
        ],

        visitorsTrend: {
            title: "Visitors",
            description: "Visitors for the last 6 months",
            data: visitorsLast6Months.map((v: any) => ({
                date: v.created_at,
                amount: v._sum.total_amount || 0
            }))
        }
    }
}

async function getAdminStats(storeId: string) {
    const now = new Date()

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const startOf6Months = new Date(now.getFullYear(), now.getMonth() - 5, 1)

    const companyFilter = { company_id: storeId }

    const [
        totalUsers,
        newUsersThisMonth,
        totalVardhi,
        newVardhiThisMonth,
        totalEstimations,
        monthlyRevenue,
        visitorsLast6Months,
        totalItems,
        newItemsThisMonth,
        zoneCount,
        recentTransactions,
        projects,
        receivable,
        payable,
        partyCount,
        stageCounts
    ] = await Promise.all([

        prisma.user.count({
            where: companyFilter
        }),

        prisma.user.count({
            where: {
                ...companyFilter,
                createdAt: { gte: startOfMonth }
            }
        }),

        prisma.vardhi.count({
            where: companyFilter
        }),

        prisma.vardhi.count({
            where: {
                ...companyFilter,
                created_at: { gte: startOfMonth }
            }
        }),

        prisma.vardhiEstimation.count({
            where: companyFilter
        }),

        prisma.vardhiEstimation.aggregate({
            where: {
                ...companyFilter,
                created_at: { gte: startOfMonth }
            },
            _sum: {
                total_amount: true
            }
        }),

        prisma.vardhiEstimation.groupBy({
            by: ["created_at"],
            where: {
                ...companyFilter,
                created_at: { gte: startOf6Months }
            },
            _sum: {
                total_amount: true
            },
            orderBy: {
                created_at: "asc"
            }
        }),

        prisma.itemManagement.count({
            // where: companyFilter
        }),

        prisma.itemManagement.count({
            where: {
                // ...companyFilter,
                createdAt: { gte: startOfMonth }
            }
        }),

        prisma.zoneMaster.count(),

        prisma.bankBookTransaction.findMany({
            where: companyFilter,
            orderBy: { transaction_date: 'desc' },
            take: 10,
            include: {
                party: { select: { name: true } },
            },
        }),

        prisma.project.findMany({
            where: {
                ...companyFilter,
                status: { in: ['IN_PROGRESS', 'NOT_STARTED'] }
            },
            select: {
                id: true,
                name: true,
                status: true,
                work_progress: true,
            },
            take: 10,
        }),

        prisma.bankBookTransaction.aggregate({
            where: {
                ...companyFilter,
                transaction_type: 'CREDIT',
                party_id: { not: null },
            },
            _sum: { credit_amount: true },
        }),

        prisma.bankBookTransaction.aggregate({
            where: {
                ...companyFilter,
                transaction_type: 'DEBIT',
                party_id: { not: null },
            },
            _sum: { debit_amount: true },
        }),

        prisma.party.count({
            where: companyFilter,
        }),

        (prisma.vardhiEstimation as any).groupBy({
            by: ['current_stage'],
            where: companyFilter,
            _count: true,
        })
    ])

    const stageCountsMap: Record<string, number> = {
        'file_submitted': 0,
        'store_report': 0,
        'submitted_for_approved': 0,
        'approved': 0,
        'bill_prepaid': 0,
        'bill_audit': 0,
        'bill_account': 0,
        'payment_received': 0,
    };
    
    stageCounts.forEach((item: any) => {
        if (item.current_stage) {
            stageCountsMap[item.current_stage] = item._count;
        }
    });

    return {
        type: "ADMIN",

        metrics: [
            {
                label: "Vardhi Created",
                value: totalVardhi,
                description: `${newVardhiThisMonth} added this month`,
                message: "Trending up this month",
                icon: "activity"
            },
            {
                label: "Zones",
                value: zoneCount,
                description: "Total zones configured",
                message: "Zone coverage",
                icon: "map"
            },
            {
                label: "Registered Users",
                value: totalUsers,
                description: `${newUsersThisMonth} joined this month`,
                message: "User acquisition improving",
                icon: "users"
            },
            {
                label: "Revenue This Month",
                value: monthlyRevenue._sum.total_amount ?? 0,
                description: "Income generated this month",
                message: "Trending up this month",
                icon: "indian-rupee"
            },
            {
                label: "Billing Records",
                value: totalEstimations,
                description: "Total billing estimations created",
                message: "Billing activity",
                icon: "calculator"
            },
            {
                label: "Total Items",
                value: totalItems,
                description: `${newItemsThisMonth} added this month`,
                message: "Inventory growing",
                icon: "package"
            }
        ],

        stageMetrics: [
            {
                label: "File Created",
                value: stageCountsMap['file_submitted'],
                icon: "file"
            },
            {
                label: "Store Report",
                value: stageCountsMap['store_report'],
                icon: "store"
            },
            {
                label: "Submitted for Approved",
                value: stageCountsMap['submitted_for_approved'],
                icon: "clipboard"
            },
            {
                label: "Approved",
                value: stageCountsMap['approved'],
                icon: "check"
            },
            {
                label: "Bill Prepaid",
                value: stageCountsMap['bill_prepaid'],
                icon: "receipt"
            },
            {
                label: "Bill Audit",
                value: stageCountsMap['bill_audit'],
                icon: "audit"
            },
            {
                label: "Bill Account",
                value: stageCountsMap['bill_account'],
                icon: "account"
            },
            {
                label: "Payment Received",
                value: stageCountsMap['payment_received'],
                icon: "payment"
            },
        ],

        recentTransactions: recentTransactions.map((t: any) => ({
            id: t.id,
            transaction_date: t.transaction_date,
            ledger: t.ledger,
            transaction_type: t.transaction_type,
            credit_amount: t.credit_amount.toNumber(),
            debit_amount: t.debit_amount.toNumber(),
            party: t.party,
        })),

        projects: projects.map((p: any) => ({
            id: p.id,
            name: p.name,
            status: p.status,
            work_progress: p.work_progress,
        })),

        receivable: receivable._sum.credit_amount?.toNumber() || 0,
        payable: payable._sum.debit_amount?.toNumber() || 0,
        partyCount: partyCount,

        visitorsTrend: {
            title: "Visitors",
            description: "Visitors for the last 6 months",
            data: visitorsLast6Months.map((v: any) => ({
                date: v.created_at,
                amount: v._sum.total_amount || 0
            }))
        }
    }
}

async function getAccountantStats(companyId: string) {
    const accounts = await prisma.account.findMany({
        where: { company_id: companyId, type: 'BANK', is_active: true },
        select: { current_balance: true }
    });

    const totalBalance = accounts.reduce((sum, acc) => sum + Number(acc.current_balance), 0);

    return {
        type: 'ACCOUNTANT',
        metrics: [
            { label: 'Current Balance', value: totalBalance, isAmount: true, icon: 'bank' },
            { label: 'Total Outstandings', value: 0, isAmount: true, icon: 'credit-card' },
        ]
    };
}

async function getSupervisorStats(userId: string) {
    const projects = await prisma.project.findMany({
        where: { status: 'IN_PROGRESS' },
        select: { id: true, name: true, work_progress: true }
    });
    const projectIds = projects.map((p: any) => p.id);

    return {
        type: 'SUPERVISOR',
        assignedProjects: projects.length,
        recentProgress: projects.slice(0, 5).map((p: any) => ({
            projectName: p.name,
            progress: p.work_progress || 0,
            date: new Date()
        }))
    };
}

async function getDataEntryStats(userId: string) {
    const [recentEntries, pendingEntries] = await Promise.all([
        prisma.purchaseEntry.findMany({
            take: 5,
            orderBy: { createdAt: 'desc' },
            include: { party: true }
        }),
        prisma.purchaseEntry.count({
            where: { payment_status: 'UNPAID' }
        })
    ]);

    return {
        type: 'DATA_ENTRY',
        metrics: [
            { label: 'Entries Today', value: recentEntries.length },
            { label: 'Pending Drafts', value: pendingEntries },
        ],
        recentInwards: recentEntries
    };
}
