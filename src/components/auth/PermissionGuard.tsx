"use client";

/**
 * =============================================================================
 * PermissionGuard Component
 * =============================================================================
 * Client component that conditionally renders children based on permissions.
 * 
 * Usage:
 * <PermissionGuard module="ITEMS" action="CREATE">
 *   <Button>Add Item</Button>
 * </PermissionGuard>
 * 
 * Or use 'hide' mode to remove from DOM:
 * <PermissionGuard module="ITEMS" action="DELETE" hide>
 *   <Button>Delete</Button>
 * </PermissionGuard>
 * =============================================================================
 */

import { useHasPermission } from '@/hooks/use-has-permission';
import type { Action, Module } from '@/lib/permissions';

interface PermissionGuardProps {
    /** The module to check permission for */
    module: Module;
    /** The action to check (VIEW, EDIT, DELETE, CREATE) */
    action: Action;
    /** Children to render if user has permission */
    children: React.ReactNode;
    /** If true, renders null instead of children when no permission */
    fallback?: React.ReactNode;
    /** If true, uses CSS display:none instead of not rendering */
    hide?: boolean;
}

/**
 * Component that conditionally renders children based on user permissions
 */
export function PermissionGuard({
    module,
    action,
    children,
    fallback = null,
    hide = false
}: PermissionGuardProps) {
    const hasPermission = useHasPermission(module, action);

    if (!hasPermission) {
        if (hide) {
            return (
                <span style={{ display: 'none' }}>
                    {fallback}
                </span>
            );
        }
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

/**
 * =============================================================================
 * Convenience Components
 * =============================================================================
 * Pre-built components for common permission checks
 * =============================================================================
 */

interface CanViewProps {
    module: Module;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/** Shorthand for VIEW permission */
export function CanView({ module, children, fallback = null }: CanViewProps) {
    return (
        <PermissionGuard module={module} action="VIEW" fallback={fallback}>
            {children}
        </PermissionGuard>
    );
}

interface CanCreateProps {
    module: Module;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/** Shorthand for CREATE permission */
export function CanCreate({ module, children, fallback = null }: CanCreateProps) {
    return (
        <PermissionGuard module={module} action="CREATE" fallback={fallback}>
            {children}
        </PermissionGuard>
    );
}

interface CanEditProps {
    module: Module;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/** Shorthand for EDIT permission */
export function CanEdit({ module, children, fallback = null }: CanEditProps) {
    return (
        <PermissionGuard module={module} action="EDIT" fallback={fallback}>
            {children}
        </PermissionGuard>
    );
}

interface CanDeleteProps {
    module: Module;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/** Shorthand for DELETE permission */
export function CanDelete({ module, children, fallback = null }: CanDeleteProps) {
    return (
        <PermissionGuard module={module} action="DELETE" fallback={fallback}>
            {children}
        </PermissionGuard>
    );
}

/**
 * Wrapper for multiple permissions (all must pass)
 */
interface CanAllProps {
    permissions: Array<{ module: Module; action: Action }>;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export function CanAll({ permissions, children, fallback = null }: CanAllProps) {
    const hasAllPermission = permissions.every(
        ({ module, action }) => useHasPermission(module, action)
    );

    if (!hasAllPermission) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}

/**
 * Wrapper for multiple permissions (at least one must pass)
 */
interface CanAnyProps {
    permissions: Array<{ module: Module; action: Action }>;
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

export function CanAny({ permissions, children, fallback = null }: CanAnyProps) {
    const hasAnyPermission = permissions.some(
        ({ module, action }) => useHasPermission(module, action)
    );

    if (!hasAnyPermission) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
}
