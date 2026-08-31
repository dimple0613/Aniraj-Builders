import { Module } from './permissions';

/**
 * Maps route paths to permission modules
 * Supports exact matches and wildcard patterns
 * This configuration ensures proper permission checking for each route
 */
export const ROUTE_MODULE_MAP: Record<string, Module> = {
    // =============================================================================
    // DASHBOARD & REPORTS
    // =============================================================================
    '/dashboard': 'REPORTS',
    '/taskboard': 'REPORTS',

    // =============================================================================
    // USER & COMPANY MANAGEMENT
    // =============================================================================
    '/users': 'USERS',
    '/profile': 'PROFILE',
    '/company': 'COMPANIES',
    '/admin': 'COMPANIES',

    // =============================================================================
    // MASTER DATA
    // =============================================================================
    '/masters': 'MASTERS',
    '/projects': 'MASTERS',
    '/parties': 'MASTERS',
    '/locations': 'MASTERS',
    '/pricing': 'MASTERS',

    // Documents Module
    '/documents': 'DOCUMENTS',

    // Items Module
    '/item-management': 'ITEMS',

    // Units Management
    '/units': 'UNIT',
    '/sor-groups': 'ITEMS',

    // Work Type
    '/work-type': 'WORK_TYPE',

    // Zone Masters
    '/zone-masters': 'ZONE',

    // AY Masters
    '/ay-masters': 'AY_MASTER',

    // Master Labour
    '/master-labour': 'MASTER_LABOUR',

    // =============================================================================
    // OPERATIONS
    // =============================================================================
    '/inwards': 'INWARDS',
    '/progress': 'PROGRESS',
    '/vardhi': 'VARDHI',
    '/zone-progress': 'ZONE_PROGRESS',

    // =============================================================================
    // FINANCIAL
    // =============================================================================
    '/finance': 'FINANCE',
    '/estimates': 'ESTIMATES',
    '/invoices': 'INVOICES',
    '/billing': 'BILLING',
    '/bill-generated': 'BILL_GENERATED',

    // Vardhi sub-modules
    '/bill-generated/invoice': 'VARDHI_INVOICE',

    // Reports
    '/reports': 'REPORTS',

    // Cheque Print
    '/cheque-print': 'CHEQUE_PRINT',

    // Tax Invoice
    '/tax-invoice': 'TAX_INVOICE',

    // Belongings Transfer
    '/belongings-transfer': 'BELONGINGS_TRANSFER',

    // Attendance
    '/attendance': 'ATTENDANCE',

    // =============================================================================
    // SYSTEM
    // =============================================================================
    '/settings': 'SETTINGS',
    '/settings/branding': 'SETTINGS',
    '/settings/users': 'SETTINGS',
    '/settings/users/invite': 'SETTINGS',

    // Uploads
    '/upload': 'UPLOAD',

    // =============================================================================
    // HRMS
    // =============================================================================
    '/hr/employees': 'HR_EMPLOYEES',
    '/hr/departments': 'HR_DEPARTMENTS',
    '/hr/designations': 'HR_DESIGNATIONS',
    '/hr/leave': 'HR_LEAVE',
    '/hr/holidays': 'HR_HOLIDAYS',
    '/hr/recruitment': 'HR_RECRUITMENT',
    '/hr/performance': 'HR_PERFORMANCE',
    '/hr/documents': 'HR_DOCUMENTS',
    '/hr/announcements': 'HR_ANNOUNCEMENTS',
    '/hr/salary-components': 'HR_SALARY_COMPONENTS',
    '/hr/employee-salaries': 'HR_EMPLOYEE_SALARIES',
    '/hr/financial-years': 'HR_FINANCIAL_YEARS',
    '/hr/payroll-runs': 'HR_PAYROLL_RUNS',
    '/hr/payslips': 'HR_PAYSLIPS',
    '/hr/reimbursement-types': 'HR_REIMBURSEMENT_TYPES',
    '/hr/reimbursement-requests': 'HR_REIMBURSEMENT_REQUESTS',
    '/hr/loans': 'HR_LOANS',
    '/hr/payroll-dashboard': 'HR_PAYROLL_DASHBOARD',
    '/hr/payroll-reports': 'HR_PAYROLL_REPORTS',
};

/**
 * Get the module for a given route path
 * Supports exact matches and wildcard patterns
 * Returns undefined if no mapping exists (SuperAdmin-only fallback)
 * @param pathname - The route path to look up
 * @returns The module associated with the route, or undefined if not found
 */
export function getModuleForRoute(pathname: string): Module | undefined {
    // Remove trailing slash for consistency
    const normalizedPath = pathname.endsWith('/') && pathname !== '/'
        ? pathname.slice(0, -1)
        : pathname;

    // Try exact match first
    if (ROUTE_MODULE_MAP[normalizedPath]) {
        return ROUTE_MODULE_MAP[normalizedPath];
    }

    // Try wildcard patterns (e.g., /inwards/new -> /inwards)
    // Check parent paths
    const segments = normalizedPath.split('/').filter(Boolean);

    // Try progressively shorter paths
    for (let i = segments.length; i > 0; i--) {
        const parentPath = '/' + segments.slice(0, i).join('/');
        if (ROUTE_MODULE_MAP[parentPath]) {
            return ROUTE_MODULE_MAP[parentPath];
        }
    }

    // No mapping found - SuperAdmin-only fallback
    return undefined;
}

/**
 * Check if a route has an explicit permission mapping
 */
export function hasRouteMapping(pathname: string): boolean {
    return getModuleForRoute(pathname) !== undefined;
}
