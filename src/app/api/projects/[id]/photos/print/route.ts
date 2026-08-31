import { NextRequest, NextResponse } from 'next/server';
import { puppeteerManager } from '@/lib/puppeteer-server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { getServerSession, authOptions } from '@/lib/auth';
import { errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { PDFDocument } from 'pdf-lib';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getFilePath(filePath: string): string {
    let cleanPath = filePath;

    if (!cleanPath) return '';

    if (filePath.startsWith('/api/')) {
        cleanPath = filePath.replace('/api/', '');
    } else if (filePath.startsWith('/')) {
        cleanPath = filePath.replace('/', '');
    }

    if (cleanPath.includes('?')) {
        cleanPath = cleanPath.split('?')[0];
    }

    const fullPath = resolve(process.cwd(), 'public', cleanPath);

    if (!existsSync(fullPath)) {
        console.log('File not found:', fullPath, 'from:', filePath);
    }

    return fullPath;
}

async function imageToDataUrl(filePath: string): Promise<string> {
    try {
        const fullPath = getFilePath(filePath);
        if (!fullPath || !existsSync(fullPath)) return '';

        const buffer = readFileSync(fullPath);

        let sharp: any;
        try {
            sharp = (await import('sharp')).default;
        } catch {}

        if (sharp) {
            try {
                const resized = await sharp(buffer)
                    .resize({ width: 1000, withoutEnlargement: true })
                    .jpeg({ quality: 75 })
                    .toBuffer();
                return `data:image/jpeg;base64,${resized.toString('base64')}`;
            } catch {}
        }

        const ext = fullPath.split('.').pop()?.toLowerCase() || 'jpeg';
        const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
        return `data:${mimeType};base64,${buffer.toString('base64')}`;
    } catch {
        return '';
    }
}

function getRowLayout(count: number): number[] {
    switch (count) {
        case 1: return [1];
        case 2: return [2];
        case 3: return [2, 1];
        case 4: return [2, 2];
        case 5: return [3, 2];
        case 6: return [3, 3];
        case 7: return [3, 2, 2];
        case 8: return [3, 3, 2];
        case 9: return [3, 3, 3];
        default: return [3, 3, 3];
    }
}

async function generateImageGrid(images: any[], stageName: string): Promise<string[]> {
    if (images.length === 0) return [];

    const totalImages = images.length;
    const firstPageCount = Math.min(totalImages, 9);

    const pageGroups: any[][] = [images.slice(0, firstPageCount)];
    for (let i = 9; i < totalImages; i += 9) {
        pageGroups.push(images.slice(i, Math.min(i + 9, totalImages)));
    }

    const result: string[] = [];

    for (let pageIndex = 0; pageIndex < pageGroups.length; pageIndex++) {
        const pageImages = pageGroups[pageIndex];
        const count = pageImages.length;
        const rowLayout = getRowLayout(count);

        const pageNumber = pageIndex + 1;
        const totalPageCount = pageGroups.length;
        const pageTitle = totalPageCount > 1
            ? `${stageName} (Page ${pageNumber} of ${totalPageCount})`
            : `${stageName} (${totalImages} Image${totalImages > 1 ? 's' : ''})`;

        const imageDataUrls = await Promise.all(
            pageImages.map((img: any) => imageToDataUrl(img.file_url))
        );

        let urlIdx = 0;
        const rowsHtmlParts: string[] = [];
        for (const colsInRow of rowLayout) {
            const cells: string[] = [];
            for (let c = 0; c < colsInRow && urlIdx < imageDataUrls.length; c++) {
                const att = pageImages[urlIdx];
                const dataUrl = imageDataUrls[urlIdx];
                urlIdx++;
                if (!dataUrl) {
                    cells.push('<div class="image-cell"></div>');
                    continue;
                }
                try {
                    const singleClass = count === 1 && rowLayout.length === 1 ? ' single' : '';
                    cells.push(`
                        <div class="image-cell${singleClass}">
                            <img src="${dataUrl}" alt="${att.file_name || stageName}" />
                        </div>
                    `);
                } catch (err) {
                    cells.push('<div class="image-cell"></div>');
                }
            }
            rowsHtmlParts.push(`<div class="image-row">${cells.join('')}</div>`);
        }

        const rowsHtml = rowsHtmlParts.join('');

        const titleBgStyle = 'background:#e5e7eb;padding:6px 10px;font-size:11px;font-weight:600;border:1px solid #ddd;';

        result.push(`
            <div style="${titleBgStyle}">
                <span style="font-size:11px;">${pageTitle}</span>
            </div>
            <div style="flex:1;min-height:0;border:1px solid #ddd;background:white;display:flex;">
                <div style="flex:1;display:flex;flex-direction:column;gap:8px;padding:8px;min-height:0;">
                    ${rowsHtml}
                </div>
            </div>
        `);
    }

    return result;
}

async function generateProjectPhotosPDF(photos: any[], projectName: string): Promise<Buffer | Uint8Array> {
    const stageGroups: { stageName: string; photos: any[] }[] = [];

    for (const photo of photos) {
        const stageName = photo.stage?.stage_name || 'Stage';
        const existing = stageGroups.find((g) => g.stageName === stageName);
        if (existing) {
            existing.photos.push(photo);
        } else {
            stageGroups.push({ stageName, photos: [photo] });
        }
    }

    const finalMergedPdf = await PDFDocument.create();
    let headerRendered = false;

    const htmlPages: string[] = [];

    for (const group of stageGroups) {
        const imagePages = await generateImageGrid(group.photos, group.stageName);

        for (const pageContent of imagePages) {
            const mainHeaderHtml = !headerRendered ? `
                <div style="text-align:center;margin-bottom:10px;padding-bottom:10px;border-bottom:2px solid #1e40af;">
                    <h1 style="font-size:16px;font-weight:700;color:#1e40af;margin-bottom:4px;">${projectName || 'Project Upload Image'}</h1>
                </div>
            ` : '';
            headerRendered = true;

            const fullHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>${projectName || 'Project Upload Image'}</title>
                    <style>
                        * { box-sizing: border-box; margin: 0; padding: 0; }
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                            font-size: 12px;
                            background: white;
                            width: 100%;
                            height: 100vh;
                            display: flex;
                            flex-direction: column;
                            padding: 10px;
                            overflow: hidden;
                        }
                        .image-row {
                            display: flex;
                            flex: 1;
                            gap: 8px;
                            min-height: 0;
                        }
                        .image-cell {
                            flex: 1;
                            overflow: hidden;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            background: #f8f8f8;
                            border: 1px solid #ddd;
                            border-radius: 2px;
                            min-width: 0;
                        }
                        .image-cell img {
                            width: 100%;
                            height: 100%;
                            object-fit: contain;
                            display: block;
                        }
                        .image-cell.single { border: none; background: transparent; }
                        .image-cell.single img { border: 1px solid #ddd; }
                    </style>
                </head>
                <body>
                    ${mainHeaderHtml}
                    <div style="flex:1;min-height:0;display:flex;flex-direction:column;">
                        ${pageContent}
                    </div>
                </body>
                </html>
            `;

            htmlPages.push(fullHtml);
        }
    }

    if (htmlPages.length > 0) {
        const pdfBuffers = await puppeteerManager.generateMultiplePDFFromFiles(htmlPages, {
            margin: { top: '10px', bottom: '10px', left: '10px', right: '10px' }
        });

        for (const pdfBuffer of pdfBuffers) {
            if (!pdfBuffer || pdfBuffer.length === 0) continue;
            try {
                const pagePdf = await PDFDocument.load(pdfBuffer);
                const [page] = await finalMergedPdf.copyPages(pagePdf, [0]);
                finalMergedPdf.addPage(page);
            } catch (e) {
                console.error('Skipping failed PDF page:', e);
            }
        }
    }

    const mergedBytes = await finalMergedPdf.save();
    return Buffer.from(mergedBytes);
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const url = new URL(request.url);
        const photoIdsParam = url.searchParams.get('photoIds') || '';
        const photoIds = photoIdsParam.split(',').map((s) => s.trim()).filter(Boolean);

        if (photoIds.length === 0) {
            return NextResponse.json(errorResponse('No images selected for print'), { status: 400 });
        }

        const result = await withCompany(async (company) => {
            const company_id = company?.company_id;
            const session = await getServerSession(authOptions);
            const userId = (session?.user as any)?.id;

            if (!company_id || !userId) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const project = await prisma.project.findFirst({
                where: {
                    id,
                    company_id,
                },
                select: { id: true, name: true, unique_name: true },
            });

            if (!project) {
                return NextResponse.json(errorResponse('Project not found'), { status: 404 });
            }

            const photos = await prisma.projectPhoto.findMany({
                where: {
                    id: { in: photoIds },
                    project_id: id,
                    company_id,
                },
                include: {
                    stage: true,
                },
                orderBy: { created_at: 'asc' },
            });

            if (photos.length === 0) {
                return NextResponse.json(errorResponse('No selected images found'), { status: 404 });
            }

            const pdfBuffer = await generateProjectPhotosPDF(photos, project.unique_name || project.name);

            return new NextResponse(pdfBuffer as unknown as Blob, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="project-upload-image-${id}.pdf"`,
                },
            });
        });

        if (result instanceof NextResponse) {
            return result;
        }

        return result;
    } catch (error) {
        console.error('Project photos PDF generation error:', error);
        return NextResponse.json(
            errorResponse('Failed to generate Project Upload Image PDF'),
            { status: 500 }
        );
    }
}
