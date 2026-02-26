'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatARS, formatDate } from '@/lib/store';
import { getReportsData, ReportRow, ReportsData } from '@/app/actions';

export default function ReportesPage() {
    const { isAdmin } = useAuth();
    const router = useRouter();
    const toast = useToast();

    const [from, setFrom] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().slice(0, 10);
    });
    const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
    const [reportsData, setReportsData] = useState<ReportsData>({ rows: [], totalMermas: 0 });
    const rows = reportsData.rows;
    const [loading, setLoading] = useState(true);

    const fetchReports = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getReportsData(from, to);
            setReportsData(data);
        } catch (e) {
            toast('Error general al obtener reportes', 'error');
        } finally {
            setLoading(false);
        }
    }, [from, to, toast]);

    useEffect(() => {
        if (!isAdmin) { router.replace('/dashboard'); return; }
        fetchReports();
    }, [isAdmin, fetchReports, router]);

    function exportCSV() {
        const header = 'Fecha,Período,Operador,Estado,Ventas,Egresos,CostoMercaderia,GananciaNeta,BalanceCaja,Transacciones\n';
        const data = rows
            .map(
                (r) =>
                    `${r.shift.date},${r.shift.period},${r.operatorName},${r.shift.status},${r.ventas},${r.egresos},${r.costoMercaderia},${r.gananciaNeta},${r.balance},${r.txCount}`
            )
            .join('\n');
        const blob = new Blob([header + data], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_${from}_${to}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function exportJSON() {
        const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_${from}_${to}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    const totalVentas = rows.reduce((a, b) => a + b.ventas, 0);
    const totalEgresos = rows.reduce((a, b) => a + b.egresos, 0);
    const totalBalance = rows.reduce((a, b) => a + b.balance, 0);
    const totalCogs = rows.reduce((a, b) => a + b.costoMercaderia, 0);
    const totalMermas = reportsData.totalMermas;
    const totalGanancia = rows.reduce((a, b) => a + b.gananciaNeta, 0) - totalMermas;

    const periodColors: Record<string, string> = {
        mañana: '#f59e0b',
        tarde: '#3b82f6',
        noche: '#6366f1',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>📈 Reportes</h1>
                <p style={{ color: 'var(--text2)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Exportá los datos de turnos por rango de fechas
                </p>
            </div>

            {/* Filters */}
            <div className="card">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
                    <div style={{ flex: '1 1 150px' }}>
                        <label className="input-label">Desde</label>
                        <input className="input" type="date" value={from} onChange={(e) => setFrom(e.target.value)} max={to} />
                    </div>
                    <div style={{ flex: '1 1 150px' }}>
                        <label className="input-label">Hasta</label>
                        <input className="input" type="date" value={to} onChange={(e) => setTo(e.target.value)} min={from} />
                    </div>
                    <button className="btn btn-primary" onClick={fetchReports} disabled={loading}>
                        {loading ? 'Cargando...' : '🔍 Filtrar'}
                    </button>
                    <button className="btn btn-secondary" onClick={exportCSV} disabled={rows.length === 0}>
                        📥 Exportar CSV
                    </button>
                    <button className="btn btn-secondary" onClick={exportJSON} disabled={rows.length === 0}>
                        📋 Exportar JSON
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ color: 'var(--text2)' }}>Cargando datos...</div>
            ) : (
                <>
                    {/* Summary */}
                    {rows.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                            <div className="metric-card">
                                <div className="metric-label">Turnos</div>
                                <div className="metric-value" style={{ fontSize: '1.5rem' }}>{rows.length}</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Ventas Brutas</div>
                                <div className="metric-value" style={{ fontSize: '1.2rem', color: '#22c55e' }}>{formatARS(totalVentas)}</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label" style={{ color: '#8b5cf6' }}>Costo Mcda.</div>
                                <div className="metric-value" style={{ fontSize: '1.2rem', color: '#8b5cf6' }}>{formatARS(totalCogs)}</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label" style={{ color: '#ef4444' }}>Mermas (Pérdidas)</div>
                                <div className="metric-value" style={{ fontSize: '1.2rem', color: '#ef4444' }}>{formatARS(totalMermas)}</div>
                            </div>
                            <div className="metric-card" style={{ background: 'var(--success)', color: 'white', borderColor: 'var(--success)' }}>
                                <div className="metric-label" style={{ color: 'rgba(255,255,255,0.9)' }}>Ganancia Final Real</div>
                                <div className="metric-value" style={{ fontSize: '1.4rem', color: 'white' }}>{formatARS(totalGanancia)}</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Egresos Caja</div>
                                <div className="metric-value" style={{ fontSize: '1.2rem', color: '#ef4444' }}>{formatARS(totalEgresos)}</div>
                            </div>
                            <div className="metric-card">
                                <div className="metric-label">Balance Neto Caja</div>
                                <div className="metric-value" style={{ fontSize: '1.2rem', color: totalBalance >= 0 ? '#22c55e' : '#ef4444' }}>{formatARS(totalBalance)}</div>
                            </div>
                        </div>
                    )}

                    {/* Table */}
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                        <div className="table-wrap">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Período</th>
                                        <th>Operador</th>
                                        <th>Estado</th>
                                        <th style={{ textAlign: 'right' }}>Ventas</th>
                                        <th style={{ textAlign: 'right', color: '#8b5cf6' }}>Costo M.</th>
                                        <th style={{ textAlign: 'right', color: '#16a34a' }}>Ganancia</th>
                                        <th style={{ textAlign: 'right' }}>Egresos Caja</th>
                                        <th style={{ textAlign: 'right' }}>Balance</th>
                                        <th>Movs.</th>
                                        <th>Acción</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text2)' }}>
                                                No hay turnos en el rango seleccionado
                                            </td>
                                        </tr>
                                    ) : (
                                        rows.map((r) => (
                                            <tr key={r.shift.id}>
                                                <td>{formatDate(r.shift.date)}</td>
                                                <td>
                                                    <span style={{ color: periodColors[r.shift.period] ?? 'var(--text)', fontWeight: 600, fontSize: '0.8rem' }}>
                                                        {r.shift.period}
                                                    </span>
                                                </td>
                                                <td style={{ fontSize: '0.8rem' }}>{r.operatorName}</td>
                                                <td>
                                                    <span className={`badge ${r.shift.status === 'open' ? 'badge-warning' : 'badge-success'}`}>
                                                        {r.shift.status}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>
                                                    {formatARS(r.ventas)}
                                                </td>
                                                <td style={{ textAlign: 'right', color: '#8b5cf6' }}>
                                                    {formatARS(r.costoMercaderia)}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 800, color: '#16a34a' }}>
                                                    {formatARS(r.gananciaNeta)}
                                                </td>
                                                <td style={{ textAlign: 'right', color: '#ef4444' }}>
                                                    {formatARS(r.egresos)}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 700, color: r.balance >= 0 ? '#22c55e' : '#ef4444' }}>
                                                    {formatARS(r.balance)}
                                                </td>
                                                <td style={{ textAlign: 'center', color: 'var(--text2)' }}>{r.txCount}</td>
                                                <td>
                                                    <button className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }} onClick={() => router.push(`/dashboard/turno?id=${r.shift.id}`)}>
                                                        Ver / Editar
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
