import { NextRequest, NextResponse } from 'next/server';
import { puppeteerManager } from '@/lib/puppeteer-server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { errorResponse, unauthorizedResponse } from '@/lib/api-response';
import { formatIndianCurrency } from '@/lib/financial-year';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


async function generateManjuriPDF(estimation: any, origin: any): Promise<Buffer> {
    const sortedVardhis = [...(estimation.vardhis || [])].sort(
        (a: any, b: any) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime()
    );

    const startDate = sortedVardhis.length > 0 ? new Date(sortedVardhis[0].date) : null;
    const endDate = sortedVardhis.length > 0 ? new Date(sortedVardhis[sortedVardhis.length - 1].date) : null;

    const formatDate = (date: Date | null) => {
        if (!date || isNaN(date.getTime())) return "-";
        return date.toLocaleDateString("en-GB");
    };

    const totalAmount = (estimation.vardhis || []).reduce(
        (sum: number, vardhi: any) => sum + Number(vardhi.grand_total || 0),
        0
    );


    const getFinancialYear = (date: Date) => {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;

        if (month >= 4) {
            return `${year}-${(year + 1).toString().slice(-2)}`;
        } else {
            return `${year - 1}-${year.toString().slice(-2)}`;
        }
    };

    const financialYear = getFinancialYear(
        estimation.created_at
            ? new Date(estimation.created_at)
            : new Date()
    );
    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Manjuri - ${estimation.estimation_no}</title>
            <script src="https://cdn.tailwindcss.com"></script>
             <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
            <style>
                  * { box-sizing: border-box; margin: 0; padding: 0; }
                body { font-family: 'Inter', 'Segoe UI', Arial, sans-serif; font-size: 14px; }
                @page {
                    size: A4;
                    margin: 10mm;
                }

                html, body {
                    width: 210mm;
                    min-height: 297mm;
                }
                body {
                    // font-family: "Noto Sans Gujarati", "Lohit Gujarati", Arial, sans-serif;
                }
            </style>
        </head>
        <body>
            <div class="rounded-md border overflow-hidden">
                <div class="overflow-auto">
                    <table class="w-full text-sm border-collapse">
                        <tbody class="divide-y">
                            <tr class="transition-colors ">
                                <td class="text-center p-6 border-r" colspan="4">
                                    <div class="flex flex-wrap justify-center">
                                        <img
                                            src="${origin}/bmc_icon.png"
                                            alt="BMC Icon"
                                            width="60"
                                            height="60"
                                            class="object-cover mr-[50px]"
                                        />
                                        <div class="">
                                            <h1 class="text-xl font-bold">
                                                ભાવનગર મહાનગરપાલિકા - ભાવનગર
                                            </h1>
                                            <h2 class="text-lg font-semibold">
                                                વોટર વર્કસ વિભાગ
                                            </h2>
                                        </div>
                                        <img
                                            src="${origin}/bmc_icon.png"
                                            alt="BMC Icon"
                                            width="60"
                                            height="60"
                                            class="object-cover ml-[50px]"
                                        />
                                    </div>
                                    <h3 class="mt-2 font-semibold">
                                        :: ખરેખર થયેલ કામનું ખર્ચ પત્રક ::
                                    </h3>
                                </td>
                            </tr>
                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold ">
                                    કામનું નામ :
                                </td>
                                <td class="p-1 border-r" colspan="3">
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">${estimation.work_name}
                                    </div>
                                </td>
                            </tr>

                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                    ખર્ચ પત્રક બનાવનાર :
                                </td>
                                <td class="p-1 border-r" colspan="3">
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">${estimation.zone_no}</div>
                                </td>
                            </tr>

                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                    કોન્ટ્રાક્ટરનું નામ :
                                </td>
                                <td class="p-1 border-r" colspan="3">
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">${estimation.contractor}</div>
                                </td>
                            </tr>

                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                    કુલ ખર્ચ :
                                </td>
                                <td class="p-1 border-r" colspan="3">
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">  ₹ ${formatIndianCurrency(totalAmount)} </div>
                                </td>
                            </tr>

                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                    ભાવોનો આધાર :
                                </td>
                                <td class="p-1 border-r" colspan="3">
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">વિભાગના મંજુર થયેલ વાર્ષિક ભાવો ${financialYear}</div>
                                </td>
                            </tr>

                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                    ખર્ચનો હેડ :
                                </td>
                                <td class="p-1 border-r" colspan="3">
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">
                                        મેન્ટેનન્સ
                                    </div>
                                </td>

                            </tr>
                            <tr class="hover:bg-blue-50 transition-colors ">
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                    DATE :
                                </td>
                                <td class="p-1 border-r">
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs"> ${formatDate(startDate)}</div>
                                </td>
                                <td class="p-2 py-1 border-r text-left text-xs text-muted-foreground bg-slate-100 font-bold">
                                    TO:
                                </td>
                                <td class="p-1 border-r">
                                    <div class="border-input data-placeholder:text-muted-foreground dark:bg-input/30 dark:hover:bg-input/50 focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive dark:aria-invalid:border-destructive/50 flex items-center justify-between gap-1.5 rounded-lg py-2 pr-2 pl-2.5 whitespace-nowrap transition-colors outline-none  disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:ring-3 data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 w-full border-0 bg-transparent shadow-none focus-visible:ring-1 h-8 text-xs">${formatDate(endDate)}</div>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </body>
        </html>
    `;

    return puppeteerManager.generatePDF(html, { margin: { top: '10px', bottom: '10px', left: '10px', right: '10px' } });
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { origin } = new URL(request.url);
        const result = await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const estimation = await prisma.vardhiEstimation.findFirst({
                where: {
                    id,
                    company_id,
                },
                include: {
                    vardhis: {
                        select: {
                            id: true,
                            vardhi_number: true,
                            location: true,
                            work_type: true,
                            date: true,
                            grand_total: true,
                            vardhiItems: {
                                include: {
                                    item: { include: { unit: true, ay: true } }
                                }
                            },
                            additionalItems: true,
                            zone: {
                                select: {
                                    id: true,
                                    name: true,
                                    file_no: true,
                                },
                            },
                        },
                    },
                },
            });

            if (!estimation) {
                return NextResponse.json(errorResponse('Estimation not found'), { status: 404 });
            }

            const pdfBuffer = await generateManjuriPDF(estimation, origin);

            return new NextResponse(pdfBuffer as unknown as Blob, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="manjuri-${estimation.estimation_no}.pdf"`,
                },
            });
        });

        if (result instanceof NextResponse) {
            return result;
        }

        return result;
    } catch (error) {
        console.error('Manjuri PDF generation error:', error);
        return NextResponse.json(
            errorResponse('Failed to generate Manjuri PDF'),
            { status: 500 }
        );
    }
}
