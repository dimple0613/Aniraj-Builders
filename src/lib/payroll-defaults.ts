import { PrismaClient } from '@prisma/client';

export interface DefaultSalaryComponent {
    code: string;
    name: string;
    type: 'EARNING' | 'DEDUCTION';
    calculation_type: 'FIXED' | 'PERCENTAGE';
    default_value: number;
    sort_order: number;
}

export const DEFAULT_SALARY_COMPONENTS: DefaultSalaryComponent[] = [
    // Earnings
    { code: 'BASIC', name: 'Basic Salary', type: 'EARNING', calculation_type: 'FIXED', default_value: 0, sort_order: 1 },
    { code: 'HRA', name: 'HRA (House Rent Allowance)', type: 'EARNING', calculation_type: 'FIXED', default_value: 0, sort_order: 2 },
    { code: 'DA', name: 'DA (Dearness Allowance)', type: 'EARNING', calculation_type: 'FIXED', default_value: 0, sort_order: 3 },
    { code: 'MEDICAL', name: 'Medical Allowance', type: 'EARNING', calculation_type: 'FIXED', default_value: 0, sort_order: 4 },
    { code: 'TRAVEL', name: 'Travel Allowance', type: 'EARNING', calculation_type: 'FIXED', default_value: 0, sort_order: 5 },
    { code: 'SPECIAL', name: 'Special Allowance', type: 'EARNING', calculation_type: 'FIXED', default_value: 0, sort_order: 6 },
    { code: 'BONUS', name: 'Bonus', type: 'EARNING', calculation_type: 'FIXED', default_value: 0, sort_order: 7 },
    // Deductions
    { code: 'PF', name: 'Provident Fund (PF)', type: 'DEDUCTION', calculation_type: 'FIXED', default_value: 0, sort_order: 8 },
    { code: 'ESI', name: 'Employee State Insurance (ESI)', type: 'DEDUCTION', calculation_type: 'FIXED', default_value: 0, sort_order: 9 },
    { code: 'PT', name: 'Professional Tax (PT)', type: 'DEDUCTION', calculation_type: 'FIXED', default_value: 0, sort_order: 10 },
    { code: 'TDS', name: 'Tax Deducted at Source (TDS)', type: 'DEDUCTION', calculation_type: 'FIXED', default_value: 0, sort_order: 11 },
    { code: 'LOAN_EMI', name: 'Loan EMI', type: 'DEDUCTION', calculation_type: 'FIXED', default_value: 0, sort_order: 12 },
];

// Codes that make up the structured employee salary form (earnings -> gross).
export const EARNING_CODES = ['BASIC', 'HRA', 'DA', 'MEDICAL', 'TRAVEL', 'SPECIAL', 'BONUS'];
export const DEDUCTION_CODES = ['PF', 'ESI', 'PT', 'TDS', 'LOAN_EMI'];

export async function upsertDefaultSalaryComponents(prisma: PrismaClient, companyId: string) {
    for (const comp of DEFAULT_SALARY_COMPONENTS) {
        await prisma.payrollSalaryComponent.upsert({
            where: {
                company_id_code: {
                    company_id: companyId,
                    code: comp.code,
                },
            },
            update: {
                name: comp.name,
                type: comp.type,
                calculation_type: comp.calculation_type,
                is_standard: true,
                sort_order: comp.sort_order,
            },
            create: {
                company_id: companyId,
                code: comp.code,
                name: comp.name,
                type: comp.type,
                calculation_type: comp.calculation_type,
                default_value: comp.default_value,
                is_standard: true,
                is_active: true,
                sort_order: comp.sort_order,
            },
        });
    }
}
