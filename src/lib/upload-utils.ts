export function toClientFileUrl(path: string | null | undefined): string {
    if (!path) return '';

    if (path.startsWith('http://') || path.startsWith('https://')) {
        return path;
    }

    // Files written under public/uploads at runtime are not served by production
    // builds (Next.js only serves public assets that existed at build time).
    // Uploaded files must therefore be served through /api/uploads/[...path],
    // which streams them from disk at request time.
    if (path.startsWith('/uploads/')) {
        return `/api/uploads${path.substring('/uploads'.length)}`;
    }

    return path;
}

export function getUploadUrl(path: string, options?: { bustCache?: boolean }): string {
    const clientUrl = toClientFileUrl(path);
    if (!clientUrl) return '';

    if (options?.bustCache) {
        const timestamp = Date.now();
        const separator = clientUrl.includes('?') ? '&' : '?';
        return `${clientUrl}${separator}_t=${timestamp}`;
    }

    return clientUrl;
}

export function getVardhiAttachmentUrl(path: string | null | undefined, options?: { bustCache?: boolean }): string {
    if (!path) return '';
    return getUploadUrl(path, options);
}

export function isImageFile(path: string): boolean {
    if (!path) return false;
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
    const ext = path.split('.').pop()?.toLowerCase() || '';
    return imageExtensions.includes(`.${ext}`);
}

export function getFileExtension(filename: string): string {
    return filename.split('.').pop()?.toLowerCase() || '';
}

export function isAllowedImageType(filename: string): boolean {
    const allowedExtensions = ['jpg', 'jpeg', 'png'];
    const ext = getFileExtension(filename);
    return allowedExtensions.includes(ext);
}
