import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;

        if (!id) {
            return NextResponse.json(
                errorResponse('Employee ID is required'),
                { status: 400 }
            );
        }

        const response = await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                return NextResponse.json(
                    unauthorizedResponse(),
                    { status: 401 }
                );
            }

            const employee = await prisma.employee.findFirst({
                where: {
                    id,
                    company_id,
                },
            });

            if (!employee) {
                return NextResponse.json(
                    errorResponse('Employee not found'),
                    { status: 404 }
                );
            }

            const salaryHistory = await prisma.employeePrice.findMany({
                where: {
                    employee_id: id,
                },
                select: {
                    id: true,
                    price: true,
                    start_date: true,
                    expiry_date: true,
                },
                orderBy: {
                    start_date: 'desc',
                },
            });

            const formattedHistory = salaryHistory.map(h => ({
                id: h.id,
                price: h.price.toString(),
                start_date: h.start_date,
                expiry_date: h.expiry_date,
            }));

            return NextResponse.json(
                successResponse('Salary history fetched successfully', formattedHistory)
            );
        });

        if (!response) {
            return NextResponse.json(
                errorResponse('Unexpected server error'),
                { status: 500 }
            );
        }

        return response;

    } catch (error) {
        console.error('Error fetching salary history:', error);
        return NextResponse.json(
            errorResponse('Failed to fetch salary history'),
            { status: 500 }
        );
    }
}
