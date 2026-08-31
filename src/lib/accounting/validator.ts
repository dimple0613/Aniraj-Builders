import { Decimal } from '@prisma/client/runtime/library';

export interface TransactionValidationResult {
    valid: boolean;
    errors: string[];
}

export interface TransactionData {
    account_id?: string | null;
    amount?: number | string | Decimal | null;
    debit_amount?: number | string | Decimal | null;
    credit_amount?: number | string | Decimal | null;
    transaction_type?: string;
    ledger?: string;
    ledger_type?: string;
    party_id?: string | null;
    project_id?: string | null;
    narration?: string | null;
    reference_type?: string | null;
    reference_id?: string | null;
}

export interface BalanceCalculationResult {
    openingBalance: number;
    totalDebit: number;
    totalCredit: number;
    closingBalance: number;
    transactions: Array<{
        id: string;
        date: Date;
        debit: number;
        credit: number;
        balance: number;
        narration?: string;
    }>;
}

export class AccountingValidator {
    private static toNumber(value: number | string | Decimal | null | undefined): number {
        if (value === null || value === undefined) return 0;
        if (typeof value === 'number') return value;
        if (typeof value === 'string') return parseFloat(value) || 0;
        if (value && typeof value === 'object' && 'toNumber' in value) {
            return (value as Decimal).toNumber();
        }
        return 0;
    }

