/**
 * Date utilities for HRMS modules.
 *
 * Root cause of the "one day off" bug:
 * PostgreSQL `timestamp` (no tz) columns store dates as-is.
 * The pg driver reads them back and creates JS Date objects using *local*
 * server time (no "Z" suffix). JSON.stringify then converts to UTC ISO,
 * shifting the date by the server's UTC offset.
 *
 * Example (server in IST, UTC+5:30):
 *   Stored:  "2026-07-02 00:00:00"
 *   pg reads as local: new Date("2026-07-02 00:00:00") → +05:30
 *   JSON:    "2026-07-01T18:30:00.000Z"
 *   .split('T')[0] → "2026-07-01"  ← WRONG
 *
 * Fix: Always extract date components using the browser's local timezone
 * methods (getDate/getMonth/getFullYear), which match the server's local
 * timezone when they're co-located (typical for this app).
 */

/** Safely convert an API ISO date string to YYYY-MM-DD for <input type="date">. */
export function toDateInputValue(apiDateStr: string | null | undefined): string {
    if (!apiDateStr) return '';
    const d = new Date(apiDateStr);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/** Format a date string for display (e.g. "Jul 2, 2026"). */
export function formatDateDisplay(
    dateStr: string | null | undefined,
    locale: string = 'en-US',
    options?: Intl.DateTimeFormatOptions,
): string {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString(locale, options ?? {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

/** Parse a YYYY-MM-DD string into a Date at UTC midnight. Use in API routes. */
export function parseDateOnly(dateStr: string): Date {
    return new Date(dateStr + 'T00:00:00.000Z');
}
