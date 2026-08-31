const SIZE_REGEX = /^[0-9]+(\.[0-9]+)?(x[0-9]+(\.[0-9]+)?)*$/;

export function normalizeSize(input: string | null | undefined): string {
    if (!input) return "";
    const normalized = input
        .replace(/\*/g, "x")
        .replace(/X/g, "x")
        .trim();
    return normalized;
}

export function validateSize(input: string | null | undefined): boolean {
    if (!input) return false;
    const normalized = normalizeSize(input);
    if (!normalized) return false;
    return SIZE_REGEX.test(normalized);
}

export function calculateSizeFromString(sizeStr: string | null | undefined): number {
    if (!sizeStr) return 0;
    const normalized = normalizeSize(sizeStr);
    if (!normalized) return 0;
    if (normalized === "90") {
        return 90;
    }
    if (normalized.includes("x")) {
        const parts = normalized.split("x").map((num) => parseFloat(num.trim()));
        if (parts.some((num) => isNaN(num))) return 0;
        if (parts.some((num) => num === 0)) return 0;
        if (parts.length > 0 && parts.every((num) => num > 0)) {
            return parts.reduce((acc, num) => acc * num, 1);
        }
    }
    return parseFloat(normalized) || 0;
}

export const SIZE_ERROR_MESSAGE = "Invalid size format. Use numbers, decimals, and 'x' only (e.g., 1.5, 10x12, 1.5x2.5)";