    static validateDebitCreditRule(transaction: TransactionData): TransactionValidationResult {
        const errors: string[] = [];
        const debitAmount = this.toNumber(transaction.debit_amount);
        const creditAmount = this.toNumber(transaction.credit_amount);

        if (debitAmount > 0 && creditAmount > 0) {
            errors.push('Transaction cannot have both debit and credit amounts. Only one should be greater than 0.');
        }

        if (debitAmount === 0 && creditAmount === 0) {
            errors.push('Transaction must have either a debit or credit amount. Both cannot be 0.');
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    static validateBalanceBehavior(
        transactionType: string,
        amount: number,
        currentBalance: number
    ): TransactionValidationResult {
        const errors: string[] = [];

        if (transactionType === 'DEBIT') {
            if (amount > currentBalance) {
                errors.push(`Insufficient balance. Debit amount (₹${amount.toLocaleString()}) exceeds current balance (₹${currentBalance.toLocaleString()})`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    static validateTransactionIntegrity(transaction: TransactionData): TransactionValidationResult {
        const errors: string[] = [];

        if (!transaction.account_id) {
            errors.push('Transaction must have an account_id');
        }

        if (this.toNumber(transaction.amount) <= 0) {
            errors.push('Transaction amount must be greater than 0');
        }

        if (!transaction.transaction_type) {
            errors.push('Transaction type is required');
        }

        if (!['DEBIT', 'CREDIT'].includes(transaction.transaction_type || '')) {
            errors.push('Transaction type must be either DEBIT or CREDIT');
        }

        const validation = this.validateDebitCreditRule(transaction);
        errors.push(...validation.errors);

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    static validatePurchasePayment(
        paymentAmount: number,
        purchaseTotal: number,
        existingPayments: number[]
    ): TransactionValidationResult {
        const errors: string[] = [];
        const totalPaid = existingPayments.reduce((sum, amt) => sum + amt, 0) + paymentAmount;

        if (paymentAmount <= 0) {
            errors.push('Payment amount must be greater than 0');
        }

        if (paymentAmount > purchaseTotal) {
            errors.push(`Payment amount (₹${paymentAmount.toLocaleString()}) exceeds purchase total (₹${purchaseTotal.toLocaleString()})`);
        }

        if (totalPaid > purchaseTotal) {
            errors.push(`Total payment (₹${totalPaid.toLocaleString()}) would exceed purchase total (₹${purchaseTotal.toLocaleString()})`);
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    static validatePaymentWithPartyBalance(
        transactionType: string,
        amount: number,
        accountBalance: number,
        partyPayableBalance: number,
        partyReceivableBalance: number,
        ledgerType?: string | null
    ): TransactionValidationResult {
        const errors: string[] = [];
        const numAmount = this.toNumber(amount);

        if (transactionType === 'DEBIT') {
            if (numAmount > accountBalance) {
                errors.push(`Insufficient cash/bank balance. Available: ₹${accountBalance.toLocaleString()}, Requested: ₹${numAmount.toLocaleString()}`);
            }

            if (partyReceivableBalance > 0 && numAmount > partyReceivableBalance) {
                errors.push(`Party has insufficient receivable balance. Party receivable: ₹${partyReceivableBalance.toLocaleString()}, Requested payment: ₹${numAmount.toLocaleString()}`);
            }
        } else if (transactionType === 'CREDIT') {
            if (partyPayableBalance > 0 && numAmount > partyPayableBalance) {
                errors.push(`Party has insufficient payable balance. Party payable: ₹${partyPayableBalance.toLocaleString()}, Requested receipt: ₹${numAmount.toLocaleString()}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    static calculatePartyBalance(
        partyId: string,
        transactions: Array<{
            party_id: string | null;
            ledger_type: string | null;
            transaction_type: string;
            debit_amount?: number | string | Decimal | null;
            credit_amount?: number | string | Decimal | null;
        }>
    ): { receivable: number; payable: number } {
        let receivable = 0;
        let payable = 0;

        const partyTransactions = transactions.filter(t => t.party_id === partyId);

        for (const t of partyTransactions) {
            const debit = this.toNumber(t.debit_amount);
            const credit = this.toNumber(t.credit_amount);
            const ledgerType = t.ledger_type;

            const transactionType = t.transaction_type;

            if (ledgerType === 'RECEIVABLE') {
                if (transactionType === 'CREDIT') {
                    receivable += credit;
                } else {
                    receivable -= debit;
                }
            } else if (ledgerType === 'PAYABLE') {
                if (transactionType === 'CREDIT') {
                    payable += credit;
                } else {
                    payable -= debit;
                }
            } else {
                if (transactionType === 'CREDIT') {
                    receivable += credit;
                } else {
                    payable -= debit;
                }
            }
        }

        return {
            receivable: Math.max(0, receivable),
            payable: Math.max(0, payable),
        };
    }

    static async getPartyBalanceById(partyId: string, companyId: string): Promise<{ receivable: number; payable: number }> {
        const { prisma } = await import('@/lib/prisma');

        const [cashTransactions, bankTransactions] = await Promise.all([
            prisma.cashBookTransaction.findMany({
                where: {
                    company_id: companyId,
                    party_id: partyId,
                    is_deleted: false,
                },
            }),
            prisma.bankBookTransaction.findMany({
                where: {
                    company_id: companyId,
                    party_id: partyId,
                    is_deleted: false,
                },
            }),
        ]);

        const allTransactions = [
            ...cashTransactions.map(t => ({
                party_id: t.party_id,
                ledger_type: t.ledger_type,
                transaction_type: t.transaction_type,
                debit_amount: t.debit_amount,
                credit_amount: t.credit_amount,
            })),
            ...bankTransactions.map(t => ({
                party_id: t.party_id,
                ledger_type: t.ledger_type,
                transaction_type: t.transaction_type,
                debit_amount: t.debit_amount,
                credit_amount: t.credit_amount,
            })),
        ];

        return this.calculatePartyBalance(partyId, allTransactions);
    }

    static async getPartyOpeningBalance(partyId: string, companyId: string): Promise<number> {
        const { prisma } = await import('@/lib/prisma');
        const party = await prisma.party.findUnique({
            where: { id: partyId, company_id: companyId },
            select: { bank_opening_balance: true },
        });
        return party?.bank_opening_balance?.toNumber() || 0;
    }

    static async getPartyCurrentBalance(partyId: string, companyId: string): Promise<number> {
        const { prisma } = await import('@/lib/prisma');
        const result = await prisma.$queryRaw<any>`SELECT current_balance FROM "Party" WHERE id = ${partyId} AND company_id = ${companyId}`;
        return result[0]?.current_balance ? Number(result[0].current_balance) : 0;
    }

    static async getAccountCurrentBalance(accountId: string, companyId: string): Promise<number> {
        const { prisma } = await import('@/lib/prisma');
        const result = await prisma.$queryRaw<any>`SELECT current_balance FROM "Account" WHERE id = ${accountId} AND company_id = ${companyId}`;
        return result[0]?.current_balance ? Number(result[0].current_balance) : 0;
    }

    static async getPartyCurrentBalanceFromDb(partyId: string, companyId: string): Promise<{ receivable: number; payable: number }> {
        const { prisma } = await import('@/lib/prisma');
        const result = await prisma.$queryRaw<any>`SELECT current_balance, bank_opening_balance FROM "Party" WHERE id = ${partyId} AND company_id = ${companyId}`;
        const currentBalance = result[0]?.current_balance ? Number(result[0].current_balance) : 0;
        return {
            receivable: currentBalance > 0 ? currentBalance : 0,
            payable: currentBalance < 0 ? Math.abs(currentBalance) : 0,
        };
    }

    static async updatePartyCurrentBalance(partyId: string, companyId: string): Promise<void> {
        const { prisma } = await import('@/lib/prisma');
        
        const cashTransactions = await prisma.$queryRaw<any>`SELECT debit_amount, credit_amount, ledger_type, transaction_type FROM "CashBookTransaction" WHERE company_id = ${companyId} AND party_id = ${partyId} AND is_deleted = false`;
        const bankTransactions = await prisma.$queryRaw<any>`SELECT debit_amount, credit_amount, ledger_type, transaction_type FROM "BankBookTransaction" WHERE company_id = ${companyId} AND party_id = ${partyId} AND is_deleted = false`;

        let receivable = 0;
        let payable = 0;

        const processTransactions = (transactions: any[]) => {
            transactions.forEach((t: any) => {
                const debit = Number(t.debit_amount) || 0;
                const credit = Number(t.credit_amount) || 0;
                const ledgerType = t.ledger_type;
                const transactionType = t.transaction_type;

                if (ledgerType === 'RECEIVABLE') {
                    if (transactionType === 'CREDIT') receivable -= credit;
                    else receivable += debit;
                } else if (ledgerType === 'PAYABLE') {
                    if (transactionType === 'DEBIT') payable -= debit;
                    else payable += credit;
                } else {
                    if (transactionType === 'CREDIT') receivable -= credit;
                    else payable -= debit;
                }
            });
        };

        processTransactions(cashTransactions);
        processTransactions(bankTransactions);

        const openingBalance = await this.getPartyOpeningBalance(partyId, companyId);
        const currentBalance = receivable - payable + openingBalance;

        await prisma.$executeRaw`UPDATE "Party" SET current_balance = ${currentBalance} WHERE id = ${partyId}`;
    }

    static async updateAccountCurrentBalance(accountId: string, companyId: string): Promise<void> {
        const { prisma } = await import('@/lib/prisma');

        const bankTransactions = await prisma.$queryRaw<any>`SELECT debit_amount, credit_amount FROM "BankBookTransaction" WHERE account_id = ${accountId} AND is_deleted = false`;
        const cashTransactions = await prisma.$queryRaw<any>`SELECT debit_amount, credit_amount FROM "CashBookTransaction" WHERE account_id = ${accountId} AND is_deleted = false`;
        const account = await prisma.$queryRaw<any>`SELECT opening_balance FROM "Account" WHERE id = ${accountId}`;

        let transactionBalance = 0;
        
        const processTxns = (txns: any[]) => {
            txns.forEach((t: any) => {
                const debit = Number(t.debit_amount) || 0;
                const credit = Number(t.credit_amount) || 0;
                transactionBalance += credit - debit;
            });
        };

        processTxns(bankTransactions);
        processTxns(cashTransactions);

        const openingBalance = account[0]?.opening_balance ? Number(account[0].opening_balance) : 0;
        const currentBalance = openingBalance + transactionBalance;

        await prisma.$executeRaw`UPDATE "Account" SET current_balance = ${currentBalance} WHERE id = ${accountId}`;
    }

    static checkSufficientBalance(
        transactionType: string,
        amount: number,
        accountBalance: number,
        partyPayableBalance: number,
        partyReceivableBalance: number
    ): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        const numAmount = this.toNumber(amount);

        if (transactionType === 'DEBIT') {
            if (numAmount > accountBalance) {
                errors.push(`Insufficient cash/bank balance. Available: ₹${accountBalance.toLocaleString()}, Requested: ₹${numAmount.toLocaleString()}`);
            }

            if (numAmount > partyReceivableBalance) {
                errors.push(`Party has insufficient receivable balance. Party receivable: ₹${partyReceivableBalance.toLocaleString()}, Requested payment: ₹${numAmount.toLocaleString()}`);
            }
        } else if (transactionType === 'CREDIT') {
            if (partyPayableBalance > 0 && numAmount > partyPayableBalance) {
                errors.push(`Party has insufficient payable balance. Party payable: ₹${partyPayableBalance.toLocaleString()}, Requested receipt: ₹${numAmount.toLocaleString()}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    static checkPartyBalance(
        transactionType: string,
        amount: number,
        partyPayableBalance: number,
        partyReceivableBalance: number,
        openingBalance: number = 0
    ): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        const numAmount = this.toNumber(amount);

        const availableReceivable = partyReceivableBalance + openingBalance;
        const availablePayable = partyPayableBalance + openingBalance;

        if (transactionType === 'DEBIT') {
            if (numAmount > availableReceivable) {
                errors.push(`Party has insufficient balance. Available: ₹${availableReceivable.toLocaleString()}, Requested payment: ₹${numAmount.toLocaleString()}`);
            }
        } else if (transactionType === 'CREDIT') {
            if (numAmount > availablePayable) {
                errors.push(`Party has insufficient balance. Available: ₹${availablePayable.toLocaleString()}, Requested receipt: ₹${numAmount.toLocaleString()}`);
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    static calculateBalance(
        openingBalance: number,
        transactions: Array<{
            transaction_type: string;
            debit_amount?: number | string | Decimal | null;
            credit_amount?: number | string | Decimal | null;
        }>
    ): BalanceCalculationResult {
        let currentBalance = openingBalance;
        let totalDebit = 0;
        let totalCredit = 0;

        const calculatedTransactions = transactions.map((t) => {
            const debit = this.toNumber(t.debit_amount);
            const credit = this.toNumber(t.credit_amount);

            totalDebit += debit;
            totalCredit += credit;

            if (t.transaction_type === 'DEBIT') {
                currentBalance -= debit;
            } else {
                currentBalance += credit;
            }

            return {
                id: '',
                date: new Date(),
                debit,
                credit,
                balance: currentBalance,
            };
        });

        return {
            openingBalance,
            totalDebit,
            totalCredit,
            closingBalance: currentBalance,
            transactions: calculatedTransactions,
        };
    }

    static validateRunningBalance(
        transactions: Array<{
            id: string;
            balance: number;
            transaction_type: string;
            debit_amount?: number | string | Decimal | null;
            credit_amount?: number | string | Decimal | null;
        }>
    ): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        for (let i = 0; i < transactions.length; i++) {
            const t = transactions[i];
            const expectedDebit = this.toNumber(t.debit_amount);
            const expectedCredit = this.toNumber(t.credit_amount);

            if (i > 0) {
                const prevBalance = transactions[i - 1].balance;
                let expectedBalance: number;

                if (t.transaction_type === 'DEBIT') {
                    expectedBalance = prevBalance - expectedDebit;
                } else {
                    expectedBalance = prevBalance + expectedCredit;
                }

                const actualBalance = this.toNumber(t.balance);
                if (Math.abs(actualBalance - expectedBalance) > 0.01) {
                    errors.push(
                        `Transaction ${t.id}: Running balance mismatch. Expected ₹${expectedBalance.toLocaleString()}, got ₹${actualBalance.toLocaleString()}`
                    );
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors,
        };
    }

    static getTransactionTypeEffect(transactionType: string): 'debit' | 'credit' {
        return transactionType === 'DEBIT' ? 'debit' : 'credit';
    }

    static describeBalanceChange(
        transactionType: string,
        amount: number
    ): { effect: string; newBalanceDirection: 'increase' | 'decrease' } {
        if (transactionType === 'DEBIT') {
            return {
                effect: `Debit of ₹${amount.toLocaleString()} decreases account balance`,
                newBalanceDirection: 'decrease',
            };
        } else {
            return {
                effect: `Credit of ₹${amount.toLocaleString()} increases account balance`,
                newBalanceDirection: 'increase',
            };
        }
    }
}

export interface AuditLogEntry {
    id: string;
    timestamp: Date;
    action: string;
    entity_type: string;
    entity_id: string;
    user_id?: string;
    details: Record<string, any>;
    ip_address?: string;
}

export class AuditLogger {
    private static logs: AuditLogEntry[] = [];

    static log(
        action: string,
        entityType: string,
        entityId: string,
        details: Record<string, any>,
        userId?: string
    ): AuditLogEntry {
        const entry: AuditLogEntry = {
            id: `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: new Date(),
            action,
            entity_type: entityType,
            entity_id: entityId,
            user_id: userId,
            details,
        };

        this.logs.push(entry);

        return entry;
    }

    static getLogs(filters?: {
        entityType?: string;
        entityId?: string;
        action?: string;
        fromDate?: Date;
        toDate?: Date;
    }): AuditLogEntry[] {
        let filtered = [...this.logs];

        if (filters?.entityType) {
            filtered = filtered.filter((l) => l.entity_type === filters.entityType);
        }
        if (filters?.entityId) {
            filtered = filtered.filter((l) => l.entity_id === filters.entityId);
        }
        if (filters?.action) {
            filtered = filtered.filter((l) => l.action === filters.action);
        }
        if (filters?.fromDate) {
            filtered = filtered.filter((l) => l.timestamp >= filters.fromDate!);
        }
        if (filters?.toDate) {
            filtered = filtered.filter((l) => l.timestamp <= filters.toDate!);
        }

        return filtered;
    }

    static clearLogs(): void {
        this.logs = [];
    }
}
