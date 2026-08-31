/**
 * =============================================================================
 * RBAC (Role-Based Access Control) - Permission System
 * =============================================================================
 * This file provides the core permission system for the SaaS application.
 *
 * Features:
 * - Role-based permission matrix
 * - Module-based access control
 * - VIEW/READ/EDIT/DELETE/CREATE/APPROVE actions
 * - Backward compatibility (VIEW maps to READ)
 *
 * Usage:
 * - hasPermission(role, module, action) - Check if user can perform action
 * - getModulePermissions(role, module) - Get all allowed actions
 * - getUserPermissions(role) - Get all user permissions
 * =============================================================================
 */

import { Role } from "@prisma/client";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Permission actions available in the system
 * Each action represents a specific capability
 */
export type Action =
  | "VIEW" // View/Read data (maps to READ internally)
  | "READ" // Read data
  | "CREATE" // Create new records
  | "EDIT" // Update existing records (maps to UPDATE)
  | "UPDATE" // Update existing records
  | "DELETE" // Delete records
  | "APPROVE"; // Approve/reject operations

/**
 * Application modules representing different functional areas
 * Each module can have different permissions per role
 */
export type Module =
  // User & Company Management
  | "COMPANIES" // Company/Organization management
  | "COMPANY" // Single company settings
  | "USERS" // User management
  | "PROFILE" // User profile

  // Master Data
  | "ITEM_MASTER" // Item Master management
  | "EMPLOYEES" // Employee management
  | "ITEMS" // Items/Products master
  | "MASTERS" // General master data (parties, materials)
  | "MASTER_LABOUR" // Labour type masters
  | "UNIT" // Units management
  | "WORK_TYPE" // Work type management
  | "ZONE" // Zone masters
  | "AY_MASTER" // Financial year masters

  // Operations
  | "INWARDS" // Inward/Stock entries
  | "PROGRESS" // Work progress tracking
  | "VARDHI" // Vardhi/Work orders
  | "WORK_LABOUR" // Work labour management
  | "ZONE_PROGRESS" // Zone progress tracking

  // Financial - Bank/Cash/Finance
  | "BANK" // Bank accounts management
  | "CASH" // Cash book management
  | "FINANCE" // Finance management
  | "ESTIMATES" // Estimates/Bill estimates
  | "INVOICES" // Invoice management
  | "BILLING" // Billing management
  | "BILL_GENERATED" // Bill generated management
  | "VARDHI_INVOICE" // Vardhi invoices
  | "VARDHI_ESTIMATES" // Vardhi estimates
  | "SUBCONTRACTORS" // Subcontractor management
  | "DOCUMENTS" // Document management
  | "CHEQUE_PRINT" // Cheque printing
  | "TAX_INVOICE" // Tax invoice generation
  | "BELONGINGS_TRANSFER" // Belongings transfer management

  // System
  | "REPORTS" // Reports & Dashboards
  | "APPROVALS" // Approval workflows
  | "SETTINGS" // System settings
  | "AUDIT" // Audit logs
  | "UPLOAD" // File uploads
  | "ATTENDANCE" // Attendance tracking

  // HRMS
  | "HR_EMPLOYEES" // HR Employee management
  | "HR_DEPARTMENTS" // Department management
  | "HR_DESIGNATIONS" // Designation management
  | "HR_LEAVE" // Leave management
  | "HR_HOLIDAYS" // Holiday calendar
  | "HR_RECRUITMENT" // Recruitment (Jobs & Candidates)
  | "HR_PERFORMANCE" // Performance reviews
  | "HR_DOCUMENTS" // Employee documents
  | "HR_ANNOUNCEMENTS" // Announcements
  | "HR_SALARY_COMPONENTS" // Payroll salary components
  | "HR_EMPLOYEE_SALARIES" // Employee salary structures
  | "HR_FINANCIAL_YEARS" // Financial year management
  | "HR_PAYROLL_RUNS" // Payroll processing runs
  | "HR_PAYSLIPS" // Employee payslips
  | "HR_REIMBURSEMENT_TYPES" // Reimbursement type management
  | "HR_REIMBURSEMENT_REQUESTS" // Reimbursement requests
  | "HR_LOANS" // Loan/Advance management
  | "HR_PAYROLL_DASHBOARD" // Payroll dashboard
  | "HR_PAYROLL_REPORTS"; // Payroll reports

