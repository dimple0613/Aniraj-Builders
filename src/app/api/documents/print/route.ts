import { NextRequest, NextResponse } from 'next/server';
import { puppeteerManager } from '@/lib/puppeteer-server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
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

    return resolve(process.cwd(), 'public', cleanPath);
}

async function fileToDataUrl(filePath: string, isPdf: boolean): Promise<string> {
    try {
        const fullPath = getFilePath(filePath);
        if (!fullPath || !existsSync(fullPath)) return '';

        const buffer = readFileSync(fullPath);

        if (isPdf) {
            return `data:application/pdf;base64,${buffer.toString('base64')}`;
        }

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

function getFileExtension(filePath: string): string {
    const cleanPath = (filePath || '').split('?')[0];
    return cleanPath.split('.').pop()?.toLowerCase() || '';
}

async function generateDocumentsPrintPDF(documents: any[]): Promise<Buffer> {
    const htmlPages: string[] = [];

    for (const doc of documents) {
        if (!doc.file) continue;

        const isPdf = getFileExtension(doc.file) === 'pdf';
        const dataUrl = await fileToDataUrl(doc.file, isPdf);

        if (!dataUrl) continue;

        const docName = doc.document_name || 'Document';

        const content = isPdf
            ? `<embed class="document-pdf" src="${dataUrl}" type="application/pdf" />`
            : `<div class="image-cell single"><img src="${dataUrl}" alt="${docName}" /></div>`;

        const fullHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>${docName}</title>
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
                    .doc-title-bar {
                        background: #e5e7eb;
                        padding: 6px 10px;
                        font-size: 12px;
                        font-weight: 600;
                        border: 1px solid #ddd;
                        text-align: center;
                        margin-bottom: 10px;
                    }
                    .doc-content {
                        flex: 1;
                        min-height: 0;
                        border: 1px solid #ddd;
                        background: white;
                        display: flex;
                        flex-direction: column;
                    }
                    .image-cell {
                        flex: 1;
                        overflow: hidden;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        background: #f8f8f8;
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
                    .document-pdf {
                        width: 100%;
                        height: 100%;
                        border: none;
                    }
                </style>
            </head>
            <body>
                <div class="doc-title-bar">${docName}</div>
                <div class="doc-content">${content}</div>
            </body>
            </html>
        `;

        htmlPages.push(fullHtml);
    }

    if (htmlPages.length === 0) {
        throw new Error('NO_DOCUMENTS');
    }

    const pdfBuffers = await puppeteerManager.generateMultiplePDFFromFiles(htmlPages, {
        margin: { top: '10px', bottom: '10px', left: '10px', right: '10px' }
    });

    const finalMergedPdf = await PDFDocument.create();

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

    const mergedBytes = await finalMergedPdf.save();
    return Buffer.from(mergedBytes);
}

export async function GET(
    request: NextRequest,
) {
    try {
        const { searchParams } = new URL(request.url);
        const idsParam = searchParams.get('ids');
        if (!idsParam) {
            return NextResponse.json(errorResponse('No documents selected'), { status: 400 });
        }

        const ids = idsParam.split(',').map((id) => id.trim()).filter(Boolean);
        if (ids.length === 0) {
            return NextResponse.json(errorResponse('No documents selected'), { status: 400 });
        }

        const result = await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const documents = await prisma.document.findMany({
                where: { company_id, id: { in: ids } },
            });

            if (documents.length === 0) {
                return NextResponse.json(errorResponse('No documents found'), { status: 404 });
            }

            const pdfBuffer = await generateDocumentsPrintPDF(documents);

            return new NextResponse(pdfBuffer as unknown as Blob, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `inline; filename="documents-print-${Date.now()}.pdf"`,
                },
            });
        });

        if (result instanceof NextResponse) {
            return result;
        }

        return result;
    } catch (error: any) {
        console.error('Documents print PDF generation error:', error);
        if (error?.message === 'NO_DOCUMENTS') {
            return NextResponse.json(errorResponse('No selectable document files found'), { status: 404 });
        }
        return NextResponse.json(
            errorResponse('Failed to generate documents print PDF'),
            { status: 500 }
        );
    }
}
