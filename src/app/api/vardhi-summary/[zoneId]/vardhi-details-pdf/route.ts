import { NextRequest, NextResponse } from 'next/server';
import { puppeteerManager } from '@/lib/puppeteer-server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { errorResponse } from '@/lib/api-response';
import { existsSync } from 'fs';
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
        console.error('File not found:', fullPath, 'from:', filePath);
    }
    return fullPath;
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

function generateImageGrid(images: any[], title: string): string[] {
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
        let imgIndex = 0;
        const rowsHtml = rowLayout.map((colsInRow) => {
            const cells = [];
            for (let c = 0; c < colsInRow && imgIndex < pageImages.length; c++) {
                const att = pageImages[imgIndex];
                imgIndex++;
                const fileFullPath = getFilePath(att.file_path);
                if (!fileFullPath || !existsSync(fileFullPath)) {
                    cells.push('<div class="image-cell"></div>');
                    continue;
                }
                try {
                    const fileUrl = 'file:///' + fileFullPath.replace(/\\/g, '/');
                    const singleClass = count === 1 && rowLayout.length === 1 ? ' single' : '';
                    cells.push(`
                        <div class="image-cell${singleClass}">
                            <img src="${fileUrl}" alt="${att.file_name || title}" />
                        </div>
                    `);
                } catch {
                    cells.push('<div class="image-cell"></div>');
                }
            }
            return `<div class="image-row">${cells.join('')}</div>`;
        }).join('');
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

const LEGACY_FIELDS = [
    { field: 'report_pdf', type: 'report_pdf', label: 'Report PDF' },
    { field: 'site_photography', type: 'site_photography', label: 'Site Photography' },
    { field: 'site_clear_photo', type: 'site_clear_photo', label: 'Site Clear Photo' },
    { field: 'other_attachment', type: 'other_attachment', label: 'Other Attachment' },
];

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ zoneId: string }> }
) {
    try {
        const { zoneId } = await params;

        const result = await withCompany(async (company) => {
            const company_id = company?.company_id;
            if (!company_id) {
                return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
            }

            const zone = await prisma.zoneMaster.findFirst({
                where: { id: zoneId },
                include: {
                    vardhis: {
                        where: {
                            company_id,
                            is_in_billing: false,
                        },
                        orderBy: { vardhi_number: 'asc' },
                        include: {
                            attachments: true,
                        },
                    },
                },
            });

            if (!zone) {
                return NextResponse.json(errorResponse('Zone not found'), { status: 404 });
            }

            if (!zone.vardhis || zone.vardhis.length === 0) {
                return NextResponse.json(errorResponse('No vardhis found for this zone'), { status: 404 });
            }

            const vardhiData: {
                vardhiNumber: string;
                location: string;
                date: string;
                sitePhotographyImages: any[];
                siteClearPhotoImages: any[];
                hasAttachments: boolean;
            }[] = [];

            for (const vardhi of zone.vardhis) {
                const allAttachments: any[] = [...(vardhi.attachments || [])];

                LEGACY_FIELDS.forEach(legacy => {
                    if ((vardhi as any)[legacy.field] && !allAttachments.some(a => a.file_path === (vardhi as any)[legacy.field])) {
                        allAttachments.push({
                            type: legacy.type,
                            file_path: (vardhi as any)[legacy.field],
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
                    hasAttachments: sitePhotographyImages.length > 0 || siteClearPhotoImages.length > 0,
                });
            }

            const finalMergedPdf = await PDFDocument.create();
            let headerRendered = false;

            for (const data of vardhiData) {
                if (!data.hasAttachments) continue;

                const photographyPages = generateImageGrid(data.sitePhotographyImages, 'Site Photography');
                const clearPhotoPages = generateImageGrid(data.siteClearPhotoImages, 'Site Clear Photo');
                const allPages = [...photographyPages, ...clearPhotoPages];

                for (const pageContent of allPages) {
                    const estimationHeaderHtml = !headerRendered ? `
                        <div style="text-align:center;margin-bottom:10px;padding-bottom:10px;border-bottom:2px solid #1e40af;">
                            <h1 style="font-size:16px;font-weight:700;color:#1e40af;margin-bottom:4px;">Vardhi Details Report</h1>
                            <p style="font-size:11px;color:#666;">Zone: ${zone.name || '-'}</p>
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
                            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
                            <style>
                                * { box-sizing: border-box; margin: 0; padding: 0; }
                                body {
                                    font-family: 'Inter', 'Segoe UI', Arial, sans-serif;
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

                    const pagePdfBuffer = await puppeteerManager.generatePDF(fullHtml, { margin: { top: '10px', bottom: '10px', left: '10px', right: '10px' } });
                    const pagePdf = await PDFDocument.load(pagePdfBuffer);
                    const [page] = await finalMergedPdf.copyPages(pagePdf, [0]);
                    finalMergedPdf.addPage(page);
                }
            }

            const mergedBytes = await finalMergedPdf.save();
            const pdfBuffer = Buffer.from(mergedBytes);

            return new NextResponse(pdfBuffer as unknown as Blob, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="vardhi-details-${zone.name || zoneId}.pdf"`,
                },
            });
        });

        if (result instanceof NextResponse) {
            return result;
        }
        return result;
    } catch (error) {
        console.error('Zone Vardhi Details PDF generation error:', error);
        return NextResponse.json(
            errorResponse('Failed to generate Vardhi Details PDF'),
            { status: 500 }
        );
    }
}
