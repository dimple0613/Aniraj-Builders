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

const createEmployeeSchema = yup.object({
    employee_code: yup.string().nullable().max(CODE_MAX, `Employee code must not exceed ${CODE_MAX} characters`),
    first_name: yup.string().required('First name is required').max(100, 'First name must not exceed 100 characters'),
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
    status: yup.string().oneOf(['ACTIVE', 'INACTIVE']).default('ACTIVE').optional(),
});

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

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '10');
        const search = searchParams.get('search')?.trim() || '';
        const sortField = searchParams.get('sortField') || 'name';
        const sortOrder = searchParams.get('sortOrder') || 'asc';
        const department_id = searchParams.get('department_id')?.trim() || '';
        const designation_id = searchParams.get('designation_id')?.trim() || '';
        const status = searchParams.get('status')?.trim() || '';

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                console.error('No company ID found');
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const where: any = { company_id };

            if (search) {
                where.OR = [
                    { first_name: { contains: search, mode: 'insensitive' } },
                    { last_name: { contains: search, mode: 'insensitive' } },
                    { employee_code: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                ];
            }

            if (department_id) {
                where.department_id = department_id;
            }

            if (designation_id) {
                where.designation_id = designation_id;
            }

            if (status) {
                where.status = status;
            }

            const validSortFields = ['name', 'employee_code', 'first_name', 'last_name', 'email', 'phone', 'department_id', 'designation_id', 'employment_type', 'status', 'createdAt', 'updatedAt'];
            const sortFieldToUse = validSortFields.includes(sortField) ? sortField : 'name';
            const sortDirection = sortOrder === 'desc' ? 'desc' : 'asc';

            const [data, total] = await Promise.all([
                prisma.employee.findMany({
                    where,
                    orderBy: { [sortFieldToUse]: sortDirection },
                    skip: (page - 1) * limit,
                    take: limit,
                    include: {
                        department: {
                            select: { id: true, name: true },
                        },
                        designation: {
                            select: { id: true, name: true },
                        },
                    },
                }),
                prisma.employee.count({ where }),
            ]);

            return NextResponse.json(
                successResponse('Employees fetched successfully', data, {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit),
                })
            );
        });
    } catch (error: any) {
        console.error('Error fetching employees:', error);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        return NextResponse.json(errorResponse(error.message || 'Failed to fetch employees'), { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        let validated: yup.InferType<typeof createEmployeeSchema>;
        try {
            validated = await createEmployeeSchema.validate(body, { abortEarly: false });
        } catch (err: any) {
            const errorMessages = err.inner
                .map((issue: any) => `${issue.path}: ${issue.message}`)
                .join('; ');
            return NextResponse.json(errorResponse(errorMessages), { status: 400 });
        }

        const session = await getServerSession(authOptions);

        return await withCompany(async (company) => {
            const company_id = company?.company_id;

            if (!company_id) {
                console.error('No company ID found');
                return NextResponse.json(unauthorizedResponse(), { status: 401 });
            }

            const name = [validated.first_name, validated.middle_name, validated.last_name]
                .filter(Boolean)
                .join(' ') || validated.first_name;

            if (validated.employee_code) {
                const existingCode = await prisma.employee.findFirst({
                    where: {
                        employee_code: { equals: validated.employee_code, mode: 'insensitive' },
                        company_id,
                    },
                });

                if (existingCode) {
                    return NextResponse.json(
                        errorResponse('Employee with this employee code already exists'),
                        { status: 409 }
                    );
                }
            }

            if (validated.department_id) {
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

            if (validated.designation_id) {
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

            const employee = await prisma.employee.create({
                data: {
                    employee_code: validated.employee_code || null,
                    first_name: validated.first_name,
                    last_name: validated.last_name || null,
                    middle_name: validated.middle_name || null,
                    name,
                    email: validated.email || null,
                    phone: validated.phone || null,
                    alternate_phone: validated.alternate_phone || null,
                    gender: validated.gender || null,
                    date_of_birth: validated.date_of_birth || null,
                    blood_group: validated.blood_group || null,
                    marital_status: validated.marital_status || null,
                    nationality: validated.nationality || null,
                    photo: validated.photo || null,
                    address: validated.address || null,
                    city: validated.city || null,
                    state: validated.state || null,
                    country: validated.country || null,
                    pincode: validated.pincode || null,
                    department_id: validated.department_id || null,
                    designation_id: validated.designation_id || null,
                    joining_date: validated.joining_date || null,
                    confirmation_date: validated.confirmation_date || null,
                    employment_type: validated.employment_type || null,
                    shift: validated.shift || null,
                    reporting_manager: validated.reporting_manager || null,
                    work_location: validated.work_location || null,
                    aadhaar: validated.aadhaar || null,
                    pan: validated.pan || null,
                    passport: validated.passport || null,
                    driving_license: validated.driving_license || null,
                    account_holder_name: validated.account_holder_name || null,
                    bank_name: validated.bank_name || null,
                    account_number: validated.account_number || null,
                    ifsc_code: validated.ifsc_code || null,
                    branch: validated.branch || null,
                    emergency_contact_name: validated.emergency_contact_name || null,
                    emergency_contact_relation: validated.emergency_contact_relation || null,
                    emergency_contact_phone: validated.emergency_contact_phone || null,
                    status: validated.status || 'ACTIVE',
                    company_id,
                },
                include: {
                    department: { select: { id: true, name: true } },
                    designation: { select: { id: true, name: true } },
                },
            });

            await createNotification({
                action: 'Created',
                entity: 'Employee',
                entityId: employee.id,
                entityName: employee.name,
                userId: (session?.user as any)?.id,
                link: `/hr/employees`,
            });

            return NextResponse.json(
                successResponse('Employee created successfully', employee),
                { status: 201 }
            );
        });
    } catch (error: any) {
        console.error('Error creating employee:', error);
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
        const message = error?.message || 'Failed to create employee';
        return NextResponse.json(errorResponse(message), { status: 500 });
    }
}
