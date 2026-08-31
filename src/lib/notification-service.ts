/**
 * =============================================================================
 * Notification Service
 * =============================================================================
 * Centralized service for creating notifications for SuperAdmin users.
 *
 * Features:
 * - Logs all user actions (Create, Update, Delete)
 * - Only SuperAdmin receives notifications (targetRole: SuperAdmin)
 * - Includes entity, action, user, timestamp, and optional link
 *
 * Also logs activities to the Activity table for audit trail.
 *
 * Usage:
 * - createNotification(action, entity, entityId, userId, message, link)
 * - Used in API routes after successful operations
 * =============================================================================
 */

import { prisma } from '@/lib/prisma';
import { logActivity } from './activityLogger';

// Notification types
export type NotificationType = 'INFO' | 'WARNING' | 'SUCCESS' | 'ERROR';

export interface CreateNotificationParams {
    action: 'Created' | 'Updated' | 'Deleted';
    entity: string;
    entityId?: string;
    entityName?: string; // Name of the entity (e.g., unit name)
    message?: string; // Optional: custom message overrides auto-built message
    userId?: string; // User who performed the action
    userName?: string; // Optional: pass user name to avoid extra DB call
    link?: string; // Optional link to view the record
    type?: NotificationType;
    targetRole?: 'SuperAdmin' | 'Admin' | 'Accountant' | 'DataEntry' | 'Supervisor' | 'Zone';
}

/**
 * Check if notification should be created for this user role
 * SuperAdmin actions should NOT generate notifications
 */
export function shouldNotify(userRole?: string | null): boolean {
    return userRole !== 'SuperAdmin';
}

/**
 * Create a notification for SuperAdmin users
 * This function is called after successful CRUD operations
 * 
 * @param params - Notification parameters
 * @returns Created notification or null
 */
export async function createNotification(params: CreateNotificationParams): Promise<any> {
    try {
        const {
            action,
            entity,
            entityId,
            entityName,
            userId,
            userName,
            link,
            type = 'INFO' as NotificationType,
            targetRole = 'SuperAdmin',
        } = params;

        // Skip notification if user is SuperAdmin
        if (userId) {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { role: true },
            });
            if (user && !shouldNotify(user.role)) {
                return null; // Don't create notification for SuperAdmin
            }
        }

        // Build the notification message
        let message = params.message || '';
        
        if (!message) {
            const entityDisplay = entityName ? `${entity} "${entityName}"` : entity;
            
            if (userName) {
                message = `${userName} ${action.toLowerCase()} ${entityDisplay}`;
            } else if (userId) {
                // Fetch user name if not provided
                const user = await prisma.user.findUnique({
                    where: { id: userId },
                    select: { name: true },
                });
                message = `${user?.name || 'A user'} ${action.toLowerCase()} ${entityDisplay}`;
            } else {
                message = `A ${entityDisplay} was ${action.toLowerCase()}`;
            }
        }

        const notification = await prisma.notification.create({
            data: {
                userId,
                targetRole: targetRole as any,
                type,
                entity,
                action,
                entityId,
                message,
                link,
                isRead: false,
            },
        });

        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        return null;
    }
}

/**
 * Create multiple notifications (for bulk operations)
 */
export async function createBulkNotifications(notifications: CreateNotificationParams[]): Promise<void> {
    try {
        const data = await Promise.all(
            notifications.map(params => createNotification(params))
        );
    } catch (error) {
        console.error('Error creating bulk notifications:', error);
    }
}

/**
 * Helper to get user name from session or userId
 */
export async function getUserName(userId?: string): Promise<string> {
    if (!userId) return 'A user';
    
    try {
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { name: true },
        });
        return user?.name || 'A user';
    } catch {
        return 'A user';
    }
}
