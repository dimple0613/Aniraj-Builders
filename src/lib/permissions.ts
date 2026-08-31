/**
 * =============================================================================
 * Permissions Module - Central Export Point
 * =============================================================================
 * This file re-exports all permission functions from rbac.ts
 * for easy importing throughout the application.
 * 
 * Usage:
 * import { hasPermission, getModulePermissions } from '@/lib/permissions';
 * =============================================================================
 */

export { 
    type Action, 
    type Module, 
    VALID_ROLES,
    PERMISSION_MATRIX,
    isValidRole,
    hasPermission,
    getModulePermissions,
    getUserPermissions,
    hasAnyPermission,
    getAccessibleModules
} from './rbac';
