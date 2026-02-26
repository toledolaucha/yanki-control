'use client';

import { createContext, useContext, ReactNode } from 'react';
import { useSession, signIn, signOut, SessionProvider } from 'next-auth/react';
import { User } from '@/lib/types';

interface AuthContextValue {
    user: (Omit<User, 'password'> & { role: string }) | null;
    login: (email: string, password: string) => Promise<boolean>;
    logout: () => void;
    isAdmin: boolean;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function AuthContextInner({ children }: { children: ReactNode }) {
    const { data: session, status } = useSession();

    const user = session?.user ? {
        id: session.user.id,
        email: session.user.email!,
        name: session.user.name!,
        role: session.user.role,
        active: true,
        createdAt: new Date().toISOString(),
        createdBy: 'system'
    } as any : null;

    const isLoading = status === 'loading';
    const isAdmin = user?.role === 'ADMIN';

    async function login(email: string, password: string): Promise<boolean> {
        const res = await signIn('credentials', {
            redirect: false,
            email,
            password,
        });
        return !res?.error;
    }

    async function logout() {
        await signOut({ redirect: false });
        window.location.href = '/login';
    }

    return (
        <AuthContext.Provider value={{ user, login, logout, isAdmin, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
}

export function AuthProvider({ children }: { children: ReactNode }) {
    return (
        <SessionProvider>
            <AuthContextInner>{children}</AuthContextInner>
        </SessionProvider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
