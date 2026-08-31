import { mkdir } from 'fs/promises';
import { existsSync } from 'fs';

export async function ensureDir(dirPath: string): Promise<void> {
    if (!existsSync(dirPath)) {
        await mkdir(dirPath, { recursive: true });
    }
}
