'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useMemo, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Company, CompanyContextType } from '@/types';

interface CompanyProviderProps {
    children: ReactNode;
}

const CompanyContext = createContext<CompanyContextType | undefined>(undefined);

export function CompanyProvider({ children }: CompanyProviderProps) {
    const { data: session, status, update: updateSession } = useSession();
    const [currentCompany, setCurrentCompanyState] = useState<Company | null>(null);
    const [companies, setCompanies] = useState<Company[]>([]);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const abortControllerRef = useRef<AbortController | null>(null);
    const isFetchingRef = useRef(false);
    const prevSessionRef = useRef<string>('');
    const prevCompaniesRef = useRef<string>('');

    const fetchCompanies = useCallback(async (signal?: AbortSignal) => {
        if (isFetchingRef.current) return;
        
        isFetchingRef.current = true;
        setLoading(true);
        setError(null);

        try {
            const controller = new AbortController();
            abortControllerRef.current = controller;
            
            const response = await fetch('/api/companies', {
                cache: 'no-store',
                signal: signal || controller.signal,
            });
            
            if (!response.ok) {
                throw new Error(`Failed to fetch companies: ${response.statusText}`);
            }

            const result = await response.json();
            const companiesData = result.data || result;
            
            const companiesKey = JSON.stringify(companiesData);
            if (prevCompaniesRef.current !== companiesKey) {
                prevCompaniesRef.current = companiesKey;
                setCompanies(companiesData);
            }
            return companiesData;
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') {
                return;
            }
            const errorMessage = err instanceof Error ? err.message : 'Failed to fetch companies';
            setError(errorMessage);
        } finally {
            setLoading(false);
            isFetchingRef.current = false;
        }
    }, []);

    useEffect(() => {
        if (status === 'loading') return;
        
        const controller = new AbortController();
        fetchCompanies(controller.signal);

        return () => {
            controller.abort();
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, [status, fetchCompanies]);

    useEffect(() => {
        if (status === 'loading') return;
        if (status === 'unauthenticated') {
            if (currentCompany !== null) {
                setCurrentCompanyState(null);
            }
            if (companies.length > 0) {
                setCompanies([]);
            }
            setIsSuperAdmin(false);
            return;
        }
        
        if (status === 'authenticated' && session?.user) {
            const user = session.user as unknown as Record<string, unknown>;
            const userCompanyId = user.company_id as string | null | undefined;
            const userCompanyName = user.company_name as string | null | undefined;
            const userRole = user.role as string | null | undefined;
            
            setIsSuperAdmin(userRole === 'SuperAdmin');

            const savedCompanyId = sessionStorage.getItem('current_company_id');
            const targetCompanyId = savedCompanyId || userCompanyId;

            if (targetCompanyId && companies.length > 0) {
                const targetCompany = companies.find((t: Company) => t.id === targetCompanyId);
                if (targetCompany) {
                    setCurrentCompanyState(targetCompany);
                }
            } else if (targetCompanyId && userCompanyName && !currentCompany) {
                setCurrentCompanyState({ id: targetCompanyId, company_name: userCompanyName } as Company);
            }
        }
    }, [status, session, companies, currentCompany]);

    const setCurrentCompany = useCallback((company: Company | null) => {
        setCurrentCompanyState(company);
        setError(null);
    }, []);

    const refreshCurrentCompany = useCallback(async () => {
        if (!currentCompany) return;

        try {
            const response = await fetch(`/api/companies/${currentCompany.id}`);
            if (response.ok) {
                const updatedCompany = await response.json();
                setCurrentCompanyState(updatedCompany);
            }
        } catch (err) {
            console.error('Failed to refresh current company:', err);
        }
    }, [currentCompany]);

    const switchCompany = useCallback(async (companyId: string | { id: string }) => {
        const company_id = typeof companyId === 'string' ? companyId : companyId.id;
        const company = companies.find((t: Company) => t.id === company_id);

        if (!company) {
            setError('Company not found');
            return;
        }

        sessionStorage.setItem('current_company_id', company_id);
        setCurrentCompanyState(company);

        try {
            await fetch('/api/switch-company', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ company_id }),
            });
            
            await updateSession({
                company_id: company_id,
            });
            
            window.location.reload();
        } catch (err) {
            console.error('Failed to update session:', err);
            window.location.reload();
        }
    }, [companies, session, updateSession]);

    const contextValue = useMemo<CompanyContextType>(() => ({
        currentCompany: currentCompany,
        companies: companies,
        isSuperAdmin,
        loading,
        error,
        setCurrentCompany: setCurrentCompany,
        fetchCompanies: fetchCompanies,
        switchCompany: switchCompany,
        refreshCurrentCompany: refreshCurrentCompany,
    }), [currentCompany, companies, isSuperAdmin, loading, error, setCurrentCompany, fetchCompanies, switchCompany, refreshCurrentCompany]);

    return React.createElement(
        CompanyContext.Provider,
        { value: contextValue },
        children
    );
}

export function useCompanyContext() {
    const context = useContext(CompanyContext);
    if (context === undefined) {
        throw new Error('useCompanyContext must be used within a CompanyProvider');
    }
    return context;
}
