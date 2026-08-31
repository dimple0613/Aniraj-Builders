import { LucideIcon, LayoutDashboard, Building2, MapPin, Users as UsersIcon, Package, Ruler, DollarSign, PackageOpen, TrendingUp, Calculator, FileText, CheckSquare, ClipboardList, Settings as SettingsIcon, ShieldCheck, UserCog, HardHat, HardHatIcon, CalendarClock, PartyPopper, Wallet, CreditCard, ShoppingCart, Printer, FileSpreadsheet, ArrowLeftRight, Receipt, TrendingDown, TrendingUp as TrendingUpIcon, Percent, ArrowDownToLine, ArrowUpFromLine, User, IndianRupee, Briefcase, Calendar, Megaphone } from 'lucide-react';
import { getModuleForRoute } from './route-module-map';
import { Module } from './permissions';

/**
 * Route metadata interface for sidebar navigation
 */
export interface RouteMetadata {
    href?: string;
    label: string;
    icon?: LucideIcon;
    color?: string;
    module?: Module;
    isSuperAdminOnly?: boolean;
    children?: RouteMetadata[];
}

/**
 * Icon mapping for routes
 */
const ROUTE_ICONS: Record<string, { icon: LucideIcon; color?: string }> = {
    '/dashboard': { icon: LayoutDashboard, color: 'text-sky-500' },
    '/projects': { icon: Building2, color: 'text-violet-500' },
    '/parties': { icon: PartyPopper, color: 'text-pink-500' },
    '/locations': { icon: MapPin, color: 'text-emerald-500' },
    '/masters': { icon: UsersIcon, color: 'text-blue-500' },
    '/items': { icon: Package, color: 'text-amber-500' },
    '/units': { icon: Ruler, color: 'text-cyan-500' },
    '/pricing': { icon: DollarSign, color: 'text-green-500' },
    '/inwards': { icon: PackageOpen, color: 'text-indigo-500' },
    '/progress': { icon: TrendingUp, color: 'text-pink-500' },
    '/estimates': { icon: Calculator, color: 'text-purple-500' },
    '/invoices': { icon: FileText, color: 'text-orange-500' },
    '/approvals': { icon: CheckSquare, color: 'text-teal-500' },
    '/vardhi': { icon: ClipboardList, color: 'text-rose-500' },
    '/bill-generated': { icon: Calculator, color: 'text-rose-500' },
    '/billing': { icon: DollarSign, color: 'text-emerald-500' },
    '/master-labour': { icon: HardHat, color: 'text-orange-500' },
    '/finance': { icon: DollarSign, color: 'text-emerald-500' },
    '/attendance': { icon: CalendarClock, color: 'text-blue-500' },
    '/settings': { icon: SettingsIcon, color: 'text-slate-500' },
    '/users': { icon: UserCog, color: 'text-blue-500' },
    '/admin': { icon: ShieldCheck, color: 'text-red-500' },
    '/companies': { icon: Building2, color: 'text-indigo-500' },
    '/accounts': { icon: CreditCard, color: 'text-blue-500' },
    '/bank-book': { icon: Wallet, color: 'text-green-500' },
    '/cash-book': { icon: Wallet, color: 'text-amber-500' },
    '/purchase-entries': { icon: ShoppingCart, color: 'text-purple-500' },
    '/reports': { icon: FileSpreadsheet, color: 'text-teal-500' },
    '/cheque-print': { icon: Printer, color: 'text-blue-500' },
    '/tax-invoice': { icon: FileText, color: 'text-amber-500' },
    '/belongings-transfer': { icon: ArrowLeftRight, color: 'text-violet-500' },
    '/documents': { icon: FileText, color: 'text-amber-500' },
    '/reports/party-ledger': { icon: Receipt, color: 'text-blue-500' },
    '/reports/project-cost': { icon: TrendingUpIcon, color: 'text-orange-500' },
    '/reports/payable': { icon: TrendingDown, color: 'text-red-500' },
    '/reports/receivable': { icon: TrendingUpIcon, color: 'text-green-500' },
    '/reports/gst': { icon: Percent, color: 'text-purple-500' },
    '/reports/sales': { icon: FileSpreadsheet, color: 'text-emerald-500' },
    '/transactions': { icon: ArrowDownToLine, color: 'text-green-500' },
    '/taskboard': { icon: ClipboardList, color: 'text-cyan-500' },

    // HRMS
    '/hr/employees': { icon: UsersIcon, color: 'text-blue-500' },
    '/hr/departments': { icon: Building2, color: 'text-violet-500' },
    '/hr/designations': { icon: HardHat, color: 'text-orange-500' },
    '/hr/leave': { icon: CalendarClock, color: 'text-cyan-500' },
    '/hr/holidays': { icon: Calendar, color: 'text-red-500' },
    '/hr/recruitment': { icon: Briefcase, color: 'text-emerald-500' },
    '/hr/performance': { icon: TrendingUp, color: 'text-pink-500' },
    '/hr/documents': { icon: FileText, color: 'text-amber-500' },
    '/hr/announcements': { icon: Megaphone, color: 'text-purple-500' },

    // Payroll
    '/hr/salary-components': { icon: DollarSign, color: 'text-green-500' },
    '/hr/employee-salaries': { icon: Wallet, color: 'text-emerald-500' },
    '/hr/financial-years': { icon: Calendar, color: 'text-indigo-500' },
    '/hr/payroll-runs': { icon: Calculator, color: 'text-amber-500' },
    '/hr/payslips': { icon: FileText, color: 'text-blue-500' },
    '/hr/reimbursement-types': { icon: Receipt, color: 'text-purple-500' },
    '/hr/reimbursement-requests': { icon: ClipboardList, color: 'text-rose-500' },
    '/hr/loans': { icon: CreditCard, color: 'text-orange-500' },
    '/hr/payroll-dashboard': { icon: LayoutDashboard, color: 'text-cyan-500' },
    '/hr/payroll-reports': { icon: FileSpreadsheet, color: 'text-teal-500' },
};

