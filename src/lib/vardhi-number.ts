import { prisma } from './prisma';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDateDDMonYY(date: Date): string {
    const day = date.getDate().toString().padStart(2, '0');
    const month = MONTHS[date.getMonth()];
    const year = date.getFullYear().toString().slice(-2);
    return `${day}${month}${year}`;
}

export async function getNextZoneSequence(zoneId: string, tx: any, excludeVardhiId?: string): Promise<number> {
    const where: any = { zone_id: zoneId };
    if (excludeVardhiId) {
        where.id = { not: excludeVardhiId };
    }
    const vardhis = await tx.vardhi.findMany({
        where,
        select: { is_in_billing: true, global_sequence: true },
        orderBy: { global_sequence: 'desc' },
    });

    if (vardhis.length === 0 || vardhis.every((v: any) => v.is_in_billing === true)) {
        return 1;
    }

    const maxSequence = Math.max(...vardhis.map((v: any) => v.global_sequence), 0);
    return maxSequence + 1;
}

export async function getDailyIndex(zoneId: string, date: Date, tx: any): Promise<number> {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

    const vardhis = await tx.vardhi.findMany({
        where: {
            zone_id: zoneId,
            date: {
                gte: startOfDay,
                lt: endOfDay
            }
        },
        select: { vardhi_number: true }
    });

    let maxDailyIndex = 0;
    for (const v of vardhis) {
        const parts = v.vardhi_number.split('//');
        if (parts.length >= 4) {
            const idx = parseInt(parts[2], 10);
            if (!isNaN(idx) && idx > maxDailyIndex) {
                maxDailyIndex = idx;
            }
        }
    }

    return maxDailyIndex + 1;
}

export async function getNextDailyIndexForDate(zoneId: string, date: Date, tx: any, excludeVardhiId?: string): Promise<number> {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);

    const where: any = {
        zone_id: zoneId,
        date: { gte: startOfDay, lt: endOfDay }
    };
    if (excludeVardhiId) {
        where.id = { not: excludeVardhiId };
    }

    const vardhis = await tx.vardhi.findMany({
        where,
        select: { vardhi_number: true }
    });

    let maxDailyIndex = 0;
    for (const v of vardhis) {
        const parts = v.vardhi_number.split('//');
        if (parts.length >= 4) {
            const idx = parseInt(parts[2], 10);
            if (!isNaN(idx) && idx > maxDailyIndex) {
                maxDailyIndex = idx;
            }
        }
    }

    return maxDailyIndex + 1;
}

export async function generateVardhiNumber(
    companyId: string,
    zoneId: string,
    date: Date,
    tx?: any
): Promise<{ vardhiNumber: string; globalSequence: number; dailyIndex: number }> {
    const useTransaction = tx !== undefined;
    const prismaTx = useTransaction ? tx : prisma;

    const zone = await prismaTx.zoneMaster.findUnique({
        where: { id: zoneId },
        select: { name: true }
    });

    if (!zone) {
        throw new Error('Zone not found');
    }

    const datePrefix = formatDateDDMonYY(date);
    const zoneName = zone.name.replace(/\s+/g, '').toUpperCase();

    const [zoneSequence, dailyIndex] = await Promise.all([
        getNextZoneSequence(zoneId, prismaTx),
        getDailyIndex(zoneId, date, prismaTx)
    ]);

    const dailyIndexStr = dailyIndex.toString().padStart(2, '0');
    const zoneSequenceStr = zoneSequence.toString().padStart(2, '0');

    const vardhiNumber = `${datePrefix}//${zoneName}//${dailyIndexStr}//${zoneSequenceStr}`;

    return {
        vardhiNumber,
        globalSequence: zoneSequence,
        dailyIndex
    };
}

export async function regenerateVardhiNumber(
    zoneId: string,
    date: Date,
    globalSequence: number,
    existingDailyIndex: number,
    updateGlobalSeq: any,
    tx?: any
): Promise<{ vardhiNumber: string; globalSequence: number; dailyIndex: number }> {
    const useTransaction = tx !== undefined;
    const prismaTx = useTransaction ? tx : prisma;

    const zone = await prismaTx.zoneMaster.findUnique({
        where: { id: zoneId },
        select: { name: true }
    });

    if (!zone) {
        throw new Error('Zone not found');
    }

    const datePrefix = formatDateDDMonYY(date);
    const zoneName = zone.name.replace(/\s+/g, '').toUpperCase();
    const dailyIndexStr = existingDailyIndex.toString().padStart(2, '0');
    var zoneSequenceStr = globalSequence.toString().padStart(2, '0');
    if (updateGlobalSeq) {
        const [zoneSequence, dailyIndex] = await Promise.all([
            getNextZoneSequence(zoneId, prismaTx),
            getDailyIndex(zoneId, date, prismaTx)
        ]);
        zoneSequenceStr = zoneSequence.toString().padStart(2, '0');
        globalSequence = zoneSequence;
        existingDailyIndex = dailyIndex;
    }
    const vardhiNumber = `${datePrefix}//${zoneName}//${dailyIndexStr}//${zoneSequenceStr}`;
    return {
        vardhiNumber,
        globalSequence: globalSequence,
        dailyIndex: existingDailyIndex
    };

}

export function parseVardhiNumber(vardhiNumber: string): {
    datePrefix: string;
    zone: string;
    dailyIndex: number;
    globalSequence: number;
} | null {
    const parts = vardhiNumber.split('//');
    if (parts.length !== 4) {
        return null;
    }

    return {
        datePrefix: parts[0],
        zone: parts[1],
        dailyIndex: parseInt(parts[2], 10),
        globalSequence: parseInt(parts[3], 10)
    };
}
