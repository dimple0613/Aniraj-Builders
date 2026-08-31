"use client";

/**
 * =============================================================================
 * useHasPermission Hook - Client-side Permission Checking
 * =============================================================================
 * This hook provides easy permission checking in client components.
 * It uses the session to get the user's role and checks permissions.
 * 
 * Usage:
 * const canEdit = useHasPermission('ITEMS', 'EDIT');
 * const canDelete = useHasPermission('USERS', 'DELETE');
 * 
 * Returns:
 * - boolean: true if user has permission, false otherwise
 * =============================================================================
 */

import { useSession } from 'next-auth/react';
import { Role } from '@prisma/client';
import { hasPermission, type Action, type Module } from '@/lib/permissions';

interface UseHasPermissionOptions {
    /** Default value if session is loading */
    defaultValue?: boolean;
}

/**
 * Hook to check if current user has permission for a specific action
 * @param module - The module to check
 * @param action - The action to perform (VIEW, EDIT, DELETE, CREATE)
 * @param options - Additional options
 * @returns boolean indicating permission status
 */
export function useHasPermission(
    module: Module, 
    action: Action,
    options: UseHasPermissionOptions = {}
) {
    const { defaultValue = false } = options;
    const { data: session, status } = useSession();

    // Still loading - return default
    if (status === 'loading') {
        return defaultValue;
    }

    // No session - no permission
    if (!session?.user) {
        return false;
    }

    // Get role from session
    const role = (session.user as any).role as Role | undefined;

    // No role - no permission
    if (!role) {
        return false;
    }

    // Check permission
    return hasPermission(role, module, action);
}

/**
 * Hook to get all permissions for current user
 * Useful for rendering UI based on multiple permissions
 * @returns Array of module-action pairs or null if not logged in
 */
export function useUserPermissions() {
    const { data: session, status } = useSession();

    if (status === 'loading' || !session?.user) {
        return null;
    }

    const role = (session.user as any).role as Role | undefined;
    
    if (!role) {
        return null;
    }

    // Import dynamically to avoid server-side issues
    const { getUserPermissions } = require('@/lib/permissions');
    return getUserPermissions(role);
}

/**
 * Hook to check if user can access a specific module
 * @param module - The module to check
 * @returns boolean indicating if user has any access
 */
export function useCanAccess(module: Module): boolean {
    const { data: session, status } = useSession();

    if (status === 'loading' || !session?.user) {
        return false;
    }

    const role = (session.user as any).role as Role | undefined;
    
    if (!role) {
        return false;
    }

    const { hasAnyPermission } = require('@/lib/permissions');
    return hasAnyPermission(role, module);
}

/**
 * Hook to get accessible modules for current user
 * Useful for dynamic navigation
 * @returns Array of accessible modules or null
 */
export function useAccessibleModules() {
    const { data: session, status } = useSession();

    if (status === 'loading' || !session?.user) {
        return null;
    }

    const role = (session.user as any).role as Role | undefined;
    
    if (!role) {
        return null;
    }

    const { getAccessibleModules } = require('@/lib/permissions');
    return getAccessibleModules(role);
}