/**
 * Label mapping for routes
 */
const ROUTE_LABELS: Record<string, string> = {
    '/dashboard': 'Dashboard',
    '/projects': 'Projects',
    '/locations': 'Locations',
    '/parties': 'Parties',
    '/masters': 'Parties (Masters)',
    '/master-labour': 'Master Labour',
    '/items': 'Items',
    '/units': 'Units',
    '/pricing': 'Party Pricing',
    '/inwards': 'Inwards (Stock)',
    '/progress': 'Work Progress',
    '/estimates': 'Estimates',
    '/invoices': 'Invoices',
    '/approvals': 'Approvals',
    '/vardhi': 'Vardhi ',
    '/billing': 'Billing',
    '/finance': 'Finance',
    '/settings': 'Settings',
    '/settings/branding': 'Branding',
    '/settings/users': 'User Settings',
    '/settings/users/invite': 'Invite User',
    '/users': 'User Management',
    '/admin': 'Admin Console',
    '/company': 'Company Management',
    '/attendance': 'Attendance',
    '/accounts': 'Bank Accounts',
    '/bank-book': 'Bank Book',
    '/cash-book': 'Cash Book',
    '/purchase-entries': 'Purchase Entries',
    '/reports': 'Reports',
    '/reports/party-ledger': 'Party Ledger',
    '/reports/project-cost': 'Project Cost',
    '/reports/payable': 'Payable',
    '/reports/receivable': 'Receivable',
    '/reports/gst': 'GST Report',
    '/reports/sales': 'Sales Report',
    '/cheque-print': 'Cheque Print',
    '/tax-invoice': 'Tax Invoice',
    '/belongings-transfer': 'Belongings Transfer',
    '/documents': 'Documents',
    '/taskboard': 'Taskboard',

    // HRMS
    '/hr/employees': 'Employees',
    '/hr/departments': 'Departments',
    '/hr/designations': 'Designations',
    '/hr/leave': 'Leave',
    '/hr/holidays': 'Holidays',
    '/hr/recruitment': 'Recruitment',
    '/hr/performance': 'Performance Reviews',
    '/hr/documents': 'Employee Documents',
    '/hr/announcements': 'Announcements',
    '/hr/salary-components': 'Salary Components',
    '/hr/employee-salaries': 'Employee Salaries',
    '/hr/financial-years': 'Financial Years',
    '/hr/payroll-runs': 'Payroll Runs',
    '/hr/payslips': 'Payslips',
    '/hr/reimbursement-types': 'Reimbursement Types',
    '/hr/reimbursement-requests': 'Reimbursement Requests',
    '/hr/loans': 'Loans & Advances',
    '/hr/payroll-dashboard': 'Payroll Dashboard',
    '/hr/payroll-reports': 'Payroll Reports',
};

