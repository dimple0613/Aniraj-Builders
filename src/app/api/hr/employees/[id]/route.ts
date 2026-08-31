import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { withCompany } from '@/lib/company-server';
import { successResponse, errorResponse, unauthorizedResponse } from '@/lib/api-response';
import * as yup from 'yup';
import { getServerSession, authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notification-service';

if (!prisma) {
    throw new Error('Prisma client not initialized');
}

const STRING_MAX = 255;
const PHONE_MAX = 20;
const CODE_MAX = 50;

const updateEmployeeSchema = yup.object({
    employee_code: yup.string().nullable().max(CODE_MAX, `Employee code must not exceed ${CODE_MAX} characters`),
    first_name: yup.string().max(100, 'First name must not exceed 100 characters').optional(),
    last_name: yup.string().nullable().max(100, 'Last name must not exceed 100 characters'),
    middle_name: yup.string().nullable().max(100, 'Middle name must not exceed 100 characters'),
    email: yup.string().nullable().email('Invalid email format').max(STRING_MAX),
    phone: yup.string().nullable().max(PHONE_MAX, `Phone must not exceed ${PHONE_MAX} characters`),
    alternate_phone: yup.string().nullable().max(PHONE_MAX, `Alternate phone must not exceed ${PHONE_MAX} characters`),
    gender: yup.string().nullable().oneOf(['MALE', 'FEMALE', 'OTHER'], 'Gender must be MALE, FEMALE, or OTHER'),
    date_of_birth: yup.date().nullable().typeError('Invalid date format'),
    blood_group: yup.string().nullable().max(10, 'Blood group must not exceed 10 characters'),
    marital_status: yup.string().nullable().oneOf(['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'], 'Invalid marital status'),
    nationality: yup.string().nullable().max(100, 'Nationality must not exceed 100 characters'),
    photo: yup.string().nullable(),
    address: yup.string().nullable(),
    city: yup.string().nullable().max(100, 'City must not exceed 100 characters'),
    state: yup.string().nullable().max(100, 'State must not exceed 100 characters'),
    country: yup.string().nullable().max(100, 'Country must not exceed 100 characters'),
    pincode: yup.string().nullable().max(20, 'Pincode must not exceed 20 characters'),
    department_id: yup.string().nullable().optional(),
    designation_id: yup.string().nullable().optional(),
    joining_date: yup.date().nullable().typeError('Invalid joining date format'),
    confirmation_date: yup.date().nullable().typeError('Invalid confirmation date format'),
    employment_type: yup.string().nullable().oneOf(['PERMANENT', 'CONTRACT', 'PROBATION', 'INTERN', 'TEMPORARY'], 'Invalid employment type'),
    shift: yup.string().nullable().max(50, 'Shift must not exceed 50 characters'),
    reporting_manager: yup.string().nullable().max(STRING_MAX),
    work_location: yup.string().nullable().max(STRING_MAX),
    aadhaar: yup.string().nullable().max(20, 'Aadhaar must not exceed 20 characters'),
    pan: yup.string().nullable().max(20, 'PAN must not exceed 20 characters'),
    passport: yup.string().nullable().max(20, 'Passport must not exceed 20 characters'),
    driving_license: yup.string().nullable().max(50, 'Driving license must not exceed 50 characters'),
    account_holder_name: yup.string().nullable().max(STRING_MAX),
    bank_name: yup.string().nullable().max(STRING_MAX),
    account_number: yup.string().nullable().max(50, 'Account number must not exceed 50 characters'),
    ifsc_code: yup.string().nullable().max(20, 'IFSC code must not exceed 20 characters'),
    branch: yup.string().nullable().max(STRING_MAX),
    emergency_contact_name: yup.string().nullable().max(STRING_MAX),
    emergency_contact_relation: yup.string().nullable().max(100),
    emergency_contact_phone: yup.string().nullable().max(PHONE_MAX),
    status: yup.string().oneOf(['ACTIVE', 'INACTIVE']).optional(),
});

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                console.error('No company ID found');
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const employee = await prisma.employee.findFirst({
                where: { id, company_id },
                include: {
                    department: { select: { id: true, name: true } },
                    designation: { select: { id: true, name: true } },
                },
            });

            if (!employee) {
                return NextResponse.json(
                    errorResponse('Employee not found'),
                    { status: 404 }
                );
            }

            return NextResponse.json(
                successResponse('Employee fetched successfully', employee)
            );
        });
    } catch (error: any) {
        console.error('Error fetching employee:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch employee'), { status: 500 });
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        let validated: yup.InferType<typeof updateEmployeeSchema>;
        try {
            validated = await updateEmployeeSchema.validate(body, { abortEarly: false });
        } catch (err: any) {
            const errorMessages = err.inner
                .map((issue: any) => `${issue.path}: ${issue.message}`)
                .join('; ');
            console.error('Employee PUT validation error:', errorMessages);
            return NextResponse.json(errorResponse(errorMessages), { status: 400 });
        }

        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                console.error('No company ID found');
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existing = await prisma.employee.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Employee not found'),
                    { status: 404 }
                );
            }

            if (validated.employee_code !== undefined && validated.employee_code !== existing.employee_code) {
                const duplicate = await prisma.employee.findFirst({
                    where: {
                        employee_code: { equals: validated.employee_code || '', mode: 'insensitive' },
                        company_id,
                        id: { not: id },
                    },
                });
                if (duplicate) {
                    return NextResponse.json(
                        errorResponse('Employee with this employee code already exists'),
                        { status: 409 }
                    );
                }
            }

            if (validated.department_id !== undefined && validated.department_id) {
                const department = await prisma.department.findFirst({
                    where: { id: validated.department_id, company_id },
                });
                if (!department) {
                    return NextResponse.json(
                        errorResponse('Selected department does not exist'),
                        { status: 400 }
                    );
                }
            }

            if (validated.designation_id !== undefined && validated.designation_id) {
                const designation = await prisma.designation.findFirst({
                    where: { id: validated.designation_id, company_id },
                });
                if (!designation) {
                    return NextResponse.json(
                        errorResponse('Selected designation does not exist'),
                        { status: 400 }
                    );
                }
            }

            const firstName = validated.first_name !== undefined ? validated.first_name : existing.first_name;
            const middleName = validated.middle_name !== undefined ? validated.middle_name : existing.middle_name;
            const lastName = validated.last_name !== undefined ? validated.last_name : existing.last_name;
            const name = [firstName, middleName, lastName].filter(Boolean).join(' ') || firstName || existing.name;

            const employee = await prisma.employee.update({
                where: { id },
                data: {
                    ...(validated.employee_code !== undefined && { employee_code: validated.employee_code || null }),
                    ...(validated.first_name !== undefined && { first_name: validated.first_name }),
                    ...(validated.last_name !== undefined && { last_name: validated.last_name || null }),
                    ...(validated.middle_name !== undefined && { middle_name: validated.middle_name || null }),
                    name,
                    ...(validated.email !== undefined && { email: validated.email || null }),
                    ...(validated.phone !== undefined && { phone: validated.phone || null }),
                    ...(validated.alternate_phone !== undefined && { alternate_phone: validated.alternate_phone || null }),
                    ...(validated.gender !== undefined && { gender: validated.gender || null }),
                    ...(validated.date_of_birth !== undefined && { date_of_birth: validated.date_of_birth || null }),
                    ...(validated.blood_group !== undefined && { blood_group: validated.blood_group || null }),
                    ...(validated.marital_status !== undefined && { marital_status: validated.marital_status || null }),
                    ...(validated.nationality !== undefined && { nationality: validated.nationality || null }),
                    ...(validated.photo !== undefined && { photo: validated.photo || null }),
                    ...(validated.address !== undefined && { address: validated.address || null }),
                    ...(validated.city !== undefined && { city: validated.city || null }),
                    ...(validated.state !== undefined && { state: validated.state || null }),
                    ...(validated.country !== undefined && { country: validated.country || null }),
                    ...(validated.pincode !== undefined && { pincode: validated.pincode || null }),
                    ...(validated.department_id !== undefined && { department_id: validated.department_id || null }),
                    ...(validated.designation_id !== undefined && { designation_id: validated.designation_id || null }),
                    ...(validated.joining_date !== undefined && { joining_date: validated.joining_date || null }),
                    ...(validated.confirmation_date !== undefined && { confirmation_date: validated.confirmation_date || null }),
                    ...(validated.employment_type !== undefined && { employment_type: validated.employment_type || null }),
                    ...(validated.shift !== undefined && { shift: validated.shift || null }),
                    ...(validated.reporting_manager !== undefined && { reporting_manager: validated.reporting_manager || null }),
                    ...(validated.work_location !== undefined && { work_location: validated.work_location || null }),
                    ...(validated.aadhaar !== undefined && { aadhaar: validated.aadhaar || null }),
                    ...(validated.pan !== undefined && { pan: validated.pan || null }),
                    ...(validated.passport !== undefined && { passport: validated.passport || null }),
                    ...(validated.driving_license !== undefined && { driving_license: validated.driving_license || null }),
                    ...(validated.account_holder_name !== undefined && { account_holder_name: validated.account_holder_name || null }),
                    ...(validated.bank_name !== undefined && { bank_name: validated.bank_name || null }),
                    ...(validated.account_number !== undefined && { account_number: validated.account_number || null }),
                    ...(validated.ifsc_code !== undefined && { ifsc_code: validated.ifsc_code || null }),
                    ...(validated.branch !== undefined && { branch: validated.branch || null }),
                    ...(validated.emergency_contact_name !== undefined && { emergency_contact_name: validated.emergency_contact_name || null }),
                    ...(validated.emergency_contact_relation !== undefined && { emergency_contact_relation: validated.emergency_contact_relation || null }),
                    ...(validated.emergency_contact_phone !== undefined && { emergency_contact_phone: validated.emergency_contact_phone || null }),
                    ...(validated.status !== undefined && { status: validated.status }),
                },
                include: {
                    department: { select: { id: true, name: true } },
                    designation: { select: { id: true, name: true } },
                },
            });

            await createNotification({
                action: 'Updated',
                entity: 'Employee',
                entityId: employee.id,
                entityName: employee.name,
                userId: (session?.user as any)?.id,
                link: `/hr/employees`,
            });

            return NextResponse.json(
                successResponse('Employee updated successfully', employee)
            );
        });
    } catch (error: any) {
        console.error('Error updating employee:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        if (error.code === 'P2002') {
            return NextResponse.json(
                errorResponse('Employee with this code already exists'),
                { status: 409 }
            );
        }
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to update employee';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}

export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                console.error('No company ID found');
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const existing = await prisma.employee.findFirst({
                where: { id, company_id },
            });

            if (!existing) {
                return NextResponse.json(
                    errorResponse('Employee not found'),
                    { status: 404 }
                );
            }

            await prisma.$transaction([
                prisma.loanRepayment.deleteMany({ where: { loan: { employee_id: id } } }),
                prisma.loan.deleteMany({ where: { employee_id: id } }),
                prisma.payslip.deleteMany({ where: { employee_id: id } }),
                prisma.reimbursementRequest.deleteMany({ where: { employee_id: id } }),
                prisma.payrollItem.deleteMany({ where: { employee_id: id } }),
                prisma.employeeSalary.deleteMany({ where: { employee_id: id } }),
                prisma.leaveRequest.deleteMany({ where: { employee_id: id } }),
                prisma.performanceReview.deleteMany({ where: { employee_id: id } }),
                prisma.employeeDocument.deleteMany({ where: { employee_id: id } }),
                prisma.vardhiEmployee.deleteMany({ where: { employee_id: id } }),
            ]);

            await prisma.employee.delete({
                where: { id },
            });

            await createNotification({
                action: 'Deleted',
                entity: 'Employee',
                entityId: id,
                entityName: existing.name,
                userId: (session?.user as any)?.id,
                link: `/hr/employees`,
            });

            return NextResponse.json(
                successResponse('Employee deleted successfully')
            );
        });
    } catch (error: any) {
        console.error('Error deleting employee:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        if (error.message?.includes('COMPANY_CONTEXT')) {
            return NextResponse.json(unauthorizedResponse(), { status: 401 });
        }
        const message = error?.message || 'Failed to delete employee';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
