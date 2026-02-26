'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { formatARS, containerLabel, formatDate } from '@/lib/store';
import { ContainerKey, Shift, Transaction } from '@/lib/types';
import {
    getDashboardMetrics,
    getRecentTransactions,
    getActiveShift,
    getBalances
} from '@/app/actions';

const CONTAINERS: ContainerKey[] = [
    'efectivo',
    'mercado_pago',
    'caja_chica',
    'caja_fuerte',
];
const CONTAINER_ICONS: Record<ContainerKey, string> = {
    efectivo: '💵',
    mercado_pago: '📱',
    caja_chica: '🪙',
    caja_fuerte: '🔒',
};
const CONTAINER_COLORS: Record<ContainerKey, string> = {
    efectivo: '#22c55e',
    mercado_pago: '#3b82f6',
    caja_chica: '#f59e0b',
    caja_fuerte: '#6366f1',
};

export default function DashboardPage() {
    const { user, isAdmin } = useAuth();
    const router = useRouter();

    const [metrics, setMetrics] = useState<any>(null);
    const [recent, setRecent] = useState<(Transaction & { userName: string })[]>([]);
    const [balances, setBalances] = useState<Record<string, number>>({});
    const [activeShift, setActiveShift] = useState<Shift | null>(null);
    const [loading, setLoading] = useState(true);

    // Redirect non-admins to their respective page
    useEffect(() => {
        if (user && !isAdmin) {
            router.replace('/dashboard/turno');
        }
    }, [user, isAdmin, router]);

    const loadData = useCallback(async () => {
        if (!isAdmin) return;
        try {
            const [m, r, a, b] = await Promise.all([
                getDashboardMetrics(),
                getRecentTransactions(),
                getActiveShift(),
                getBalances()
            ]);
            setMetrics(m);
            setRecent(r);
            setActiveShift(a);
            setBalances(b as any);
        } catch (e) {
            console.error('Error al cargar dashboard', e);
        } finally {
            setLoading(false);
        }
    }, [isAdmin]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (!isAdmin) {
        return null;
    }

    if (loading || !metrics) {
        return <div style={{ color: 'var(--text2)', padding: '2rem' }}>Cargando dashboard...</div>;
    }

    const { today, last7, totals, topMargin, topSelling } = metrics;
    const maxVentas = Math.max(...last7.map((d: any) => d.ventas), 1);
    const hasOpenShift = activeShift !== null;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                        Buen día, {user?.name?.split(' ')[0]} 👋
                    </h1>
                    <p style={{ color: 'var(--text2)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        {formatDate(new Date())}
                    </p>
                </div>
                {(!isAdmin || hasOpenShift) && (
                    <button
                        className="btn btn-primary"
                        onClick={() => router.push('/dashboard/turno')}
                    >
                        ⏱️ {hasOpenShift ? 'Ver Turno Activo' : 'Abrir Turno'}
                    </button>
                )}
            </div>

            {/* Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                <div className="metric-card">
                    <div className="metric-label">Ventas Hoy</div>
                    <div className="metric-value" style={{ color: '#22c55e' }}>
                        {formatARS(today.ventas)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text2)' }}>Turno actual</div>
                </div>
                <div className="metric-card">
                    <div className="metric-label">Egresos Hoy</div>
                    <div className="metric-value" style={{ color: '#ef4444' }}>
                        {formatARS(today.egresos)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text2)' }}>Gastos del día</div>
                </div>
                <div className="metric-card">
                    <div className="metric-label">Balance Neto</div>
                    <div
                        className="metric-value"
                        style={{ color: today.balanceNeto >= 0 ? '#22c55e' : '#ef4444' }}
                    >
                        {formatARS(today.balanceNeto)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text2)' }}>Ventas − Egresos</div>
                </div>
                {!isAdmin && (
                    <div className="metric-card">
                        <div className="metric-label">Estado Turno</div>
                        <div className="metric-value" style={{ color: hasOpenShift ? '#f59e0b' : 'var(--text)' }}>
                            {hasOpenShift ? 'Activo' : 'Cerrado'}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text2)' }}>
                            {hasOpenShift ? 'Operaciones habilitadas' : 'Requiere apertura'}
                        </div>
                    </div>
                )}
                {/* New Cards for Cash Incomes & Total Expenses */}
                <div className="metric-card" style={{ borderColor: '#6366f1', borderWidth: isAdmin ? '2px' : '1px' }}>
                    <div className="metric-label" style={{ color: '#8b5cf6' }}>Ingresos Efectivo (Mes)</div>
                    <div className="metric-value" style={{ color: '#8b5cf6' }}>
                        {formatARS(totals?.ingresosEfectivo || 0)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text2)' }}>Entradas de efectivo</div>
                </div>
                <div className="metric-card" style={{ borderColor: '#ec4899', borderWidth: isAdmin ? '2px' : '1px' }}>
                    <div className="metric-label" style={{ color: '#ec4899' }}>Gastos Totales (Mes)</div>
                    <div className="metric-value" style={{ color: '#ec4899' }}>
                        {formatARS(totals?.gastosTotales || 0)}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text2)' }}>Todo tipo de egresos</div>
                </div>
            </div>

            {/* Containers */}
            <div>
                <h2 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text2)', marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    💰 Saldos de Contenedores
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem' }}>
                    {CONTAINERS.map((key) => {
                        if (key === 'caja_fuerte' && !isAdmin) return null;
                        const balance = balances[key] ?? 0;
                        return (
                            <div
                                key={key}
                                className="card"
                                style={{
                                    borderLeft: `3px solid ${CONTAINER_COLORS[key]}`,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '0.35rem',
                                }}
                            >
                                <div style={{ fontSize: '0.7rem', color: 'var(--text2)', fontWeight: 700, textTransform: 'uppercase' }}>
                                    {CONTAINER_ICONS[key]} {containerLabel(key)}
                                </div>
                                <div
                                    style={{
                                        fontSize: '1.25rem',
                                        fontWeight: 800,
                                        color: CONTAINER_COLORS[key],
                                    }}
                                >
                                    {formatARS(balance)}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Chart + Recents (2-col on desktop) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                {/* Bar chart - weekly ventas */}
                <div className="card">
                    <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: '1rem' }}>
                        📊 Evolución de Ventas (7 días)
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem', height: '120px' }}>
                        {last7.map((d: any) => (
                            <div
                                key={d.date}
                                style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem', height: '100%', justifyContent: 'flex-end' }}
                            >
                                <div
                                    style={{
                                        width: '100%',
                                        background: 'linear-gradient(180deg, #6366f1, #818cf8)',
                                        borderRadius: '4px 4px 0 0',
                                        height: `${Math.max((d.ventas / maxVentas) * 100, 2)}%`,
                                        minHeight: '4px',
                                        transition: 'height 0.3s ease',
                                    }}
                                    title={formatARS(d.ventas)}
                                />
                                <div style={{ fontSize: '0.6rem', color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                                    {formatDate(d.date).slice(0, 5)}
                                </div>
                            </div>
                        ))}
                    </div>
                    {maxVentas === 1 && (
                        <p style={{ textAlign: 'center', color: 'var(--text2)', fontSize: '0.75rem', marginTop: '0.5rem' }}>
                            Sin datos de ventas aún
                        </p>
                    )}
                </div>

                {/* Recent transactions */}
                <div className="card">
                    <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: '1rem' }}>
                        🕒 Últimas Transacciones
                    </h3>
                    {recent.length === 0 ? (
                        <p style={{ color: 'var(--text2)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem 0' }}>
                            No hay transacciones registradas
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {recent.map((tx) => (
                                <div
                                    key={tx.id}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '0.5rem',
                                        padding: '0.5rem 0',
                                        borderBottom: '1px solid var(--border)',
                                    }}
                                >
                                    <div style={{ minWidth: 0 }}>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {tx.description}
                                        </div>
                                        <div style={{ fontSize: '0.65rem', color: 'var(--text2)' }}>
                                            {tx.userName} · {tx.category}
                                        </div>
                                    </div>
                                    <div
                                        style={{
                                            fontWeight: 700,
                                            fontSize: '0.875rem',
                                            flexShrink: 0,
                                            color: tx.type === 'ingreso' ? '#22c55e' : tx.type === 'egreso' ? '#ef4444' : '#f59e0b',
                                        }}
                                    >
                                        {tx.type === 'ingreso' ? '+' : tx.type === 'egreso' ? '-' : '⇄'}{formatARS(tx.amount)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* --- PHASE 7: Analytics (Top Products) --- */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                {/* Top Selling Products */}
                <div className="card">
                    <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: '1rem' }}>
                        🔥 Más Vendidos (30 d)
                    </h3>
                    {!topSelling || topSelling.length === 0 ? (
                        <p style={{ color: 'var(--text2)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem 0' }}>
                            Sin datos suficientes
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {topSelling.map((p: any, i: number) => (
                                <div key={p.id || p.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: i < topSelling.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ color: 'white', background: '#3b82f6', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                            {i + 1}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.name}</div>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text2)' }}>
                                        {p.quantity} ud.
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Top Margin Products */}
                <div className="card">
                    <h3 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', marginBottom: '1rem', color: '#8b5cf6' }}>
                        💎 Mayor Rentabilidad (Margen %)
                    </h3>
                    {!topMargin || topMargin.length === 0 ? (
                        <p style={{ color: 'var(--text2)', fontSize: '0.8rem', textAlign: 'center', padding: '1rem 0' }}>
                            Sin datos configurados
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {topMargin.map((p: any, i: number) => (
                                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: i < topMargin.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <div style={{ color: 'white', background: '#8b5cf6', borderRadius: '50%', width: '24px', height: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 'bold' }}>
                                            {i + 1}
                                        </div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.name}</div>
                                    </div>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#22c55e' }}>
                                        {p.margin.toFixed(0)}%
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