/**
 * All authenticated routes (manually defined for now)
 * In a future iteration, this could be auto-discovered from filesystem
 */
export const AUTHENTICATED_ROUTES: any = [
    {
        label: 'Home',
        children: [
            {
                label: 'Dashboard',
                href: '/dashboard',
                icon: LayoutDashboard,
                module: 'REPORTS',
            },
            {
                label: 'Taskboard',
                href: '/taskboard',
                icon: ClipboardList,
                module: 'REPORTS',
            },
        ],
    },
    {
        label: 'Maintenance',
        children: [
            {
                label: 'Maintenance SOR',
                href: '/maintenance-sor',
                icon: Package,
                module: 'ITEMS',
            },
            {
                label: 'Vardhi Master',
                href: '/vardhi',
                icon: ClipboardList,
                module: 'VARDHI',
            },
            {
                label: 'Vardhi Summary',
                href: '/vardhi-summary',
                icon: IndianRupee,
                module: 'VARDHI',
            },
            {
                label: 'Bill Tracking',
                href: '/bill-generated',
                icon: FileText,
                module: 'VARDHI',
            },
            {
                label: 'Zone',
                href: '/zone-masters',
                icon: MapPin,
                module: 'MASTER_LABOUR',
            },
            {
                label: 'Work Type',
                href: '/work-type',
                icon: HardHatIcon,
                module: 'MASTER_LABOUR',
            },
            {
                label: 'Employee',
                href: '/employee',
                icon: User,
                module: 'EMPLOYEES',
            },
        ],
    },
    {
        label: 'Capital',
        children: [
            {
                label: 'Item Master',
                href: '/item-master',
                icon: Package,
                module: 'ITEM_MASTER',
            },
            {
                label: 'Projects',
                href: '/projects',
                icon: Building2,
                module: 'MASTERS',
            },
            {
                label: 'Parties',
                href: '/parties',
                icon: PartyPopper,
                module: 'MASTERS',
            },

            {
                label: 'Bank Book',
                href: '/bank-book',
                icon: Wallet,
                module: 'BANK',
            },
            {
                label: 'Cash Book',
                href: '/cash-book',
                icon: Wallet,
                module: 'CASH',
            },
            {
                label: 'Purchase Entries',
                href: '/purchase-entries',
                icon: ShoppingCart,
                module: 'MASTERS',
            },
            {
                label: 'Attendance',
                href: '/attendance',
                icon: CalendarClock,
                module: 'ATTENDANCE',
            },
             {
                label: 'Subcontractor',
                href: '/subcontractor',
                icon: User,
                module: 'SUBCONTRACTORS',
            },
            {
                label: 'Documents',
                href: '/documents',
                icon: FileText,
                module: 'DOCUMENTS',
            },
        ],
    },
    {
        label: 'HRMS',
        children: [
            {
                label: 'Employees',
                href: '/hr/employees',
                icon: UsersIcon,
                module: 'HR_EMPLOYEES',
            },
            {
                label: 'Leave',
                href: '/hr/leave',
                icon: CalendarClock,
                module: 'HR_LEAVE',
            },
            {
                label: 'Salary Components',
                href: '/hr/salary-components',
                icon: DollarSign,
                module: 'HR_SALARY_COMPONENTS',
            },
            {
                label: 'Employee Salaries',
                href: '/hr/employee-salaries',
                icon: Wallet,
                module: 'HR_EMPLOYEE_SALARIES',
            },
            {
                label: 'Financial Years',
                href: '/hr/financial-years',
                icon: Calendar,
                module: 'HR_FINANCIAL_YEARS',
            },
            {
                label: 'Payroll Runs',
                href: '/hr/payroll-runs',
                icon: Calculator,
                module: 'HR_PAYROLL_RUNS',
            },
            {
                label: 'Payslips',
                href: '/hr/payslips',
                icon: FileText,
                module: 'HR_PAYSLIPS',
            },
            {
                label: 'Reimbursement Requests',
                href: '/hr/reimbursement-requests',
                icon: ClipboardList,
                module: 'HR_REIMBURSEMENT_REQUESTS',
            },
        ],
    },
    // {
    //     label: 'Operations',
    //     children: [

    //         //     label: 'Reports',
    //         //     href: '/reports',
    //         //     icon: FileSpreadsheet,
    //         //     module: 'REPORTS',
    //         // },
    //         // {
    //         //     label: 'Cheque Print',
    //         //     href: '/cheque-print',
    //         //     icon: Printer,
    //         //     module: 'CHEQUE_PRINT',
    //         // },
    //         // {
    //         //     label: 'Tax Invoice',
    //         //     href: '/tax-invoice',
    //         //     icon: FileText,
    //         //     module: 'TAX_INVOICE',
    //         // },
    //         // {
    //         //     label: 'Belongings Transfer',
    //         //     href: '/belongings-transfer',
    //         //     icon: ArrowLeftRight,
    //         //     module: 'BELONGINGS_TRANSFER',
    //         // },
    //     ],
    // },

    {
        label: 'Admin',
        children: [
            // {
            //     label: 'Units',
            //     href: '/units',
            //     icon: Ruler,
            //     module: 'UNIT',
            // },
            // {
            //     label: 'SOR Groups',
            //     href: '/sor-groups',
            //     icon: Package,
            //     module: 'ITEMS',
            // },
            {
                label: 'User Management',
                href: '/users',
                icon: UserCog,
                module: 'USERS',
            },
            {
                label: 'Account Management',
                href: '/accounts',
                icon: CreditCard,
                module: 'BANK',
            },
            {
                label: 'Company Management',
                href: '/company',
                icon: Building2,
                module: 'COMPANIES',
                isSuperAdminOnly: true,
            },
        ],
    },
    {
        label: 'Reports',
        children: [
            {
                label: 'Party Ledger',
                href: '/reports/party-ledger',
                icon: Receipt,
                module: 'REPORTS',
            },
            {
                label: 'Project Cost',
                href: '/reports/project-cost',
                icon: TrendingUpIcon,
                module: 'REPORTS',
            },
            {
                label: 'Payable',
                href: '/reports/payable',
                icon: TrendingDown,
                module: 'REPORTS',
            },
            {
                label: 'Receivable',
                href: '/reports/receivable',
                icon: TrendingUpIcon,
                module: 'REPORTS',
            },
            {
                label: 'GST Report',
                href: '/reports/gst',
                icon: Percent,
                module: 'REPORTS',
            },
            {
                label: 'Sales Report',
                href: '/reports/sales',
                icon: FileSpreadsheet,
                module: 'REPORTS',
            },
        ],
    },
]

