'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
    const { login } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        setLoading(true);
        await new Promise((r) => setTimeout(r, 300)); // tiny delay for UX
        const ok = await login(email.trim(), password);
        setLoading(false);
        if (!ok) {
            setError('Email o contraseña incorrectos.');
            return;
        }
        router.push('/dashboard');
    }

    return (
        <main
            style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
                background: 'linear-gradient(135deg, #0f1117 0%, #1a1d2e 60%, #0f1117 100%)',
            }}
        >
            {/* Background glow */}
            <div
                style={{
                    position: 'fixed',
                    top: '20%',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '600px',
                    height: '600px',
                    background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
                    pointerEvents: 'none',
                }}
            />

            <div style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>
                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <div
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '64px',
                            height: '64px',
                            borderRadius: '16px',
                            background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
                            fontSize: '1.75rem',
                            marginBottom: '1rem',
                            boxShadow: '0 0 32px rgba(99,102,241,0.35)',
                        }}
                    >
                        🏪
                    </div>
                    <h1
                        style={{
                            fontSize: '1.75rem',
                            fontWeight: 800,
                            background: 'linear-gradient(135deg, #818cf8, #a78bfa)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            marginBottom: '0.25rem',
                        }}
                    >
                        Yanki 24
                    </h1>
                    <p style={{ color: 'var(--text2)', fontSize: '0.875rem' }}>
                        Gestión de Caja 24hs
                    </p>
                </div>

                {/* Card */}
                <div className="card" style={{ padding: '2rem' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.5rem' }}>
                        Iniciar sesión
                    </h2>

                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div>
                            <label className="input-label">Email</label>
                            <input
                                className="input"
                                type="email"
                                placeholder="usuario@kiosko.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                                autoComplete="email"
                            />
                        </div>

                        <div>
                            <label className="input-label">Contraseña</label>
                            <input
                                className="input"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                autoComplete="current-password"
                            />
                        </div>

                        {error && (
                            <div
                                style={{
                                    background: 'rgba(239,68,68,0.1)',
                                    border: '1px solid var(--danger)',
                                    borderRadius: '8px',
                                    padding: '0.6rem 0.875rem',
                                    fontSize: '0.8rem',
                                    color: '#fca5a5',
                                }}
                            >
                                {error}
                            </div>
                        )}

                        <button
                            className="btn btn-primary"
                            type="submit"
                            disabled={loading}
                            style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem', padding: '0.75rem' }}
                        >
                            {loading ? 'Ingresando...' : 'Ingresar'}
                        </button>
                    </form>


                </div>
            </div>
        </main>
    );
}
