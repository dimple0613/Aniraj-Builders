import { NextRequest, NextResponse } from 'next/server';
import { puppeteerManager } from '@/lib/puppeteer-server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { errorResponse, unauthorizedResponse } from '@/lib/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function generateGujaratiDocumentPDF(gujaratiDoc: any, estimation: any, defaultValues?: any): Promise<Buffer> {
    const tableFields = [
        { no: "૧", field: "કામની ટૂંકી વિગત", valueKey: "work_summary" },
        { no: "૨", field: "કામની જરૂરીયાત", valueKey: "work_requirement" },
        { no: "૩", field: "રસ્તા / પ્લોટની માલિકી", valueKey: "plot_ownership" },
        { no: "૪", field: "કામનો પ્રકાર", valueKey: "work_type" },
        { no: "૫", field: "આ કામનું ડુપ્લીકેશન થાય છે કે કેમ (હા/ના)", valueKey: "is_duplicate_work" },
        { no: "૬", field: "કામની અંદાજપત્ર / ખર્ચપત્રક મુજબની વિગત", valueKey: "estimated_cost_details" },
        { no: "૭", field: "ખર્ચ મંજૂરી કરનાર સક્ષમ સત્તાધીશ", valueKey: "approving_authority" },
        { no: "૮", field: "ખર્ચનો હેડ", valueKey: "cost_head" },
        { no: "૯", field: "કામની પદ્ધતિ", valueKey: "work_method" },
        { no: "૧૦", field: "કામની સમયમર્યાદા", valueKey: "work_deadline" },
        { no: "૧૧", field: "કામ સમયમર્યાદામાં પૂર્ણ થયેલું છે કે કેમ? (હા/ના)", valueKey: "is_work_completed_on_time" },
        { no: "૧૨", field: "રજીસ્ટ્રેશન ક્લાસ", valueKey: "registration_class" },
        { no: "૧૩", field: "EMD ની વિગત", valueKey: "emd_details" },
        { no: "૧૪", field: "બીડ વેલિડીટી", valueKey: "bid_validity" },
        { no: "૧૫", field: "કામનો લાયબિલિટી પિરિયડ", valueKey: "liability_period" },
        { no: "૧૬", field: "GFR/PWD શહેરી વિભાગની જોગવાઇઓ સાથે સુસંગત છે કે કેમ?", valueKey: "gfr_pwd_compliance" },
        { no: "૧૭", field: "સિંગલ ટેન્ડર છે કે કેમ?", valueKey: "is_single_tender" },
        { no: "૧૮", field: "સિંગલ ટેન્ડર હોય તો કેટલાં પ્રયત્ન થયા છે?", valueKey: "single_tender_efforts" },
        { no: "૧૯", field: "નેગોસિએશન માટે અભિપ્રાય થયો છે", valueKey: "negotiation_feedback" },
        { no: "૨૦", field: "કામની એજન્સી", valueKey: "work_agency" },
        { no: "૨૧", field: "આ કામનું ડુપ્લીકેશન થતું નથી તે બાબતનું HOD નું પ્રમાણપત્ર", valueKey: "hod_certificate_no_duplicate" },
    ];

    const getValue = (key: string): string => {
        // Priority: defaultValues (preview/unsaved form data) > DB data > "-"
        return defaultValues?.[key] || gujaratiDoc?.[key] || "-";
    };

    const tableRowsHtml = tableFields.map((row) => `
        <tr>
            <td class="p-2 py-1 border text-left text-xs text-gray-600 bg-gray-100 font-bold w-[30px]">
                (${row.no})
            </td>
            <td class="p-2 py-1 border text-left text-xs text-gray-600 bg-gray-100 font-bold">
                ${row.field}
            </td>
            <td class="p-3 py-2 border text-left text-xs w-[50%]">
                ${getValue(row.valueKey)}
            </td>
        </tr>
    `).join('');

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Gujarati Document - ${estimation.estimation_no || 'Document'}</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Gujarati:wght@400;500;600;700&display=swap" rel="stylesheet">
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
                .gujarati-text {
                    font-family: 'Noto Sans Gujarati', 'Nirmala UI', sans-serif;
                }
            </style>
        </head>
        <body class="gujarati-text">
            <div class="bg-white p-4 md:p-6">
                <!-- Header -->
                <div class="text-center shadow-md rounded-md border overflow-hidden pt-[20px] px-[20px] pb-[20px] mb-6">
                    <h1 class="font-bold mb-1 text-[38px] leading-[42px] gujarati-text">
                        ભાવનગર મહાનગરપાલિકા
                    </h1>
                    <span class="text-[18px] font-semibold gujarati-text">વિભાગ :- વોટર વર્કસ વિભાગ</span>
                </div>

                <!-- Intro Line -->
                <div class="text-left mb-4 gujarati-text">
                    <p class="text-sm font-bold">સાદર રજૂ.</p>
                </div>

                <!-- Work Name -->
                <div class="mb-4 gujarati-text">
                    <p class="text-sm font-medium">
                        <span class="font-semibold">કામનું નામ :</span> ${estimation.work_name || "-"}
                    </p>
                </div>

                <!-- Main Table -->
                <div class="rounded-md border overflow-hidden mb-6">
                    <table class="w-full text-sm border-collapse gujarati-text">
                        <tbody>
                            ${tableRowsHtml}
                        </tbody>
                    </table>
                </div>

                <!-- Footer Section -->
                <div class="pt-4 mt-12 flex w-[57%] mx-auto">
                <div class="w-1/2 text-center">
                    <p class="font-bold">ટે.આ/અ.મ.ઈ.</p>
                </div>

                <div class="font-bold w-1/2 text-center">
                    <p>ક.ઈ.</p>
                </div>
            </div>
            </div>
        </body>
        </html>
    `;

    return puppeteerManager.generatePDF(html);
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const { searchParams } = new URL(request.url);
        const defaultValuesStr = searchParams.get('defaultValues');

        let defaultValues: any = undefined;
        if (defaultValuesStr) {
            try {
                defaultValues = JSON.parse(decodeURIComponent(defaultValuesStr));
            } catch {
                console.error('Failed to parse defaultValues query param');
            }
        }

        const result = await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const estimation = await prisma.vardhiEstimation.findFirst({
                where: { id, company_id },
                select: {
                    id: true,
                    estimation_no: true,
                    zone_no: true,
                    contractor: true,
                    work_name: true,
                    total_amount: true,
                    month_year: true,
                },
            });

            if (!estimation) {
                return NextResponse.json(errorResponse('Estimation not found'), { status: 404 });
            }

            const gujaratiDoc = await prisma.vardhiWaterWorksDepartment.findFirst({
                where: {
                    estimation_id: id,
                    company_id,
                },
            });

            const pdfBuffer = await generateGujaratiDocumentPDF(gujaratiDoc, estimation, defaultValues);

            return new NextResponse(pdfBuffer as unknown as Blob, {
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition': `attachment; filename="gujarati-document-${estimation.estimation_no || id}.pdf"`,
                },
            });
        });

        if (result instanceof NextResponse) {
            return result;
        }

        return result;
    } catch (error) {
        console.error('Gujarati Document PDF generation error:', error);
        return NextResponse.json(
            errorResponse('Failed to generate Gujarati Document PDF'),
            { status: 500 }
        );
    }
}
