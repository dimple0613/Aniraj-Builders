/**
 * =============================================================================
 * Zone-Based Data Filtering Helper
 * =============================================================================
 * Centralized helper for applying zone-based filtering to database queries.
 * Users with role "Zone" can only see data related to their assigned zone.
 *
 * Usage:
 *   const query = applyZoneFilter({ where: { company_id } }, user);
 *   const data = await prisma.someModel.findMany(query);
 * =============================================================================
 */

import { Role } from "@prisma/client";

export interface ZoneFilterUser {
    role: Role;
    zone_id: string | null;
}

/**
 * Apply zone-based filtering to a Prisma query
 * If user has Zone role, restrict data to their zone only
 * Admin and SuperAdmin see all data (no filtering)
 *
 * @param query - The Prisma query object with where clause
 * @param user - The authenticated user object
 * @returns Modified query with zone filter applied if needed
 *
 * @example
 * ```ts
 * // Before query
 * const where = { company_id: user.company_id };
 *
 * // Apply zone filter
 * const query = applyZoneFilter({ where }, user);
 *
 * // Execute query
 * const data = await prisma.vardhi.findMany(query);
 * ```
 */
export function applyZoneFilter<T extends { where?: any }>(
    query: T,
    user: ZoneFilterUser
): T {
    // Only apply filter for Zone role users
    if (user.role === "Zone" && user.zone_id) {
        return {
            ...query,
            where: {
                ...query.where,
                zone_id: user.zone_id,
            },
        };
    }

    // Admin, SuperAdmin, and other roles see all data
    return query;
}

/**
 * Create a where clause that includes zone filtering
 * Useful for simpler cases where you just need the where clause
 *
 * @param baseWhere - Base where conditions
 * @param user - The authenticated user object
 * @returns Where clause with zone filter applied if needed
 */
export function createZoneWhereClause(
    baseWhere: any,
    user: ZoneFilterUser
): any {
    if (user.role === "Zone" && user.zone_id) {
        return {
            ...baseWhere,
            zone_id: user.zone_id,
        };
    }
    return baseWhere;
}