/**
 * Get all routes for sidebar display
 * Zone users only see Vardhi and Vardhi Summary
 * Access control is enforced at the page level
 */
export function getAllRoutes(userRole?: string): RouteMetadata[] {
    // Zone users only see Vardhi and Vardhi Summary
    if (userRole === 'Zone') {
        const vardhiRoutes = AUTHENTICATED_ROUTES
            .flatMap((group: any) => group.children || [])
            .filter((route: any) =>
                route.href === '/vardhi' ||
                route.href === '/vardhi-summary'
            );

        return [
            {
                label: 'Vardhi',
                children: vardhiRoutes
            }
        ];
    }

    if (!userRole || userRole !== 'SuperAdmin') {
        return AUTHENTICATED_ROUTES.map((group: any) => ({
            ...group,
            children: group.children?.filter((route: any) => !route.isSuperAdminOnly)
        })).filter((group: any) => group.children && group.children.length > 0);
    }
    return AUTHENTICATED_ROUTES;
}

/**
 * Get route metadata by path
 */
export function getRouteMetadata(pathname: string): RouteMetadata | undefined {
    const normalizedPath = pathname.endsWith('/') && pathname !== '/'
        ? pathname.slice(0, -1)
        : pathname;

    // Search in flat routes
    for (const route of AUTHENTICATED_ROUTES) {
        if (route.href === normalizedPath) {
            return route;
        }
        // Search in children
        if (route.children) {
            const child = route.children.find((c: any) => c.href === normalizedPath);
            if (child) return child;
        }
    }

    return undefined;
}
