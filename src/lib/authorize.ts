/**
 * =============================================================================
 * Authorization Helper Functions
 * =============================================================================
 * Server-side authorization utilities for protecting routes and API endpoints.
 * 
 * Usage:
 * - authorize(module, action) - Authorize and return user
 * - can(module, action) - Simple boolean check
 * - requireRole(...roles) - Check for specific roles
 * =============================================================================
 */

import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { prisma } from "./prisma";
import { hasPermission, isValidRole, type Module, type Action } from "./rbac";
import { Role } from "@prisma/client";

// =============================================================================
// TYPES
// =============================================================================

/**
 * Authenticated user object
 */
export interface AuthUser {
    id: string;
    email: string;
    name: string | null;
    role: Role;
    company_id: string | null;
    profile_photo: string | null;
}

// =============================================================================
// PRIVATE FUNCTIONS
// =============================================================================

/**
 * Fetch user role from database
 * Used when role is missing from session
 */
async function fetchUserRoleFromDatabase(email: string): Promise<Role | null> {
    try {
        const user = await prisma.user.findUnique({
            where: { email },
            select: { role: true }
        });

        if (!user) {
            console.warn(`[AUTH] User not found in database: ${email}`);
            return null;
        }

        return user.role as Role;
    } catch (error) {
        console.error(`[AUTH] Error fetching user role from database:`, error);
        return null;
    }
}

// =============================================================================
// PUBLIC FUNCTIONS
// =============================================================================

/**
 * Get the currently authenticated user from session
 * Automatically fetches role from database if missing
 * 
 * @throws Error if user is not authenticated
 * @returns AuthUser object
 * 
 * @example
 * ```ts
 * const user = await getAuthenticatedUser();
 * ```
 */
export async function getAuthenticatedUser(): Promise<AuthUser> {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        console.warn("[AUTH] No session found");
        throw new Error("Unauthorized: User not found in session");
    }

    const email = session.user.email ?? '';
    const id = session.user.id ?? '';
    const name = session.user.name ?? null;
    let role = session.user.role as Role | undefined;
    const company_id = session.user.company_id ?? null;
    const profile_photo = session.user.profile_photo ?? null;

    // Fetch role from database if missing or invalid
    if (!role || !isValidRole(role)) {
        console.warn(`[AUTH] Role missing/invalid in session for ${email}, fetching from DB...`);
        
        const dbRole = await fetchUserRoleFromDatabase(email);
        
        if (!dbRole) {
            console.error(`[AUTH] Could not fetch role from database for ${email}`);
            throw new Error("Forbidden: User role not found. Please contact administrator.");
        }

        role = dbRole;
    }

    return {
        id,
        email: email as string,
        name: name ?? null,
        role: role as Role,
        company_id,
        profile_photo: profile_photo ?? null
    };
}

/**
 * Authorize user for a specific module and action
 * Throws error if not authorized
 * 
 * @param module - The module to authorize
 * @param action - The action to perform (VIEW, EDIT, DELETE, CREATE)
 * @returns AuthUser if authorized
 * @throws Error if not authorized
 * 
 * @example
 * ```ts
 * // Authorize user for viewing items
 * const user = await authorize('ITEMS', 'VIEW');
 * 
 * // Authorize user for editing
 * await authorize('USERS', 'EDIT');
 * ```
 */
export async function authorize(
    module: Module, 
    action: Action
): Promise<AuthUser> {
    let user: AuthUser;

    try {
        user = await getAuthenticatedUser();
    } catch (error) {
        console.error(`[AUTH] Failed to get authenticated user:`, error);
        throw error;
    }

    if (!user.role) {
        console.error(`[AUTH] User ${user.email} has no role after authentication`);
        throw new Error("Forbidden: User role not found. Please contact administrator.");
    }

    if (!hasPermission(user.role, module, action)) {
        console.warn(`[AUTH] Forbidden - User ${user.email} [${user.role}] attempted ${module}:${action}`);
        throw new Error(`Forbidden: You don't have permission to ${action} ${module}`);
    }

    return user;
}

/**
 * Simple boolean check for permission
 * Returns true if user can perform action, false otherwise
 * 
 * @param module - The module to check
 * @param action - The action to perform
 * @returns boolean
 * 
 * @example
 * ```ts
 * const canEdit = await can('ITEMS', 'EDIT');
 * if (canEdit) {
 *   // Show edit button
 * }
 * ```
 */
export async function can(module: Module, action: Action): Promise<boolean> {
    try {
        await authorize(module, action);
        return true;
    } catch {
        return false;
    }
}

/**
 * Require specific role(s) for access
 * Throws error if user doesn't have required role
 * 
 * @param allowedRoles - Roles that are allowed
 * @returns AuthUser if authorized
 * @throws Error if role not allowed
 * 
 * @example
 * ```ts
 * // Only allow admins
 * await requireRole('Admin');
 * 
 * // Allow admin or super admin
 * await requireRole('Admin', 'SuperAdmin');
 * ```
 */
export async function requireRole(...allowedRoles: Role[]): Promise<AuthUser> {
    const user = await getAuthenticatedUser();

    if (!allowedRoles.includes(user.role)) {
        console.warn(`[AUTH] Role check failed - User ${user.email} [${user.role}] not in allowed: ${allowedRoles.join(', ')}`);
        throw new Error(`Forbidden: You don't have the required role. Required: ${allowedRoles.join(' or ')}`);
    }

    return user;
}

/**
 * Check if user has access to a specific company
 * SuperAdmin can access all companies
 * 
 * @param companyId - The company ID to check
 * @returns AuthUser if authorized
 * @throws Error if no access
 * 
 * @example
 * ```ts
 * await requireCompanyAccess('company-uuid');
 * ```
 */
export async function requireCompanyAccess(companyId: string): Promise<AuthUser> {
    const user = await getAuthenticatedUser();

    // SuperAdmin can access everything
    if (user.role === 'SuperAdmin') {
        return user;
    }

    // Check company access
    if (user.company_id !== companyId) {
        console.warn(`[AUTH] Company access denied - User ${user.email} tried to access ${companyId}`);
        throw new Error("Forbidden: You don't have access to this company");
    }

    return user;
}

/**
 * Check if current user is super admin
 * @returns boolean
 */
export async function isSuperAdmin(): Promise<boolean> {
    try {
        const user = await getAuthenticatedUser();
        return user.role === 'SuperAdmin';
    } catch {
        return false;
    }
}

/**
 * Check if current user is admin or super admin
 * @returns boolean
 */
export async function isAdmin(): Promise<boolean> {
    try {
        const user = await getAuthenticatedUser();
        return user.role === 'SuperAdmin' || user.role === 'Admin';
    } catch {
        return false;
    }
}
