'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Sidebar } from '@/components/Sidebar';
import { ToastProvider } from '@/context/ToastContext';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { user, isLoading } = useAuth();
    const router = useRouter();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    useEffect(() => {
        if (!isLoading && !user) {
            router.replace('/login');
        }
    }, [user, isLoading, router]);

    if (isLoading || !user) {
        return (
            <div
                style={{
                    minHeight: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                }}
            >
                <div style={{ color: 'var(--text2)', fontSize: '0.875rem' }}>Cargando...</div>
            </div>
        );
    }

    return (
        <ToastProvider>
            <div style={{ display: 'flex', minHeight: '100vh' }}>
                <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

                <div className="main-with-sidebar" style={{ flex: 1, minHeight: '100vh' }}>
                    {/* Mobile header */}
                    <header
                        style={{
                            display: 'none',
                            position: 'sticky',
                            top: 0,
                            zIndex: 30,
                            background: 'var(--bg2)',
                            borderBottom: '1px solid var(--border)',
                            padding: '0.875rem 1rem',
                            alignItems: 'center',
                            gap: '0.75rem',
                        }}
                        className="mobile-header"
                    >
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSidebarOpen(true)}
                            style={{ padding: '0.5rem' }}
                        >
                            ☰
                        </button>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>Yanki 24</span>
                    </header>

                    <main style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
                        {children}
                    </main>
                </div>
            </div>

            <style>{`
        @media (max-width: 768px) {
          .mobile-header { display: flex !important; }
        }
      `}</style>
        </ToastProvider>
    );
}
