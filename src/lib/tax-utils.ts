/**
 * Tax calculation utilities
 */

// Re-export from financial-year for backward compatibility
export { formatIndianCurrency } from './financial-year';

/**
 * Calculate tax amount from base amount and percentage
 * @param amount - Base amount
 * @param percent - Tax percentage
 * @returns Calculated tax amount
 */
export function calculateTaxAmount(amount: number, percent: number): number {
    return Number(((amount * percent) / 100).toFixed(2));
}

/**
 * Calculate net payable after deductions
 * @param grossTotal - Gross total amount
 * @param deductions - Total deductions
 * @returns Net payable amount
 */
export function calculateNetPayable(grossTotal: number, deductions: number): number {
    return Number((grossTotal - deductions).toFixed(2));
}
