export function naturalCompare(a: string, b: string): number {
    const partsA = a.match(/\d+|[^\d]+/g) || [];
    const partsB = b.match(/\d+|[^\d]+/g) || [];

    const maxLen = Math.max(partsA.length, partsB.length);

    for (let i = 0; i < maxLen; i++) {
        if (i >= partsA.length) return -1;
        if (i >= partsB.length) return 1;

        const partA = partsA[i];
        const partB = partsB[i];

        const numA = parseInt(partA, 10);
        const numB = parseInt(partB, 10);

        if (!isNaN(numA) && !isNaN(numB)) {
            if (numA !== numB) return numA - numB;
        } else {
            const cmp = partA.localeCompare(partB, undefined, { sensitivity: 'base' });
            if (cmp !== 0) return cmp;
        }
    }

    return 0;
}

export interface EstimateItem {
    ay?: {
        ay_no?: string | null;
    } | null;
    ay_id?: string | null;
}

export function sortEstimateItems<T extends EstimateItem>(
    items: T[],
    key: keyof T = "ay" as keyof T
): T[] {
    return [...items].sort((a, b) => {
        const aValue = key === "ay" 
            ? (a.ay?.ay_no ?? a.ay_id ?? "") 
            : String(a[key] ?? "");
        const bValue = key === "ay" 
            ? (b.ay?.ay_no ?? b.ay_id ?? "") 
            : String(b[key] ?? "");

        return naturalCompare(aValue, bValue);
    });
}

export { naturalCompare as compareEstimateItems };
