'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatARS, formatDate } from '@/lib/store';
import { Transaction } from '@/lib/types';
import { getBalances, getPettyCashTransactions, addPettyCashTransaction } from '@/app/actions';
import { CurrencyInput } from '@/components/CurrencyInput';

export default function CajaChicaPage() {
    const { user, isAdmin } = useAuth();
    const router = useRouter();
    const toast = useToast();

    const [balance, setBalance] = useState(0);
    const [txs, setTxs] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [type, setType] = useState<'ingreso' | 'egreso'>('ingreso');
    const [amount, setAmount] = useState<number | undefined>();
    const [description, setDescription] = useState('');
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);

    const reload = useCallback(async () => {
        try {
            setLoading(true);
            const bals = await getBalances();
            const pastTxs = await getPettyCashTransactions();

            setBalance(bals.caja_chica);
            setTxs(pastTxs);
        } catch (e) {
            toast('Error conectando a la base de datos', 'error');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (!isAdmin) { router.replace('/dashboard'); return; }
        reload();
    }, [isAdmin, reload, router]);

    async function handleSubmit() {
        setError('');
        if (!user) return;
        const amt = amount || 0;
        if (amt <= 0) { setError('Monto inválido'); return; }
        if (!description.trim()) { setError('Ingresá una descripción'); return; }

        if (type === 'egreso' && amt > balance) {
            setError(`Saldo insuficiente. Disponible: ${formatARS(balance)}`);
            return;
        }

        try {
            setSaving(true);
            await addPettyCashTransaction({
                type,
                amount: amt,
                description: description.trim()
            });
            setShowModal(false);
            setAmount(undefined);
            setDescription('');
            toast(`Ajuste (${type}) en Caja Chica registrado`, 'success');
            await reload();
        } catch (e: any) {
            setError(e.message || 'Error al guardar la operación');
        } finally {
            setSaving(false);
        }
    }

    if (loading) return <div style={{ color: 'var(--text2)' }}>Cargando caja chica...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>🪙 Caja Chica</h1>
                    <p style={{ color: 'var(--text2)', fontSize: '0.875rem' }}>
                        Supervisión y ajustes manuales de Caja Chica
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                    ➕ Nuevo Movimiento
                </button>
            </div>

            {/* Balance */}
            <div
                className="card"
                style={{
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(251, 191, 36, 0.1) 100%)',
                    borderColor: '#f59e0b',
                    textAlign: 'center',
                    padding: '2.5rem',
                }}
            >
                <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.75rem' }}>
                    🪙 Saldo Actual — Caja Chica
                </div>
                <div style={{ fontSize: '3rem', fontWeight: 900, color: '#d97706' }}>
                    {formatARS(balance)}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginTop: '0.5rem' }}>
                    Pesos Argentinos (ARS)
                </div>
            </div>

            {/* History */}
            <div className="card">
                <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: '1rem' }}>
                    📋 Historial de Movimientos
                </h3>
                {txs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text2)', fontSize: '0.875rem' }}>
                        No hay movimientos directos registrados en Caja Chica
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Descripción</th>
                                    <th>Tipo</th>
                                    <th style={{ textAlign: 'right' }}>Monto</th>
                                </tr>
                            </thead>
                            <tbody>
                                {txs.map((tx) => (
                                    <tr key={tx.id}>
                                        <td style={{ color: 'var(--text2)', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>
                                            {formatDate(tx.createdAt)}
                                        </td>
                                        <td>{tx.description}</td>
                                        <td>
                                            <span className={`badge ${tx.type === 'ingreso' ? 'badge-success' : 'badge-danger'}`}>
                                                {tx.type}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, color: tx.type === 'ingreso' ? '#22c55e' : '#ef4444' }}>
                                            {tx.type === 'ingreso' ? '+' : '-'}{formatARS(tx.amount)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-backdrop" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>
                            🪙 Movimiento en Caja Chica
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {(['ingreso', 'egreso'] as const).map((t) => (
                                    <button
                                        key={t}
                                        className={`btn ${type === t ? (t === 'ingreso' ? 'btn-success' : 'btn-danger') : 'btn-secondary'}`}
                                        style={{ flex: 1, justifyContent: 'center' }}
                                        onClick={() => { setType(t); setError(''); }}
                                    >
                                        {t === 'ingreso' ? '↑ Ingresar Saldo' : '↓ Retirar Saldo'}
                                    </button>
                                ))}
                            </div>
                            <div>
                                <label className="input-label">Monto (ARS)</label>
                                <CurrencyInput
                                    className="input"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(val) => setAmount(val)}
                                />
                            </div>
                            <div>
                                <label className="input-label">Descripción</label>
                                <input className="input" type="text" placeholder="Ej: Faltante, Ajuste manual, etc." value={description} onChange={(e) => setDescription(e.target.value)} />
                            </div>
                            {error && (
                                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: '8px', padding: '0.6rem 0.875rem', fontSize: '0.8rem', color: '#fca5a5' }}>
                                    {error}
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <button className="btn btn-secondary" onClick={() => { setShowModal(false); setError(''); }} style={{ flex: 1 }} disabled={saving}>Cancelar</button>
                                <button className="btn btn-primary" onClick={handleSubmit} style={{ flex: 1 }} disabled={saving}>
                                    {saving ? 'Guardando...' : 'Confirmar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
