'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

interface UserData {
    name: string | null;
    email: string | null;
    profile_photo: string | null;
}

interface UserContextType {
    user: UserData | null;
    setUser: (user: UserData | null) => void;
    updateUser: (updates: Partial<UserData>) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
    const [user, setUserState] = useState<UserData | null>(null);

    useEffect(() => {
        const stored = localStorage.getItem('user_data');
        if (stored) {
            try {
                setUserState(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse user data', e);
            }
        }
    }, []);

    const setUser = useCallback((newUser: UserData | null) => {
        setUserState(newUser);
        if (newUser) {
            localStorage.setItem('user_data', JSON.stringify(newUser));
        } else {
            localStorage.removeItem('user_data');
        }
    }, []);

    const updateUser = useCallback((updates: Partial<UserData>) => {
        setUserState(prev => {
            const updated = prev ? { ...prev, ...updates } : updates as UserData;
            localStorage.setItem('user_data', JSON.stringify(updated));
            return updated;
        });
    }, []);

    return (
        <UserContext.Provider value={{ user, setUser, updateUser }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUser() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUser must be used within a UserProvider');
    }
    return context;
}
