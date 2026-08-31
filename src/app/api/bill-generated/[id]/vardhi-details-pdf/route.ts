import { NextRequest, NextResponse } from 'next/server';
import { puppeteerManager } from '@/lib/puppeteer-server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { pathToFileURL } from 'url';
import { PDFDocument } from 'pdf-lib';
import { StandardFonts, rgb } from 'pdf-lib';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function drawCommonHeader(page: any, title: string, font: any) {
    const { width, height } = page.getSize();

    const margin = 30;
    const boxHeight = 25;
    const fontSize = 11;

    const boxY = height - 50;

    // ??? Draw background box
    page.drawRectangle({
        x: margin,
        y: boxY,
        width: width - (margin * 2),
        height: boxHeight,
        color: rgb(0.9, 0.9, 0.9),
        borderColor: rgb(0.8, 0.8, 0.8),
        borderWidth: 1,
    });

    // ??? Get text width (optional if you want perfect horizontal control later)
    const textWidth = font.widthOfTextAtSize(title, fontSize);

    // ??? FIX: vertical center
    const textY = boxY + (boxHeight / 2) - (fontSize / 2) + 2;

    // ??? FIX: proper left padding (consistent)
    const textX = margin + 10;

    page.drawText(title, {
        x: textX,
        y: textY,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
    });
}
const ATTACHMENT_TYPE_LABELS: Record<string, string> = {
    'site_photography': 'Site Photography',
    'site_clear_photo': 'Site Clear Photo',
    'other_attachment': 'Store Report',
    'report_pdf': 'Report PDF',
};

const LEGACY_FIELDS = [
    { field: 'report_pdf', type: 'report_pdf', label: 'Report PDF' },
    { field: 'site_photography', type: 'site_photography', label: 'Site Photography' },
    { field: 'site_clear_photo', type: 'site_clear_photo', label: 'Site Clear Photo' },
    { field: 'other_attachment', type: 'other_attachment', label: 'Other Attachment' },
];

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

