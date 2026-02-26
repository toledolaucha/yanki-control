'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AuditLog } from '@/lib/types';
import { getAuditLogs } from '@/app/actions';

export default function AuditoriaPage() {
    const { isAdmin } = useAuth();
    const router = useRouter();
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [filter, setFilter] = useState('');

    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

    useEffect(() => {
        if (!isAdmin) { router.replace('/dashboard'); return; }

        async function fetchLogs() {
            try {
                const data = await getAuditLogs();
                setLogs(data);
            } catch (error) {
                console.error("Failed to load audit logs", error);
            } finally {
                setLoading(false);
            }
        }

        fetchLogs();
    }, [isAdmin, router]);

    const filtered = logs.filter(
        (l) =>
            !filter ||
            l.userName.toLowerCase().includes(filter.toLowerCase()) ||
            l.action.toLowerCase().includes(filter.toLowerCase()) ||
            l.entityType.toLowerCase().includes(filter.toLowerCase())
    );

    const entityColors: Record<string, string> = {
        transaction: '#6366f1',
        shift: '#22c55e',
        user: '#f59e0b',
        container: '#3b82f6',
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>📋 Log de Auditoría</h1>
                <p style={{ color: 'var(--text2)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                    Historial completo de acciones realizadas en el sistema
                </p>
            </div>

            {/* Filter */}
            <div style={{ display: 'flex', gap: '0.75rem' }}>
                <input
                    className="input"
                    type="text"
                    placeholder="Filtrar por usuario, acción o tipo..."
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    style={{ maxWidth: '400px' }}
                />
                <div style={{ color: 'var(--text2)', fontSize: '0.8rem', display: 'flex', alignItems: 'center' }}>
                    {filtered.length} registros
                </div>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Fecha/Hora</th>
                                <th>Usuario</th>
                                <th>Acción</th>
                                <th>Entidad</th>
                                <th>Detalle</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text2)' }}>
                                        Cargando registros...
                                    </td>
                                </tr>
                            ) : filtered.length === 0 ? (
                                <tr>
                                    <td colSpan={5} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text2)' }}>
                                        No hay registros de auditoría
                                    </td>
                                </tr>
                            ) : (
                                filtered.map((log) => (
                                    <tr key={log.id}>
                                        <td style={{ color: 'var(--text2)', fontSize: '0.72rem', whiteSpace: 'nowrap' }}>
                                            {new Date(log.timestamp).toLocaleDateString('es-AR')}
                                            <br />
                                            {new Date(log.timestamp).toLocaleTimeString('es-AR')}
                                        </td>
                                        <td style={{ fontWeight: 600, fontSize: '0.8rem' }}>{log.userName}</td>
                                        <td style={{ fontSize: '0.8rem' }}>{log.action}</td>
                                        <td>
                                            <span
                                                className="badge"
                                                style={{
                                                    background: `${entityColors[log.entityType] ?? '#6b7280'}22`,
                                                    color: entityColors[log.entityType] ?? '#6b7280',
                                                }}
                                            >
                                                {log.entityType}
                                            </span>
                                        </td>
                                        <td style={{ fontSize: '0.72rem', color: 'var(--text2)', maxWidth: '200px', overflowX: 'auto', whiteSpace: 'nowrap' }}>
                                            ID: {log.entityId.slice(0, 8)}…<br />
                                            {log.action === 'POS_SALE_STOCK_DECREMENT' && log.after && (
                                                <span style={{ color: '#999' }}>Stock restante: {(log.after as any).remaining_stock}<br /></span>
                                            )}
                                            <button
                                                onClick={() => setSelectedLog(log)}
                                                style={{ marginTop: '0.3rem', background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline', padding: 0 }}
                                            >
                                                Ver detalle completo
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Detalle Modal */}
            {selectedLog && (
                <div className="modal-backdrop" onClick={() => setSelectedLog(null)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h2>Detalle de Auditoría</h2>
                        <div style={{ marginTop: '1rem', fontSize: '0.85rem' }}>
                            <p><strong>Acción:</strong> {selectedLog.action}</p>
                            <p><strong>Entidad:</strong> {selectedLog.entityType} ({selectedLog.entityId})</p>
                            <p><strong>Usuario:</strong> {selectedLog.userName}</p>
                            <p><strong>Fecha/Hora:</strong> {new Date(selectedLog.timestamp).toLocaleString('es-AR')}</p>
                        </div>

                        <div style={{ marginTop: '1.5rem', display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                            {selectedLog.before && (
                                <div style={{ flex: 1, backgroundColor: 'var(--bg-card)', border: '1px solid #fee2e2', padding: '1rem', borderRadius: '8px', overflowX: 'auto' }}>
                                    <h3 style={{ fontSize: '0.9rem', color: '#ef4444', marginBottom: '0.5rem' }}>Antes (Estado previo)</h3>
                                    <pre style={{ fontSize: '0.75rem', margin: 0, color: 'var(--text)' }}>
                                        {JSON.stringify(selectedLog.before, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {selectedLog.after && Object.keys(selectedLog.after).length > 0 && (
                                <div style={{ flex: 1, backgroundColor: 'var(--bg-card)', border: '1px solid #dcfce7', padding: '1rem', borderRadius: '8px', overflowX: 'auto' }}>
                                    <h3 style={{ fontSize: '0.9rem', color: '#22c55e', marginBottom: '0.5rem' }}>Después (Nuevo dato)</h3>
                                    <pre style={{ fontSize: '0.75rem', margin: 0, color: 'var(--text)' }}>
                                        {JSON.stringify(selectedLog.after, null, 2)}
                                    </pre>
                                </div>
                            )}
                        </div>

                        <div className="form-actions" style={{ marginTop: '2rem' }}>
                            <button className="btn btn-secondary" onClick={() => setSelectedLog(null)}>
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
