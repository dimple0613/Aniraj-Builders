export function calculateNetPayable(params: {
    amount: number;
    quantity: number;
    cgstPercent: number;
    sgstPercent: number;
    isCgstEnabled: boolean;
    isSgstEnabled: boolean;
    itPercent: number;
    isItEnabled: boolean;
    labourCessPercent: number;
    isLabourCessEnabled: boolean;
    cgstTdsPercent: number;
    isCgstTdsEnabled: boolean;
    sgstTdsPercent: number;
    isSgstTdsEnabled: boolean;
    addDepositPercent: number;
    isAddDepositEnabled: boolean;
}): number {
    const subtotal = params.amount * params.quantity;

    const cgstRate = params.isCgstEnabled ? params.cgstPercent || 0 : 0;
    const sgstRate = params.isSgstEnabled ? params.sgstPercent || 0 : 0;
    const totalGstRate = cgstRate + sgstRate;

    const taxtotal = totalGstRate > 0
        ? subtotal - (100 / (100 + totalGstRate)) * subtotal
        : 0;

    const cgst = params.isCgstEnabled
        ? (params.isSgstEnabled ? taxtotal / 2 : taxtotal)
        : 0;
    const sgst = params.isSgstEnabled
        ? taxtotal - cgst
        : 0;

    const grossTotal = Number((subtotal - Number(cgst.toFixed(2)) - Number(sgst.toFixed(2))).toFixed(2));

    const it = params.isItEnabled ? Number(((grossTotal * (params.itPercent || 0)) / 100).toFixed(2)) : 0;
    const labourCess = params.isLabourCessEnabled ? Number(((grossTotal * (params.labourCessPercent || 0)) / 100).toFixed(2)) : 0;
    const cgstTds = params.isCgstTdsEnabled ? Number(((grossTotal * (params.cgstTdsPercent || 0)) / 100).toFixed(2)) : 0;
    const sgstTds = params.isSgstTdsEnabled ? Number(((grossTotal * (params.sgstTdsPercent || 0)) / 100).toFixed(2)) : 0;
    const addDeposit = params.isAddDepositEnabled ? Number(((grossTotal * (params.addDepositPercent || 0)) / 100).toFixed(2)) : 0;

    const totalDeductions = Number((it + labourCess + cgstTds + sgstTds + addDeposit).toFixed(2));
    return Number((subtotal - totalDeductions).toFixed(2));
}
