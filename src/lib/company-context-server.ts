import type { CompanyStore } from '@/types/index';

declare const EdgeRuntime: string | undefined;

const isEdgeRuntime = typeof EdgeRuntime === 'string';

let AsyncLocalStorage: any;
let companyContextInstance: any;
let isInitialized = false;

async function getCompanyContext() {
    if (isEdgeRuntime) {
        return {
            run: <T>(_store: CompanyStore, fn: () => T) => fn(),
            getStore: () => undefined,
        };
    }
    
    if (isInitialized && AsyncLocalStorage) {
        return companyContextInstance;
    }
    
    try {
        const asyncHooks = await import('node:async_hooks');
        AsyncLocalStorage = asyncHooks.AsyncLocalStorage;
        companyContextInstance = new AsyncLocalStorage();
        isInitialized = true;
    } catch {
        return {
            run: <T>(_store: CompanyStore, fn: () => T) => fn(),
            getStore: () => undefined,
        };
    }
    
    return companyContextInstance;
}

export async function getCompanyStore<T>(fn: (store: CompanyStore) => Promise<T>): Promise<T> {
    const context = await getCompanyContext();
    const store: CompanyStore = { company_id: '', isSuperAdmin: false };
    return context.run(store, () => fn(store));
}

export const companyContext = {
    run: async <T>(store: CompanyStore, fn: () => T): Promise<T> => {
        const context = await getCompanyContext();
        if (isEdgeRuntime) {
            return fn();
        }
        return context.run(store, fn);
    },
    getStore: (): CompanyStore | undefined => {
        if (isEdgeRuntime || !companyContextInstance) return undefined;
        return companyContextInstance.getStore();
    }
};