// =============================================================================
// CONSTANTS
// =============================================================================

/**
 * All valid roles in the system
 * Order matters - SuperAdmin should be first for performance
 */
export const VALID_ROLES: Role[] = [
  "SuperAdmin",
  "Admin",
  "Accountant",
  "DataEntry",
  "Supervisor",
  "Zone",
  "HR",
  "Manager",
  "Recruiter",
] as const;

/**
 * Maps frontend actions to internal actions for backward compatibility
 */
const ACTION_ALIAS_MAP: Record<string, Action> = {
  VIEW: "READ",
  EDIT: "UPDATE",
};

/**
 * Action aliases for creating new records
 */
const CREATE_ACTIONS = [
  "CREATE",
  "READ",
  "UPDATE",
  "DELETE",
  "APPROVE",
] as const;

/**
 * =============================================================================
 * PERMISSION MATRIX
 * =============================================================================
 * Defines what each role can do in each module
 *
 * Permission Levels:
 * - SuperAdmin: Full access to everything
 * - Admin: Full access except company creation
 * - Accountant: Read + Create + Update for financial modules
 * - DataEntry: Create + Read for entry modules
 * - Supervisor: Read + Create + Update for progress modules
 * =============================================================================
 */

export const PERMISSION_MATRIX: Record<
  Role,
  Partial<Record<Module, readonly Action[]>>