async function generateImageGrid(images: any[], title: string): Promise<string[]> {
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
            ? `${title} (Page ${pageNumber} of ${totalPageCount})`
            : `${title} (${totalImages} Image${totalImages > 1 ? 's' : ''})`;

        const imageDataUrls = await Promise.all(
            pageImages.map((img: any) => imageToDataUrl(img.file_path))
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
                            <img src="${dataUrl}" alt="${att.file_name || title}" />
                        </div>
                    `);
                } catch (err) {
                    cells.push('<div class="image-cell"></div>');
                }
            }
            rowsHtmlParts.push(`<div class="image-row">${cells.join('')}</div>`);
        }

        const rowsHtml = rowsHtmlParts.join('');

        const titleBgStyle = title === 'Site Clear Photo' || title.startsWith('Site Clear Photo')
            ? 'background:#1e40af;color:white;padding:10px 15px;border-radius:6px;margin-bottom:10px;'
            : 'background:#e5e7eb;padding:6px 10px;font-size:11px;font-weight:600;border:1px solid #ddd;';

        result.push(`
            <div style="${titleBgStyle}">
                <span style="font-size:${title.startsWith('Site Clear Photo') ? '18px' : '11px'};">${pageTitle}</span>
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

async function generateVardhiDetailsPDF(vardhis: any[], estimation: any): Promise<Buffer | Uint8Array> {
    const vardhiData: {
        vardhiNumber: string;
        location: string;
        date: string;
        sitePhotographyImages: any[];
        siteClearPhotoImages: any[];
        // storeReportPdfs: Buffer[];
        // otherPdfs: Buffer[];
        hasAttachments: boolean;
    }[] = [];

    for (const vardhi of vardhis) {
        const allAttachments: any[] = [];

        const newAttachments = vardhi.attachments || [];
        allAttachments.push(...newAttachments);

        LEGACY_FIELDS.forEach(legacy => {
            if (vardhi[legacy.field] && !allAttachments.some(a => a.file_path === vardhi[legacy.field])) {
                allAttachments.push({
                    type: legacy.type,
                    file_path: vardhi[legacy.field],
                    file_name: `${legacy.label} - ${vardhi.vardhi_number || 'vardhi'}`,
                    mime_type: legacy.type === 'report_pdf' ? 'application/pdf' : 'image/jpeg',
                });
            }
        });

        const sitePhotographyImages = allAttachments.filter(a => a.type === 'site_photography' && a.file_path && existsSync(getFilePath(a.file_path)));
        const siteClearPhotoImages = allAttachments.filter(a => a.type === 'site_clear_photo' && a.file_path && existsSync(getFilePath(a.file_path)));

        vardhiData.push({
            vardhiNumber: vardhi.vardhi_number || '-',
            location: vardhi.location || '',
            date: vardhi.date ? new Date(vardhi.date).toLocaleDateString('en-GB') : '-',
            sitePhotographyImages,
            siteClearPhotoImages,
            hasAttachments: sitePhotographyImages.length > 0 || siteClearPhotoImages.length > 0
        });
    }

    const finalMergedPdf = await PDFDocument.create();
    let headerRendered = false;

    const htmlPages: string[] = [];

    for (const data of vardhiData) {

        if (!data.hasAttachments) continue;

        const photographyPages = await generateImageGrid(data.sitePhotographyImages, 'Site Photography');
        const clearPhotoPages = await generateImageGrid(data.siteClearPhotoImages, 'Site Clear Photo');
        const allPages = [...photographyPages, ...clearPhotoPages];

        for (const pageContent of allPages) {
            const estimationHeaderHtml = !headerRendered ? `
                <div style="text-align:center;margin-bottom:10px;padding-bottom:10px;border-bottom:2px solid #1e40af;">
                    <h1 style="font-size:16px;font-weight:700;color:#1e40af;margin-bottom:4px;">Vardhi Details Report</h1>
                    <p style="font-size:11px;color:#666;">Estimation: ${estimation.estimation_no || '-'} | Zone: ${estimation.zone_no || '-'} | Contractor: ${estimation.contractor || '-'}</p>
                    <p style="font-size:10px;color:#888;margin-top:3px;">Work: ${estimation.work_name || '-'}</p>
                </div>
            ` : '';
            headerRendered = true;

            const vardhiHeaderHtml = `
                <div style="background:#e5e7eb;padding:4px 8px;font-size:11px;font-weight:600;border:1px solid #ddd;text-align:center;margin-bottom:10px;">
                    <span style="font-size:11px;">Vardhi No: ${data.vardhiNumber}</span>
                    <span style="font-size:11px;font-weight:400;margin-left:4px;">Date: ${data.date}</span>
                </div>
            `;

            const fullHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="UTF-8">
                    <title>Vardhi ${data.vardhiNumber}</title>
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
                    ${estimationHeaderHtml}
                    ${vardhiHeaderHtml}
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

        const result = await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const estimation = await prisma.vardhiEstimation.findFirst({
                where: { id, company_id },
                include: {
                    vardhis: {
                        orderBy: { vardhi_number: 'asc' },
                        include: {
                            attachments: true
                        }
                    },
                },
            });

            if (!estimation) {
                return NextResponse.json(errorResponse('Estimation not found'), { status: 404 });
            }

            if (!estimation.vardhis || estimation.vardhis.length === 0) {
                return NextResponse.json(errorResponse('No vardhis found for this estimation'), { status: 404 });
            }

            console.log('Generating PDF for vardhis:', estimation.vardhis.map(v => ({
                id: v.id,
                vardhi_number: v.vardhi_number,
                attachments_count: v.attachments?.length || 0,
                attachments: v.attachments?.map(a => ({ type: a.type, file_path: a.file_path })) || [],
                legacy_fields: {
                    report_pdf: v.report_pdf,
                    site_photography: v.site_photography,
                    site_clear_photo: v.site_clear_photo,
                    other_attachment: v.other_attachment
                }
            })));

            const pdfBuffer = await generateVardhiDetailsPDF(estimation.vardhis, estimation);

            return new NextResponse(pdfBuffer as unknown as Blob, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="vardhi-details-${estimation.estimation_no || id}.pdf"`,
                },
            });
        });

        if (result instanceof NextResponse) {
            return result;
        }

        return result;
    } catch (error) {
        console.error('Vardhi Details PDF generation error:', error);
        return NextResponse.json(
            errorResponse('Failed to generate Vardhi Details PDF'),
            { status: 500 }
        );
    }
}
