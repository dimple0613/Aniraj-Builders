import { NextRequest, NextResponse } from 'next/server';
import archiver from 'archiver';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { errorResponse, unauthorizedResponse, successResponse } from '@/lib/api-response';
import { generateEstimationPDF, generateDailyReportPDF, generateManjuriPDF, generateVardhiGroups } from '@/lib/vardhi-pdf-generators';
import { generateInvoicePDF, getInvoiceDataByEstimationId } from '@/lib/invoice-pdf-generator';
import { readFile } from 'fs/promises';
import { join } from 'path';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface FileInfo {
    path: string;
    name: string;
}

async function fetchFileAsBuffer(url: string): Promise<Buffer | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch {
        return null;
    }
}

async function readLocalFile(filepath: string): Promise<Buffer | null> {
    try {
        const fullPath = join(process.cwd(), 'public', filepath);
        return await readFile(fullPath);
    } catch {
        return null;
    }
}

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const { origin, searchParams } = new URL(request.url);

        const type = searchParams.get('type'); // 'single' | 'zip' | 'all'
        const fileType = searchParams.get('fileType'); // 'report_pdf' | 'site_photography' | etc.
        const vardhiId = searchParams.get('vardhiId'); // specific vardhi id

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const estimation = await prisma.vardhiEstimation.findFirst({
                where: { id, company_id },
                include: {
                    items: {
                        include: {
                            item: { include: { unit: true, ay: true } },
                            unit: true,
                            ay: true,
                        },
                    },
                    vardhis: {
                        select: {
                            id: true,
                            vardhi_number: true,
                            location: true,
                            date: true,
                            attachments: true,
                            report_pdf: true,
                            site_photography: true,
                            site_clear_photo: true,
                            other_attachment: true,
                        },
                    },
                },
            });


            if (!estimation) {
                return NextResponse.json(errorResponse('Estimation not found'), { status: 404 });
            }

            const filesToDownload: FileInfo[] = [];
            const vardhisToProcess = vardhiId
                ? estimation.vardhis.filter((v: any) => v.id === vardhiId)
                : estimation.vardhis;

            for (const vardhi of vardhisToProcess) {
                // Define which types to include
                const fileTypeFilter = fileType || null;


                if (vardhi?.attachments?.length) {
                    for (const file of vardhi.attachments) {
                        // If fileType is set, skip files that don't match
                        if (fileType && file.type !== fileType) continue;

                        // Clean the path and normalize slashes
                        const cleanPath = file.file_path.split('?')[0].replace(/\\/g, '/');

                        // Get the file extension
                        const ext = cleanPath.split('.').pop() || 'pdf';

                        // Create a folder by file type, e.g., report_pdf/, site_photography/
                        const folder = file.type == "other_attachment" ? "store_report" : file.type;

                        // Push the download info
                        filesToDownload.push({
                            path: cleanPath,
                            name: `${vardhi.vardhi_number}/${folder}/${file.file_name}`
                        });
                    }
                }


                // const fileFields = [
                //     { value: vardhi.report_pdf, name: `vardhi-${vardhi.vardhi_number}-report`, types: ['report_pdf'] },
                //     { value: vardhi.site_photography, name: `vardhi-${vardhi.vardhi_number}-site-photo`, types: ['site_photography'] },
                //     { value: vardhi.site_clear_photo, name: `vardhi-${vardhi.vardhi_number}-site-clear`, types: ['site_clear_photo'] },
                //     { value: vardhi.other_attachment, name: `vardhi-${vardhi.vardhi_number}-other`, types: ['other_attachment'] },
                // ];

                // for (const file of fileFields) {
                //     if (!file.value) continue;

                //     if (fileType && !file.types.includes(fileType)) continue;

                //     const cleanPath = file.value.split('?')[0].replace(/\\/g, '/');
                //     const ext = cleanPath.split('.').pop() || 'pdf';

                //     filesToDownload.push({
                //         path: cleanPath,
                //         name: `${file.name}.${ext}`
                //     });
                // }
            }

            if (type === 'single' && filesToDownload.length === 1) {
                const file = filesToDownload[0];

                let data: Uint8Array | null = null;
                if (file.path.startsWith('/api/')) {
                    const fileUrl = `${origin}${file.path}`;
                    const res = await fetch(fileUrl);
                    if (!res.ok) {
                        return NextResponse.json(errorResponse('File not found'), { status: 404 });
                    }
                    const arrayBuffer = await res.arrayBuffer();
                    data = new Uint8Array(arrayBuffer);
                } else {
                    try {
                        const fullPath = join(process.cwd(), 'public', file.path);
                        data = await readFile(fullPath);
                    } catch {
                        return NextResponse.json(errorResponse('File not found'), { status: 404 });
                    }
                }

                const isPdf = file.name.endsWith('.pdf');

                return new NextResponse(data as unknown as BodyInit, {
                    headers: {
                        'Content-Type': isPdf ? 'application/pdf' : 'image/jpeg',
                        'Content-Disposition': `attachment; filename="${file.name}"`,
                    },
                });
            }

            if ((type === 'zip' || !type) && filesToDownload.length > 0) {
                const stream = new ReadableStream({
                    start(controller) {
                        const archive = archiver('zip', { zlib: { level: 9 } });

                        archive.on('data', (chunk: any) => {
                            controller.enqueue(chunk);
                        });

                        archive.on('end', () => {
                            controller.close();
                        });

                        archive.on('error', (err: any) => {
                            controller.error(err);
                        });

                        (async () => {
                            try {
                                const generationType = searchParams.get('generationType');

                                if (generationType !== 'attachments-only') {
                                    const estimationPdf = await generateEstimationPDF(estimation, estimation.items);
                                    const manjuriPdf = await generateManjuriPDF(estimation, estimation.items, origin);
                                    const vardhiGroups = generateVardhiGroups(estimation);
                                    const dailyReportPdf = await generateDailyReportPDF(estimation, vardhiGroups);

                                    const invoiceData = await getInvoiceDataByEstimationId(id, company_id);
                                    const invoicePdf = await generateInvoicePDF(invoiceData, origin);

                                    archive.append(estimationPdf, { name: `Estimation-${estimation.estimation_no}.pdf` });
                                    archive.append(manjuriPdf, { name: `Manjuri-${estimation.estimation_no}.pdf` });
                                    archive.append(dailyReportPdf, { name: `DailyReport-${estimation.estimation_no}.pdf` });

                                    const invoiceFilename = invoiceData.invoice_no
                                        ? `Invoice-${invoiceData.invoice_no}.pdf`
                                        : `Invoice-draft-${estimation.estimation_no}.pdf`;
                                    archive.append(invoicePdf, { name: invoiceFilename });
                                }

                                for (const file of filesToDownload) {
                                    let buffer: Buffer | null = null;

                                    if (file.path.startsWith('/api/')) {
                                        const fileUrl = `${origin}${file.path}`;
                                        buffer = await fetchFileAsBuffer(fileUrl);
                                    } else {
                                        buffer = await readLocalFile(file.path);
                                    }

                                    if (buffer) {
                                        archive.append(buffer, { name: file.name });
                                    }
                                }

                                await archive.finalize();
                            } catch (error) {
                                console.error('Error generating ZIP:', error);
                                controller.error(error);
                            }
                        })();
                    },
                });

                const zipName = vardhiId
                    ? `vardhi-${vardhiId}-attachments.zip`
                    : `estimation-${estimation.estimation_no}.zip`;

                return new NextResponse(stream as unknown as BodyInit, {
                    headers: {
                        'Content-Type': 'application/zip',
                        'Content-Disposition': `attachment; filename="${zipName}"`,
                    },
                });
            }

            return NextResponse.json(errorResponse('No files found'), { status: 404 });
        });
    } catch (error) {
        console.error('Download error:', error);
        return NextResponse.json(
            errorResponse('Failed to process download request'),
            { status: 500 }
        );
    }
}
