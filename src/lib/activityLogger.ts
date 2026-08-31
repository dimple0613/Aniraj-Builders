/**
 * =============================================================================
 * Activity Logger Service
 * =============================================================================
 * Centralized service for logging user activities across the application.
 *
 * Features:
 * - Logs all CRUD actions (CREATE, UPDATE, DELETE) to Activity table
 * - Stores metadata for audit trail (previous values, changes)
 * - Never deletes activity records (persistent audit log)
 * - Multi-tenant safe (companyId filtering)
 *
 * Usage:
 * - logActivity(params) for manual logging
 * - createActivityLog() wrapper for standardized logging
 *
 * Data Integrity:
 * - Activities are NEVER deleted from database
 * - Even if entity is deleted, activity remains
 * - Metadata stores previous values for audit trail
 * =============================================================================
 */

import { prisma } from '@/lib/prisma';
import { ActionType } from '@prisma/client';

export interface ActivityLogParams {
    companyId: string;
    userId: string;
    entityType: string; // "project", "invoice", "user", "vardhi", etc.
    entityId: string;
    action: ActionType;
    title: string;
    message: string;
    metadata?: Record<string, any> | null;
}

/**
 * Log an activity to the Activity table
 * This function is called after successful CRUD operations
 *
 * @param params - Activity parameters
 * @returns Created activity or null
 *
 * @example
 * ```ts
 * // After creating a Project
 * await logActivity({
 *   companyId: user.companyId,
 *   userId: user.id,
 *   entityType: 'project',
 *   entityId: project.id,
 *   action: 'CREATE',
 *   title: 'Project created',
 *   message: `${project.name} was created`,
 *   metadata: { project }
 * });
 * ```
 */
export async function logActivity(params: ActivityLogParams): Promise<any> {
    try {
        const {
            companyId,
            userId,
            entityType,
            entityId,
            action,
            title,
            message,
            metadata,
        } = params;

        const activity = await prisma.activity.create({
            data: {
                companyId,
                userId,
                entityType,
                entityId,
                action,
                title,
                message,
                metadata: metadata || undefined,
            },
        });

        return activity;
    } catch (error) {
        console.error('Error logging activity:', error);
        // Don't throw - activity logging shouldn't break the main operation
        return null;
    }
}

/**
 * Helper to create standardized activity log for CREATE action
 */
export async function logCreateActivity(params: {
    companyId: string;
    userId: string;
    entityType: string;
    entityId: string;
    entityName: string;
    metadata?: Record<string, any> | null;
}): Promise<any> {
    const { entityType, entityName, ...rest } = params;
    return logActivity({
        ...rest,
        entityType,
        action: 'CREATE',
        title: `${capitalize(entityType)} created`,
        message: `${entityName} was created`,
        metadata: params.metadata,
    });
}

/**
 * Helper to create standardized activity log for UPDATE action
 * Stores previous values in metadata for audit trail
 */
export async function logUpdateActivity(params: {
    companyId: string;
    userId: string;
    entityType: string;
    entityId: string;
    entityName: string;
    oldValues: Record<string, any>;
    newValues: Record<string, any>;
}): Promise<any> {
    const { entityType, entityName, oldValues, newValues, ...rest } = params;
    return logActivity({
        ...rest,
        entityType,
        action: 'UPDATE',
        title: `${capitalize(entityType)} updated`,
        message: `${entityName} was updated`,
        metadata: {
            old: oldValues,
            updated: newValues,
        },
    });
}

/**
 * Helper to create standardized activity log for DELETE action
 * Does NOT delete the activity record - maintains audit trail
 */
export async function logDeleteActivity(params: {
    companyId: string;
    userId: string;
    entityType: string;
    entityId: string;
    entityName: string;
    metadata?: Record<string, any> | null;
}): Promise<any> {
    const { entityType, entityName, ...rest } = params;
    return logActivity({
        ...rest,
        entityType,
        action: 'DELETE',
        title: `${capitalize(entityType)} deleted`,
        message: `${entityName} was deleted`,
        metadata: params.metadata,
    });
}

/**
 * Helper to capitalize first letter of a string
 */
function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Fetch activities with filtering and pagination
 */
export async function getActivities(params: {
    companyId?: string;
    entityType?: string;
    entityId?: string;
    action?: ActionType;
    userId?: string;
    isRead?: boolean;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
}): Promise<any[]> {
    try {
        const {
            companyId,
            entityType,
            entityId,
            action,
            userId,
            isRead,
            startDate,
            endDate,
            page = 1,
            limit = 50,
        } = params;

        const where: any = {};

        if (companyId) where.companyId = companyId;
        if (entityType) where.entityType = entityType;
        if (entityId) where.entityId = entityId;
        if (action) where.action = action;
        if (userId) where.userId = userId;
        if (isRead !== undefined) where.isRead = isRead;

        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate) where.createdAt.gte = startDate;
            if (endDate) where.createdAt.lte = endDate;
        }

        const activities = await prisma.activity.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
            include: {
                user: {
                    select: { id: true, name: true, email: true },
                },
                company: {
                    select: { id: true, company_name: true },
                },
            },
        });

        return activities;
    } catch (error) {
        console.error('Error fetching activities:', error);
        return [];
    }
}

/**
 * Mark activity as read
 */
export async function markActivityAsRead(activityId: string): Promise<boolean> {
    try {
        await prisma.activity.update({
            where: { id: activityId },
            data: { isRead: true },
        });
        return true;
    } catch (error) {
        console.error('Error marking activity as read:', error);
        return false;
    }
}

/**
 * Mark all activities as read for a company
 */
export async function markAllActivitiesAsRead(companyId: string): Promise<boolean> {
    try {
        await prisma.activity.updateMany({
            where: {
                companyId,
                isRead: false,
            },
            data: { isRead: true },
        });
        return true;
    } catch (error) {
        console.error('Error marking all activities as read:', error);
        return false;
    }
}
