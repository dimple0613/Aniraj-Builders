import { PrismaClient } from '@prisma/client'

const isServer = typeof window === 'undefined';

let companyContext: any = null;

if (isServer) {
    (async () => {
        try {
            const module = await import('./company-context-server');
            companyContext = module.companyContext;
        } catch {
            // Running in browser or module not available
        }
    })();
}

function createPrismaClient(serverLog: boolean = false): PrismaClient {
    const baseClient = new PrismaClient({
        log: serverLog ? ['query'] : [],
    });

    if (!isServer || !companyContext) {
        return baseClient;
    }

    // Type-safe wrapper for $extends
    const getExtendedClient = (client: PrismaClient): PrismaClient => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return (client as any).$extends({
                query: {
                    $allModels: {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        // eslint-disable-next-line @typescript-eslint/no-unused-vars
                        async $allOperations({ model, operation, args, query }: { model: string; operation: string; args: unknown; query: (args: unknown) => Promise<unknown> }) {
                            let store;
                            try {
                                if (companyContext?.getStore) {
                                    store = companyContext.getStore();
                                }
                            } catch {
                                return query(args);
                            }

                            const globalModels = ['Company', 'ItemManagement', 'Unit', 'SORItem', 'CapitalSOR', 'CapitalSORPrice', 'Department', 'ItemMaster', 'WorkType', 'ProjectArea', 'Location', 'ProjectWorkType'];

                            // Models without a company_id field - they are scoped via parent relations
                            const noCompanyIdModels = ['PayrollPeriod', 'EmployeeSalaryComponent', 'PayrollItem', 'PayrollItemComponent', 'Payslip', 'ReimbursementAttachment', 'LoanRepayment'];
                            if (store?.isSuperAdmin || globalModels.includes(model) || noCompanyIdModels.includes(model)) {
                                return query(args);
                            }

                            const company_id = store?.company_id;
                            if (!company_id) {
                                return query(args);
                            }

                            const anyArgs = args as Record<string, unknown>;

                            if (['findFirst', 'findMany', 'count', 'aggregate', 'groupBy'].includes(operation)) {
                                anyArgs.where = { ...anyArgs.where as object, company_id };
                            }

                            const anyClient = baseClient as unknown as Record<string, { findFirst: Function }>;

                            if (operation === 'findUnique') {
                                return anyClient[model].findFirst({
                                    ...anyArgs,
                                    where: { ...anyArgs.where as object, company_id }
                                });
                            }

                            if (['create', 'createMany'].includes(operation)) {
                                if (Array.isArray(anyArgs.data)) {
                                    anyArgs.data = anyArgs.data.map((item: Record<string, unknown>) => ({ ...item, company_id }));
                                } else {
                                    anyArgs.data = { ...anyArgs.data as object, company_id };
                                }
                            }

                            if (['update', 'updateMany', 'upsert', 'delete', 'deleteMany'].includes(operation)) {
                                anyArgs.where = { ...anyArgs.where as object, company_id };
                            }

                            return query(anyArgs);
                        },
                    },
                },
            });
        } catch {
            return client;
        }
    };

    return getExtendedClient(baseClient);
}

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || createPrismaClient(process.env.NODE_ENV === 'development')

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
