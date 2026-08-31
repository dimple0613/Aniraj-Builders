/**
 * =============================================================================
 * Utils - Common Utility Functions
 * =============================================================================
 */

// Classname utility for Tailwind
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind classes with proper precedence
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

/**
 * Chunk an array into groups of specified size
 * @param array - The array to chunk
 * @param size - The size of each chunk
 * @returns Array of arrays
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
    if (!array || array.length === 0) return [];
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}