> = {
  // =============================================================================
  // SUPER ADMIN - Full system access
  // =============================================================================
  SuperAdmin: {
    // User & Company
    COMPANIES: ["CREATE", "READ", "UPDATE", "DELETE"],
    COMPANY: ["CREATE", "READ", "UPDATE", "DELETE"],
    USERS: ["CREATE", "READ", "UPDATE", "DELETE"],
    PROFILE: ["READ", "UPDATE"],

    // Master Data
    ITEM_MASTER: ["CREATE", "READ", "UPDATE", "DELETE"],
    EMPLOYEES: ["CREATE", "READ", "UPDATE", "DELETE"],
    ITEMS: ["CREATE", "READ", "UPDATE", "DELETE"],
    MASTERS: ["CREATE", "READ", "UPDATE", "DELETE"],
    MASTER_LABOUR: ["CREATE", "READ", "UPDATE", "DELETE"],
    UNIT: ["CREATE", "READ", "UPDATE", "DELETE"],
    WORK_TYPE: ["CREATE", "READ", "UPDATE", "DELETE"],
    ZONE: ["CREATE", "READ", "UPDATE", "DELETE"],
    AY_MASTER: ["CREATE", "READ", "UPDATE", "DELETE"],

    // Operations
    INWARDS: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    PROGRESS: ["CREATE", "READ", "UPDATE", "DELETE"],
    VARDHI: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    WORK_LABOUR: ["CREATE", "READ", "UPDATE", "DELETE"],
    ZONE_PROGRESS: ["CREATE", "READ", "UPDATE", "DELETE"],

    // Financial
    BANK: ["CREATE", "READ", "UPDATE", "DELETE"],
    CASH: ["CREATE", "READ", "UPDATE", "DELETE"],
    FINANCE: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    ESTIMATES: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    INVOICES: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    BILLING: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    BILL_GENERATED: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    VARDHI_INVOICE: ["CREATE", "READ", "UPDATE", "DELETE"],
    VARDHI_ESTIMATES: ["CREATE", "READ", "UPDATE", "DELETE"],
    CHEQUE_PRINT: ["CREATE", "READ", "UPDATE", "DELETE"],
    TAX_INVOICE: ["CREATE", "READ", "UPDATE", "DELETE"],
    BELONGINGS_TRANSFER: ["CREATE", "READ", "UPDATE", "DELETE"],

    // System
    REPORTS: ["READ"],
    APPROVALS: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    SETTINGS: ["CREATE", "READ", "UPDATE", "DELETE"],
    AUDIT: ["READ"],
    UPLOAD: ["CREATE", "READ", "DELETE"],
    ATTENDANCE: ["CREATE", "READ", "UPDATE", "DELETE"],
    SUBCONTRACTORS: ["CREATE", "READ", "UPDATE", "DELETE"],
    DOCUMENTS: ["CREATE", "READ", "UPDATE", "DELETE"],

    // HRMS
    HR_EMPLOYEES: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_DEPARTMENTS: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_DESIGNATIONS: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_LEAVE: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    HR_HOLIDAYS: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_RECRUITMENT: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_PERFORMANCE: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_DOCUMENTS: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_ANNOUNCEMENTS: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_SALARY_COMPONENTS: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_EMPLOYEE_SALARIES: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_FINANCIAL_YEARS: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_PAYROLL_RUNS: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    HR_PAYSLIPS: ["READ"],
    HR_REIMBURSEMENT_TYPES: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_REIMBURSEMENT_REQUESTS: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    HR_LOANS: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_PAYROLL_DASHBOARD: ["READ"],
    HR_PAYROLL_REPORTS: ["READ"],
  },

  // =============================================================================
  // ADMIN - Company admin with most permissions
  // =============================================================================
  Admin: {
    // User & Company
    COMPANY: ["READ", "UPDATE"],
    USERS: ["CREATE", "READ", "UPDATE", "DELETE"],
    PROFILE: ["READ", "UPDATE"],

    // Master Data
    ITEM_MASTER: ["CREATE", "READ", "UPDATE", "DELETE"],
    EMPLOYEES: ["CREATE", "READ", "UPDATE", "DELETE"],
    ITEMS: ["CREATE", "READ", "UPDATE", "DELETE"],
    MASTERS: ["CREATE", "READ", "UPDATE", "DELETE"],
    MASTER_LABOUR: ["CREATE", "READ", "UPDATE", "DELETE"],
    UNIT: ["CREATE", "READ", "UPDATE", "DELETE"],
    WORK_TYPE: ["CREATE", "READ", "UPDATE", "DELETE"],
    ZONE: ["CREATE", "READ", "UPDATE", "DELETE"],
    AY_MASTER: ["CREATE", "READ", "UPDATE", "DELETE"],

    // Operations
    INWARDS: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    PROGRESS: ["CREATE", "READ", "UPDATE", "DELETE"],
    VARDHI: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    WORK_LABOUR: ["CREATE", "READ", "UPDATE", "DELETE"],
    ZONE_PROGRESS: ["CREATE", "READ", "UPDATE", "DELETE"],

    // Financial
    BANK: ["CREATE", "READ", "UPDATE", "DELETE"],
    CASH: ["CREATE", "READ", "UPDATE", "DELETE"],
    FINANCE: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    ESTIMATES: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    INVOICES: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    BILLING: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    BILL_GENERATED: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    VARDHI_INVOICE: ["CREATE", "READ", "UPDATE", "DELETE"],
    VARDHI_ESTIMATES: ["CREATE", "READ", "UPDATE", "DELETE"],
    CHEQUE_PRINT: ["CREATE", "READ", "UPDATE", "DELETE"],
    TAX_INVOICE: ["CREATE", "READ", "UPDATE", "DELETE"],
    BELONGINGS_TRANSFER: ["CREATE", "READ", "UPDATE", "DELETE"],

    // System
    REPORTS: ["READ"],
    APPROVALS: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    SETTINGS: ["CREATE", "READ", "UPDATE", "DELETE"],
    UPLOAD: ["CREATE", "READ", "DELETE"],
    SUBCONTRACTORS: ["CREATE", "READ", "UPDATE", "DELETE"],
    ATTENDANCE: ["CREATE", "READ", "UPDATE", "DELETE"],
    DOCUMENTS: ["CREATE", "READ", "UPDATE", "DELETE"],

    // HRMS
    HR_EMPLOYEES: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_DEPARTMENTS: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_DESIGNATIONS: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_LEAVE: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    HR_HOLIDAYS: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_RECRUITMENT: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_PERFORMANCE: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_DOCUMENTS: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_ANNOUNCEMENTS: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_SALARY_COMPONENTS: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_EMPLOYEE_SALARIES: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_FINANCIAL_YEARS: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_PAYROLL_RUNS: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    HR_PAYSLIPS: ["READ"],
    HR_REIMBURSEMENT_TYPES: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_REIMBURSEMENT_REQUESTS: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    HR_LOANS: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_PAYROLL_DASHBOARD: ["READ"],
    HR_PAYROLL_REPORTS: ["READ"],
  },

  // =============================================================================
  // ACCOUNTANT - Financial operations focus
  // =============================================================================
  Accountant: {
    // User & Company
    PROFILE: ["READ", "UPDATE"],

    // Master Data - Read only
    ITEM_MASTER: ["READ"],
    EMPLOYEES: ["READ"],
    ITEMS: ["READ"],
    MASTERS: ["READ"],
    MASTER_LABOUR: ["READ"],
    UNIT: ["READ"],
    WORK_TYPE: ["READ"],
    ZONE: ["READ"],
    AY_MASTER: ["READ"],

    // Operations
    INWARDS: ["READ"],
    PROGRESS: ["READ"],
    VARDHI: ["READ"],
    WORK_LABOUR: ["READ"],

    // Financial - Full access except delete
    BANK: ["CREATE", "READ", "UPDATE"],
    CASH: ["CREATE", "READ", "UPDATE"],
    FINANCE: ["CREATE", "READ", "UPDATE", "APPROVE"],
    ESTIMATES: ["READ"],
    INVOICES: ["CREATE", "READ", "UPDATE", "APPROVE"],
    BILLING: ["CREATE", "READ", "UPDATE", "APPROVE"],
    BILL_GENERATED: ["CREATE", "READ", "UPDATE", "APPROVE"],
    CHEQUE_PRINT: ["READ"],
    TAX_INVOICE: ["READ"],
    BELONGINGS_TRANSFER: ["READ"],

    // System
    REPORTS: ["READ"],
    APPROVALS: ["READ"],
    UPLOAD: ["CREATE", "READ"],
    ATTENDANCE: ["CREATE", "READ", "UPDATE", "DELETE"],

    // HRMS - Read only
    HR_EMPLOYEES: ["READ"],
    HR_LEAVE: ["READ"],
    HR_HOLIDAYS: ["READ"],
    HR_RECRUITMENT: ["READ"],
    HR_DOCUMENTS: ["READ"],
    HR_ANNOUNCEMENTS: ["READ"],
    HR_SALARY_COMPONENTS: ["READ"],
    HR_EMPLOYEE_SALARIES: ["READ"],
    HR_FINANCIAL_YEARS: ["READ"],
    HR_PAYROLL_RUNS: ["READ"],
    HR_PAYSLIPS: ["READ"],
    HR_REIMBURSEMENT_TYPES: ["READ"],
    HR_REIMBURSEMENT_REQUESTS: ["READ", "UPDATE"],
    HR_LOANS: ["READ"],
    HR_PAYROLL_DASHBOARD: ["READ"],
    HR_PAYROLL_REPORTS: ["READ"],
  },

  // =============================================================================
  // DATA ENTRY - Data entry operations
  // =============================================================================
  DataEntry: {
    // User & Company
    PROFILE: ["READ", "UPDATE"],

    // Master Data
    ITEM_MASTER: ["CREATE", "READ", "UPDATE"],
    EMPLOYEES: ["CREATE", "READ", "UPDATE"],
    ITEMS: ["CREATE", "READ", "UPDATE"],
    MASTERS: ["READ"],
    MASTER_LABOUR: ["READ"],
    UNIT: ["CREATE", "READ", "UPDATE"],
    WORK_TYPE: ["CREATE", "READ", "UPDATE"],
    ZONE: ["CREATE", "READ", "UPDATE"],
    AY_MASTER: ["CREATE", "READ", "UPDATE"],

    // Operations
    INWARDS: ["CREATE", "READ"],
    PROGRESS: ["CREATE", "READ", "UPDATE"],
    VARDHI: ["CREATE", "READ"],
    WORK_LABOUR: ["CREATE", "READ", "UPDATE"],

    // Financial - Read only
    BANK: ["READ"],
    CASH: ["READ"],
    ESTIMATES: ["READ"],
    BILLING: ["READ"],
    BILL_GENERATED: ["READ"],
    CHEQUE_PRINT: ["READ"],
    TAX_INVOICE: ["READ"],
    BELONGINGS_TRANSFER: ["CREATE", "READ", "UPDATE", "DELETE"],

    // System
    REPORTS: ["READ"],
    UPLOAD: ["CREATE", "READ"],
    ATTENDANCE: ["CREATE", "READ", "UPDATE", "DELETE"],

    // HRMS - Read only
    HR_EMPLOYEES: ["READ"],
    HR_LEAVE: ["READ"],
    HR_HOLIDAYS: ["READ"],
    HR_ANNOUNCEMENTS: ["READ"],
  },

  // =============================================================================
  // SUPERVISOR - Progress tracking focus
  // =============================================================================
  Supervisor: {
    // User & Company
    PROFILE: ["READ", "UPDATE"],

    // Master Data - Read only
    ITEM_MASTER: ["READ"],
    EMPLOYEES: ["READ"],
    ITEMS: ["READ"],
    MASTERS: ["READ"],
    MASTER_LABOUR: ["READ"],
    UNIT: ["READ"],
    WORK_TYPE: ["READ"],
    ZONE: ["READ"],
    AY_MASTER: ["READ"],

    // Operations
    INWARDS: ["READ"],
    PROGRESS: ["CREATE", "READ", "UPDATE"],
    VARDHI: ["READ"],
    WORK_LABOUR: ["CREATE", "READ", "UPDATE"],

    // Financial - Read only
    BANK: ["READ"],
    CASH: ["READ"],
    ESTIMATES: ["READ"],
    BILLING: ["READ"],
    BILL_GENERATED: ["READ"],
    CHEQUE_PRINT: ["READ"],
    TAX_INVOICE: ["READ"],
    BELONGINGS_TRANSFER: ["READ"],

    // System
    REPORTS: ["READ"],
    UPLOAD: ["CREATE", "READ"],
    ATTENDANCE: ["CREATE", "READ", "UPDATE", "DELETE"],

    // HRMS - Read only
    HR_EMPLOYEES: ["READ"],
    HR_LEAVE: ["READ", "UPDATE"],
    HR_HOLIDAYS: ["READ"],
    HR_ANNOUNCEMENTS: ["READ"],
  },

  // =============================================================================
  // ZONE - Zone-scoped access (can edit vardhi only in their zone)
  // =============================================================================
  Zone: {
    PROFILE: ["READ", "UPDATE"],
    ZONE: ["READ"],
    EMPLOYEES: ["READ"],
    ITEMS: ["READ"],
    ITEM_MASTER: ["READ"],
    MASTERS: ["READ"],
    MASTER_LABOUR: ["READ"],
    UNIT: ["READ"],
    WORK_TYPE: ["READ"],
    AY_MASTER: ["READ"],
    INWARDS: ["READ"],
    VARDHI: ["READ", "UPDATE"],
    BANK: ["READ"],
    CASH: ["READ"],
    ESTIMATES: ["READ"],
    BILLING: ["READ"],
    BILL_GENERATED: ["READ"],
    REPORTS: ["READ"],
    UPLOAD: ["CREATE", "READ"],

    // HRMS - Read only
    HR_EMPLOYEES: ["READ"],
    HR_HOLIDAYS: ["READ"],
  },

  // =============================================================================
  // HR - Human Resources (full HR access)
  // =============================================================================
  HR: {
    PROFILE: ["READ", "UPDATE"],

    // Master Data
    ITEM_MASTER: ["READ"],
    EMPLOYEES: ["READ"],
    ITEMS: ["READ"],
    MASTERS: ["READ"],

    // HRMS - Full access
    HR_EMPLOYEES: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_DEPARTMENTS: ["CREATE", "READ", "UPDATE"],
    HR_DESIGNATIONS: ["CREATE", "READ", "UPDATE"],
    HR_LEAVE: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    HR_HOLIDAYS: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_RECRUITMENT: ["CREATE", "READ", "UPDATE"],
    HR_PERFORMANCE: ["CREATE", "READ", "UPDATE"],
    HR_DOCUMENTS: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_ANNOUNCEMENTS: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_SALARY_COMPONENTS: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_EMPLOYEE_SALARIES: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_FINANCIAL_YEARS: ["CREATE", "READ", "UPDATE"],
    HR_PAYROLL_RUNS: ["CREATE", "READ", "UPDATE", "APPROVE"],
    HR_PAYSLIPS: ["READ"],
    HR_REIMBURSEMENT_TYPES: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_REIMBURSEMENT_REQUESTS: ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE"],
    HR_LOANS: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_PAYROLL_DASHBOARD: ["READ"],
    HR_PAYROLL_REPORTS: ["READ"],

    // System
    REPORTS: ["READ"],
    UPLOAD: ["CREATE", "READ"],
  },

  // =============================================================================
  // MANAGER - Can manage their team's performance and leave
  // =============================================================================
  Manager: {
    PROFILE: ["READ", "UPDATE"],

    // Master Data - Read only
    EMPLOYEES: ["READ"],
    ITEMS: ["READ"],
    MASTERS: ["READ"],

    // HRMS - Limited to their team
    HR_EMPLOYEES: ["READ"],
    HR_LEAVE: ["READ", "APPROVE"],
    HR_PERFORMANCE: ["CREATE", "READ", "UPDATE"],
    HR_ANNOUNCEMENTS: ["READ"],
    HR_SALARY_COMPONENTS: ["READ"],
    HR_EMPLOYEE_SALARIES: ["READ"],
    HR_FINANCIAL_YEARS: ["READ"],
    HR_PAYROLL_RUNS: ["READ"],
    HR_PAYSLIPS: ["READ"],
    HR_REIMBURSEMENT_TYPES: ["READ"],
    HR_REIMBURSEMENT_REQUESTS: ["READ"],
    HR_LOANS: ["READ"],
    HR_PAYROLL_DASHBOARD: ["READ"],
    HR_PAYROLL_REPORTS: ["READ"],

    // System
    REPORTS: ["READ"],
    UPLOAD: ["CREATE", "READ"],
  },

  // =============================================================================
  // RECRUITER - Recruitment focused
  // =============================================================================
  Recruiter: {
    PROFILE: ["READ", "UPDATE"],

    // Master Data - Read only
    EMPLOYEES: ["READ"],
    ITEMS: ["READ"],

    // HRMS - Recruitment focused
    HR_RECRUITMENT: ["CREATE", "READ", "UPDATE", "DELETE"],
    HR_EMPLOYEES: ["READ"],
    HR_DEPARTMENTS: ["READ"],
    HR_DESIGNATIONS: ["READ"],

    // System
    REPORTS: ["READ"],
    UPLOAD: ["CREATE", "READ"],
  },
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Normalizes action to internal format
 * Handles VIEW -> READ and EDIT -> UPDATE mappings
 * @param action - The action to normalize
 * @returns Normalized action
 */
function normalizeAction(action: Action): Action {
  return ACTION_ALIAS_MAP[action] || action;
}

// =============================================================================
// CORE FUNCTIONS
// =============================================================================

/**
 * Validates if a given role string is a valid system role
 * @param role - The role to validate
 * @returns true if the role is valid, false otherwise
 */
export function isValidRole(role: string | undefined | null): role is Role {
  if (!role) return false;
  return VALID_ROLES.includes(role as Role);
}

/**
 * Checks if a user has permission to perform a specific action on a module
 * SuperAdmin automatically has all permissions
 *
 * @param role - User's role
 * @param module - The module to check access for
 * @param action - The action to perform (VIEW/EDIT are mapped to READ/UPDATE)
 * @returns boolean indicating if the action is permitted
 *
 * @example
 * ```ts
 * // Check if user can view items
 * hasPermission('Admin', 'ITEMS', 'VIEW')  // true
 *
 * // Check if user can delete
 * hasPermission('Accountant', 'ITEMS', 'DELETE')  // false
 * ```
 */
export function hasPermission(
  role: Role | undefined | null,
  module: Module,
  action: Action,
): boolean {
  const normalizedAction = normalizeAction(action);

  // No role = no access
  if (!role) {
    console.warn("[RBAC] Role is undefined or null");
    return false;
  }

  // Invalid role = no access
  if (!isValidRole(role)) {
    console.warn(`[RBAC] Invalid role: ${role}`);
    return false;
  }

  // SuperAdmin has all permissions
  if (role === "SuperAdmin") {
    return true;
  }

  // Get permissions for role
  const rolePermissions = PERMISSION_MATRIX[role];
  if (!rolePermissions || !rolePermissions[module]) {
    console.debug(`[RBAC] No permission for ${role} on ${module}`);
    return false;
  }

  // Check if action is allowed
  const hasAction =
    rolePermissions[module]?.includes(normalizedAction) ?? false;
  console.debug(`[RBAC] Check: ${role} + ${module} + ${action} → ${hasAction}`);

  return hasAction;
}

/**
 * Gets all allowed actions for a specific role and module
 * Returns both raw actions and aliases (VIEW, EDIT)
 *
 * @param role - User's role
 * @param module - The module to get permissions for
 * @returns Array of allowed actions including aliases
 *
 * @example
 * ```ts
 * getModulePermissions('Admin', 'ITEMS')
 * // Returns: ['CREATE', 'READ', 'UPDATE', 'DELETE', 'VIEW', 'EDIT']
 * ```
 */
export function getModulePermissions(
  role: Role | undefined | null,
  module: Module,
): Action[] {
  if (!role || !isValidRole(role)) {
    return [];
  }

  // SuperAdmin gets everything
  if (role === "SuperAdmin") {
    return ["CREATE", "READ", "UPDATE", "DELETE", "APPROVE", "VIEW", "EDIT"];
  }

  const permissions = PERMISSION_MATRIX[role]?.[module] ?? [];

  // Add aliases if READ exists
  if (permissions.includes("READ")) {
    return [...permissions, "VIEW", "EDIT"] as Action[];
  }

  return [...permissions] as Action[];
}

/**
 * Gets all permissions for a user based on their role
 * Returns module-action pairs for the entire application
 *
 * @param role - User's role
 * @returns Array of module-action pairs
 *
 * @example
 * ```ts
 * getUserPermissions('Admin')
 * // Returns: [{ module: 'ITEMS', actions: ['CREATE', 'READ', ...] }, ...]
 * ```
 */
export function getUserPermissions(
  role: Role | undefined | null,
): { module: Module; actions: Action[] }[] {
  if (!role || !isValidRole(role)) {
    return [];
  }

  // SuperAdmin gets all modules
  if (role === "SuperAdmin") {
    const modules = Object.keys(PERMISSION_MATRIX["Admin"]) as Module[];
    return modules.map((module) => ({
      module,
      actions: [
        "CREATE",
        "READ",
        "UPDATE",
        "DELETE",
        "APPROVE",
        "VIEW",
        "EDIT",
      ] as Action[],
    }));
  }

  const rolePermissions = PERMISSION_MATRIX[role];
  if (!rolePermissions) {
    return [];
  }

  return Object.entries(rolePermissions).map(([module, actions]) => ({
    module: module as Module,
    actions: actions.includes("READ")
      ? ([...actions, "VIEW", "EDIT"] as Action[])
      : ([...actions] as Action[]),
  }));
}

/**
 * Checks if a role can perform any action on a module
 * @param role - User's role
 * @param module - The module to check
 * @returns boolean indicating if user has any access
 */
export function hasAnyPermission(
  role: Role | undefined | null,
  module: Module,
): boolean {
  if (!role || !isValidRole(role)) {
    return false;
  }

  if (role === "SuperAdmin") {
    return true;
  }

  const rolePermissions = PERMISSION_MATRIX[role];
  return !!(rolePermissions && rolePermissions[module]?.length);
}

/**
 * Gets all modules a role has access to
 * @param role - User's role
 * @returns Array of accessible modules
 */
export function getAccessibleModules(role: Role | undefined | null): Module[] {
  if (!role || !isValidRole(role)) {
    return [];
  }

  if (role === "SuperAdmin") {
    return Object.keys(PERMISSION_MATRIX["Admin"]) as Module[];
  }

  const rolePermissions = PERMISSION_MATRIX[role];
  if (!rolePermissions) {
    return [];
  }

  return Object.entries(rolePermissions)
    .filter(([_, actions]) => actions && actions.length > 0)
    .map(([module]) => module as Module);
}

// =============================================================================
// FIELD-LEVEL PERMISSIONS FOR VARDHI EDIT
// =============================================================================

/**
 * Fields in the Vardhi Edit form
 */
export type VardhiField =
  // Basic Information
  | "zone_id"
  | "date"
  | "varshi_assign_by"
  | "work_type"
  | "vardhi_start_date"
  | "vardhi_end_date"
  | "location"
  // Attachments
  | "report_pdf"
  | "site_photography"
  | "site_clear_photo"
  | "other_attachment"
  // Items & Employees & Expenses
  | "vardhiItems"
  | "employeeIds"
  | "expenses"
  // Additional Items (allowed for Zone)
  | "additionalItems";

/**
 * Field-level permissions for Vardhi Edit
 * Defines which fields each role can edit
 */
export const VARDHI_FIELD_PERMISSIONS: Record<Role, VardhiField[]> = {
  SuperAdmin: [
    "zone_id",
    "date",
    "varshi_assign_by",
    "work_type",
    "vardhi_start_date",
    "vardhi_end_date",
    "location",
    "report_pdf",
    "site_photography",
    "site_clear_photo",
    "other_attachment",
    "vardhiItems",
    "employeeIds",
    "expenses",
    "additionalItems",
  ],
  Admin: [
    "zone_id",
    "date",
    "varshi_assign_by",
    "work_type",
    "vardhi_start_date",
    "vardhi_end_date",
    "location",
    "report_pdf",
    "site_photography",
    "site_clear_photo",
    "other_attachment",
    "vardhiItems",
    "employeeIds",
    "expenses",
    "additionalItems",
  ],
  Zone: [
    "location",
    "report_pdf",
    "site_photography",
    "site_clear_photo",
    "other_attachment",
    "vardhiItems",
    "additionalItems",
  ],
  Accountant: [
    "zone_id",
    "date",
    "varshi_assign_by",
    "work_type",
    "vardhi_start_date",
    "vardhi_end_date",
    "location",
    "report_pdf",
    "site_photography",
    "site_clear_photo",
    "other_attachment",
    "vardhiItems",
    "employeeIds",
    "expenses",
    "additionalItems",
  ],
  DataEntry: [
    "zone_id",
    "date",
    "varshi_assign_by",
    "work_type",
    "vardhi_start_date",
    "vardhi_end_date",
    "location",
    "report_pdf",
    "site_photography",
    "site_clear_photo",
    "other_attachment",
    "vardhiItems",
    "employeeIds",
    "expenses",
    "additionalItems",
  ],
  Supervisor: [
    "zone_id",
    "date",
    "varshi_assign_by",
    "work_type",
    "vardhi_start_date",
    "vardhi_end_date",
    "location",
    "report_pdf",
    "site_photography",
    "site_clear_photo",
    "other_attachment",
    "vardhiItems",
    "employeeIds",
    "expenses",
    "additionalItems",
  ],
  HR: [],
  Manager: [],
  Recruiter: [],
};

/**
 * Check if a role can edit a specific field in Vardhi Edit form
 * @param role - User's role
 * @param field - Field name to check
 * @returns boolean - true if field is editable
 */
export function canEditField(
  role: Role | undefined | null,
  field: VardhiField,
): boolean {
  if (!role || !isValidRole(role)) return false;
  const allowedFields = VARDHI_FIELD_PERMISSIONS[role];
  return allowedFields.includes(field);
}

/**
 * Get all editable fields for a role in Vardhi Edit form
 * @param role - User's role
 * @returns Array of editable field names
 */
export function getEditableFields(
  role: Role | undefined | null,
): VardhiField[] {
  if (!role || !isValidRole(role)) return [];
  return VARDHI_FIELD_PERMISSIONS[role] || [];
}
