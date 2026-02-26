'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
    formatARS,
    periodLabel,
    containerLabel,
    formatDate
} from '@/lib/store';
import {
    AppState,
    Shift,
    ShiftPeriod,
    Transaction,
    ContainerKey,
    TransactionCategory,
} from '@/lib/types';
import {
    getActiveShift,
    getShiftTransactions,
    getBalances,
    getClosedShifts,
    openShift,
    closeShift,
    addTransaction,
    getShift,
    deleteTransaction,
    processSale
} from '@/app/actions';
import { CurrencyInput } from '@/components/CurrencyInput';
import { POSModal } from '@/components/POSModal';

// ── helpers ──────────────────────────────────────────────────────────────────

function getCurrentPeriod(): ShiftPeriod {
    const h = new Date().getHours();
    if (h >= 6 && h < 14) return 'mañana';
    if (h >= 14 && h < 22) return 'tarde';
    return 'noche';
}

function getBusinessDate(): string {
    const now = new Date();
    // If before 6 AM, it belongs to the previous commercial day
    if (now.getHours() < 6) {
        now.setDate(now.getDate() - 1);
    }
    return now.toISOString().slice(0, 10);
}

// ── types ─────────────────────────────────────────────────────────────────────

interface TxFormData {
    type: 'ingreso' | 'egreso';
    category: TransactionCategory;
    amount: number | undefined;
    container: ContainerKey;
    description: string;
}

const EGRESO_CATEGORIES: { value: TransactionCategory; label: string }[] = [
    { value: 'proveedor', label: 'Pago Proveedor' },
    { value: 'sueldo', label: 'Adelanto Sueldo' },
    { value: 'retiro_chica', label: 'Retiro Caja Chica' },
    { value: 'otro_egreso', label: 'Otro Egreso' },
];
const INGRESO_CATEGORIES: { value: TransactionCategory; label: string }[] = [
    { value: 'venta', label: 'Venta / Ingreso' },
    { value: 'deposito_chica', label: 'Depósito en Caja Chica' },
    { value: 'otro_ingreso', label: 'Otro Ingreso' },
];

// ── Main component ────────────────────────────────────────────────────────────

function TurnoContent() {
    const { user, isAdmin } = useAuth();
    const toast = useToast();
    const searchParams = useSearchParams();
    const queryShiftId = searchParams.get('id');

    // Replicamos la fisonomía del store mock para que funcione la UI sin cambios enormes
    const [appState, setAppState] = useState<AppState | null>(null);
    const [activeShift, setActiveShift] = useState<Shift | null>(null);
    const [shiftTxs, setShiftTxs] = useState<Transaction[]>([]);

    // Open shift form
    const [showOpenForm, setShowOpenForm] = useState(false);
    const [openDate, setOpenDate] = useState(getBusinessDate());
    const [openPeriod, setOpenPeriod] = useState<ShiftPeriod>(getCurrentPeriod());
    const [cashStart, setCashStart] = useState<number | undefined>();
    const [mpStart, setMpStart] = useState<number | undefined>();
    const [openNotes, setOpenNotes] = useState('');

    // POS & Transaction forms
    const [showPosModal, setShowPosModal] = useState(false);
    const [showTxModal, setShowTxModal] = useState(false);
    const [txForm, setTxForm] = useState<TxFormData>({
        type: 'ingreso',
        category: 'venta',
        amount: undefined,
        container: 'efectivo',
        description: '',
    });
    const [txError, setTxError] = useState('');
    const [loadingTx, setLoadingTx] = useState(false);

    // Load state
    const reload = useCallback(async () => {
        try {
            let shift = null;
            if (isAdmin && queryShiftId) {
                shift = await getShift(queryShiftId);
            } else {
                shift = await getActiveShift();
            }
            const txs = shift ? await getShiftTransactions(shift.id) : [];
            const bals = await getBalances();
            const pastShifts = await getClosedShifts();

            setActiveShift(shift);
            setShiftTxs(txs);
            setAppState({
                users: [],
                shifts: shift ? [shift, ...pastShifts] : pastShifts,
                transactions: txs,
                containers: bals,
                auditLogs: []
            });
        } catch (e) {
            console.error('Error al cargar datos:', e);
            toast('Error conectando a la base de datos', 'error');
        }
    }, [toast]);

    useEffect(() => {
        reload();
    }, [reload, queryShiftId, isAdmin]);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'F6') {
                e.preventDefault(); // Prevent browser default for F6
                if (!isAdmin && activeShift) {
                    setShowPosModal(true);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isAdmin, activeShift]);

    if (!appState || !user) return <div style={{ color: 'var(--text2)' }}>Cargando datos...</div>;

    // ── Open shift ──────────────────────────────────────────────────────────────

    async function handleOpenShift() {
        if (!user) return;
        const cash = cashStart;
        const mp = mpStart;
        if (cash === undefined || cash < 0) { toast('Ingresá un monto inicial de efectivo válido', 'error'); return; }
        if (mp === undefined || mp < 0) { toast('Ingresá un monto inicial de Mercado Pago válido', 'error'); return; }

        try {
            await openShift({ date: openDate, period: openPeriod, cashStart: cash, mpStart: mp, notes: openNotes });
            setShowOpenForm(false);
            setCashStart(undefined); setMpStart(undefined); setOpenNotes('');
            toast(`Turno ${openPeriod} abierto correctamente`, 'success');
            await reload();
        } catch (e: any) {
            toast(e.message || 'Error al abrir turno', 'error');
        }
    }

    // ── Close shift ─────────────────────────────────────────────────────────────

    async function handleCloseShift() {
        if (!user || !activeShift) return;
        if (!confirm('¿Confirmar cierre del turno? Esta acción es definitiva.')) return;

        try {
            let cashBal = activeShift.cashStart;
            let mpBal = activeShift.mpStart;
            for (const t of shiftTxs) {
                if (t.type === 'ingreso') {
                    if (t.destContainer === 'efectivo') cashBal += t.amount;
                    if (t.destContainer === 'mercado_pago') mpBal += t.amount;
                } else if (t.type === 'egreso') {
                    if (t.sourceContainer === 'efectivo') cashBal -= t.amount;
                    if (t.sourceContainer === 'mercado_pago') mpBal -= t.amount;
                }
            }
            await closeShift(activeShift.id, Math.max(0, cashBal), Math.max(0, mpBal));
            toast('Turno cerrado correctamente', 'success');
            await reload();
        } catch (e: any) { toast(e.message || 'Error al cerrar turno', 'error'); }
    }

    // ── Add POS Sale ─────────────────────────────────────────────────────────────

    async function handleConfirmSale(items: { productId: string, quantity: number, price: number }[], paymentMethod: ContainerKey) {
        if (!user || !activeShift) return;
        try {
            await processSale(activeShift.id, items, paymentMethod);
            toast('Venta POS registrada correctamente', 'success');
            await reload();
        } catch (e: any) {
            toast(e.message || 'Error al procesar Venta POS', 'error');
            throw e; // rethrow to modal
        }
    }

    // ── Add transaction ─────────────────────────────────────────────────────────

    async function handleAddTx() {
        if (!user || !activeShift || !appState) return;
        setTxError('');

        const amount = txForm.amount || 0;
        if (amount <= 0) { setTxError('El monto debe ser mayor a cero'); return; }
        if (!txForm.description.trim()) { setTxError('Ingresá una descripción'); return; }

        // Client validation optional logic for auto-caja_chica could be ported, but better trust DB for exact balance error (or do simple check here)
        if (txForm.type === 'egreso') {
            const currentBalance = appState.containers[txForm.container] ?? 0;
            if (amount > currentBalance) {
                if (txForm.category === 'proveedor' && txForm.container === 'efectivo' && appState.containers.caja_chica >= amount) {
                    try {
                        setLoadingTx(true);
                        await addTransaction({
                            shiftId: activeShift.id,
                            type: 'egreso',
                            category: 'retiro_chica',
                            container: 'caja_chica',
                            amount,
                            description: `(Auto) Caja Chica → ${txForm.description}`
                        });
                        setShowTxModal(false);
                        setTxForm({ type: 'ingreso', category: 'venta', amount: undefined, container: 'efectivo', description: '' });
                        toast('Pago registrado usando Caja Chica (efectivo insuficiente)', 'info');
                        await reload();
                    } catch (e: any) { setTxError(e.message) } finally { setLoadingTx(false); }
                    return;
                }
                setTxError(`Saldo insuficiente en ${containerLabel(txForm.container)} (disponible: ${formatARS(currentBalance)})`);
                return;
            }
        }

        try {
            setLoadingTx(true);
            await addTransaction({
                shiftId: activeShift.id,
                type: txForm.type,
                category: txForm.category,
                container: txForm.container,
                amount,
                description: txForm.description
            });
            setShowTxModal(false);
            setTxForm({ type: 'ingreso', category: 'venta', amount: undefined, container: 'efectivo', description: '' });
            toast('Transacción registrada correctamente', 'success');
            await reload();
        } catch (e: any) {
            setTxError(e.message || 'Error en la transacción');
        } finally {
            setLoadingTx(false);
        }
    }

    // ── Computed totals ─────────────────────────────────────────────────────────

    const totalIngresos = shiftTxs.filter((t) => t.type === 'ingreso').reduce((a, b) => a + b.amount, 0);
    const totalEgresos = shiftTxs.filter((t) => t.type === 'egreso').reduce((a, b) => a + b.amount, 0);
    const saldoTurno = (activeShift?.cashStart ?? 0) + (activeShift?.mpStart ?? 0) + totalIngresos - totalEgresos;

    // ── Render ──────────────────────────────────────────────────────────────────

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>⏱️ Gestión de Turno</h1>
                    <p style={{ color: 'var(--text2)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        {activeShift
                            ? `${periodLabel(activeShift.period)} · ${formatDate(activeShift.date)}`
                            : 'Sin turno activo'}
                    </p>
                </div>
                {!activeShift && !isAdmin && (
                    <button className="btn btn-success" onClick={() => setShowOpenForm(true)}>
                        ➕ Abrir Turno
                    </button>
                )}
                {activeShift && (!isAdmin || queryShiftId) && (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button className="btn btn-primary" onClick={() => setShowTxModal(true)}>
                            ➕ Nueva Transacción
                        </button>
                        {activeShift.status === 'open' && (
                            <button className="btn btn-danger" onClick={handleCloseShift}>
                                🔒 Cerrar Turno
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Active shift card */}
            {activeShift ? (
                <>
                    {/* Summary cards */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem' }}>
                        <div className="metric-card">
                            <div className="metric-label">Saldo Inicial</div>
                            <div className="metric-value" style={{ fontSize: '1.2rem' }}>
                                {formatARS(activeShift.cashStart + activeShift.mpStart)}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text2)' }}>
                                💵 {formatARS(activeShift.cashStart)} + 📱 {formatARS(activeShift.mpStart)}
                            </div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-label">Ingresos</div>
                            <div className="metric-value" style={{ fontSize: '1.2rem', color: '#22c55e' }}>
                                +{formatARS(totalIngresos)}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text2)' }}>{shiftTxs.filter((t) => t.type === 'ingreso').length} transacciones</div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-label">Egresos</div>
                            <div className="metric-value" style={{ fontSize: '1.2rem', color: '#ef4444' }}>
                                -{formatARS(totalEgresos)}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text2)' }}>{shiftTxs.filter((t) => t.type === 'egreso').length} transacciones</div>
                        </div>
                        <div className="metric-card" style={{ borderColor: saldoTurno >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            <div className="metric-label">Saldo del Turno</div>
                            <div className="metric-value" style={{ fontSize: '1.2rem', color: saldoTurno >= 0 ? '#22c55e' : '#ef4444' }}>
                                {formatARS(saldoTurno)}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text2)' }}>Balance total</div>
                        </div>
                    </div>

                    {/* Transaction list */}
                    <div className="card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', margin: 0 }}>
                                📋 Transacciones del Turno ({shiftTxs.length})
                            </h3>
                            {!isAdmin && (
                                <button
                                    className="btn btn-success"
                                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                                    onClick={() => setShowPosModal(true)}
                                >
                                    ➕ Cargar Venta (F6)
                                </button>
                            )}
                        </div>
                        {shiftTxs.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text2)', fontSize: '0.875rem' }}>
                                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                                No hay transacciones en este turno.<br />
                                Usá el botón Nueva Transacción para empezar.
                            </div>
                        ) : (
                            <div className="table-wrap">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Descripción</th>
                                            <th>Categoría</th>
                                            <th>Contenedor</th>
                                            <th>Tipo</th>
                                            <th style={{ textAlign: 'right' }}>Monto</th>
                                            <th>Hora</th>
                                            <th style={{ textAlign: 'right' }}>Acción</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...shiftTxs].reverse().map((tx) => (
                                            <tr key={tx.id}>
                                                <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {tx.description}
                                                </td>
                                                <td>
                                                    <span className={`badge badge-${tx.type === 'ingreso' ? 'success' : tx.type === 'egreso' ? 'danger' : 'warning'}`}>
                                                        {tx.category}
                                                    </span>
                                                </td>
                                                <td style={{ color: 'var(--text2)', fontSize: '0.75rem' }}>
                                                    {tx.sourceContainer ? containerLabel(tx.sourceContainer) : tx.destContainer ? containerLabel(tx.destContainer) : '—'}
                                                </td>
                                                <td>
                                                    <span className={`badge badge-${tx.type === 'ingreso' ? 'success' : tx.type === 'egreso' ? 'danger' : 'warning'}`}>
                                                        {tx.type}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 700, color: tx.type === 'ingreso' ? '#22c55e' : '#ef4444' }}>
                                                    {tx.type === 'ingreso' ? '+' : '-'}{formatARS(tx.amount)}
                                                </td>
                                                <td style={{ color: 'var(--text2)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                                    {new Date(tx.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    {(isAdmin || tx.category === 'venta') && (
                                                        <button
                                                            onClick={async () => {
                                                                const isSale = tx.category === 'venta';
                                                                const confMsg = isSale
                                                                    ? '¿Anular esta Venta de Caja?\n\nAl confirmar, el monto se restará de la caja y los productos serán devueltos al Inventario automáticamente.'
                                                                    : '¿Eliminar esta transacción?\n\nSe recalcularán los saldos de la caja correspondientes.';

                                                                if (confirm(confMsg)) {
                                                                    try {
                                                                        await deleteTransaction(tx.id);
                                                                        toast(isSale ? 'Venta anulada y stock devuelto' : 'Transacción eliminada', 'success');
                                                                        reload();
                                                                    } catch (e: any) {
                                                                        toast(e.message, 'error');
                                                                    }
                                                                }
                                                            }}
                                                            className="btn btn-danger btn-sm"
                                                            style={{ padding: '0.2rem 0.5rem', fontSize: '0.7rem' }}
                                                        >
                                                            🗑️
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                /* No active shift state */
                <div className="card" style={{ textAlign: 'center', padding: '3rem 1.5rem' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌙</div>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                        No hay un turno activo
                    </h2>
                    <p style={{ color: 'var(--text2)', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                        Abrí un turno para empezar a registrar ventas y movimientos.
                        Podés cargar turnos retroactivos de días anteriores.
                    </p>
                    <button className="btn btn-success" onClick={() => setShowOpenForm(true)} style={{ margin: '0 auto' }}>
                        ➕ Abrir Turno
                    </button>

                    {/* Recent closed shifts */}
                    {appState && appState.shifts.filter((s) => s.status === 'closed').length > 0 && (
                        <div style={{ marginTop: '2rem', textAlign: 'left' }}>
                            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
                                Turnos Cerrados Recientes
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {[...appState.shifts]
                                    .filter((s) => s.status === 'closed')
                                    .reverse()
                                    .slice(0, 5)
                                    .map((sh) => {
                                        return (
                                            <div
                                                key={sh.id}
                                                style={{
                                                    display: 'flex',
                                                    justifyContent: 'space-between',
                                                    alignItems: 'center',
                                                    padding: '0.6rem 0.75rem',
                                                    background: 'var(--bg3)',
                                                    borderRadius: '8px',
                                                    fontSize: '0.8rem',
                                                }}
                                            >
                                                <div>
                                                    <span style={{ fontWeight: 600 }}>{formatDate(sh.date)}</span>
                                                    <span style={{ color: 'var(--text2)', marginLeft: '0.5rem' }}>{sh.period}</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── Open shift modal ─────────────────────────────────────────────────── */}
            {showOpenForm && (
                <div className="modal-backdrop" onClick={() => setShowOpenForm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>
                            ➕ Abrir Nuevo Turno
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                            <div>
                                <label className="input-label">Fecha</label>
                                <input
                                    className="input"
                                    type="date"
                                    value={openDate}
                                    max={new Date().toISOString().slice(0, 10)}
                                    onChange={(e) => setOpenDate(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="input-label">Período</label>
                                <select
                                    className="input"
                                    value={openPeriod}
                                    onChange={(e) => setOpenPeriod(e.target.value as ShiftPeriod)}
                                >
                                    <option value="mañana">🌅 Mañana (06:00–14:00)</option>
                                    <option value="tarde">☀️ Tarde (14:00–22:00)</option>
                                    <option value="noche">🌙 Noche (22:00–06:00)</option>
                                </select>
                            </div>
                            <div>
                                <label className="input-label">Saldo Inicial Efectivo (ARS)</label>
                                <CurrencyInput
                                    className="input"
                                    placeholder="0.00"
                                    value={cashStart}
                                    onChange={(val) => setCashStart(val)}
                                />
                            </div>
                            <div>
                                <label className="input-label">Saldo Inicial Mercado Pago (ARS)</label>
                                <CurrencyInput
                                    className="input"
                                    placeholder="0.00"
                                    value={mpStart}
                                    onChange={(val) => setMpStart(val)}
                                />
                            </div>
                            <div>
                                <label className="input-label">Notas (opcional)</label>
                                <input
                                    className="input"
                                    type="text"
                                    placeholder="Observaciones del turno"
                                    value={openNotes}
                                    onChange={(e) => setOpenNotes(e.target.value)}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <button className="btn btn-secondary" onClick={() => setShowOpenForm(false)} style={{ flex: 1 }}>
                                    Cancelar
                                </button>
                                <button className="btn btn-success" onClick={handleOpenShift} style={{ flex: 1 }}>
                                    Abrir Turno
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Transaction modal ─────────────────────────────────────────────────── */}
            {showTxModal && (
                <div className="modal-backdrop" onClick={() => setShowTxModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>
                            ➕ Nueva Transacción
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                            {/* Type tabs */}
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                {(['ingreso', 'egreso'] as const).map((t) => (
                                    <button
                                        key={t}
                                        className={`btn ${txForm.type === t ? (t === 'ingreso' ? 'btn-success' : 'btn-danger') : 'btn-secondary'}`}
                                        style={{ flex: 1, justifyContent: 'center' }}
                                        onClick={() => {
                                            setTxForm((f) => ({
                                                ...f,
                                                type: t,
                                                category: t === 'ingreso' ? 'venta' : 'proveedor',
                                            }));
                                            setTxError('');
                                        }}
                                    >
                                        {t === 'ingreso' ? '↑ Ingreso' : '↓ Egreso'}
                                    </button>
                                ))}
                            </div>

                            <div>
                                <label className="input-label">Categoría</label>
                                <select
                                    className="input"
                                    value={txForm.category}
                                    onChange={(e) => setTxForm((f) => ({ ...f, category: e.target.value as TransactionCategory }))}
                                >
                                    {(txForm.type === 'ingreso' ? INGRESO_CATEGORIES : EGRESO_CATEGORIES).map((c) => (
                                        <option key={c.value} value={c.value}>{c.label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="input-label">Contenedor</label>
                                <select
                                    className="input"
                                    value={txForm.container}
                                    onChange={(e) => setTxForm((f) => ({ ...f, container: e.target.value as ContainerKey }))}
                                >
                                    <option value="efectivo">💵 Efectivo</option>
                                    <option value="mercado_pago">📱 Mercado Pago</option>
                                    {isAdmin && <option value="caja_chica">🪙 Caja Chica</option>}
                                    {isAdmin && <option value="caja_fuerte">🔒 Caja Fuerte</option>}
                                </select>
                            </div>

                            <div>
                                <label className="input-label">Monto (ARS)</label>
                                <CurrencyInput
                                    className="input"
                                    placeholder="0.00"
                                    value={txForm.amount}
                                    onChange={(val) => setTxForm((f) => ({ ...f, amount: val }))}
                                />
                            </div>

                            <div>
                                <label className="input-label">Descripción</label>
                                <input
                                    className="input"
                                    type="text"
                                    placeholder="Ej: Pago a Distribuidora XYZ"
                                    value={txForm.description}
                                    onChange={(e) => setTxForm((f) => ({ ...f, description: e.target.value }))}
                                />
                            </div>

                            {txError && (
                                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: '8px', padding: '0.6rem 0.875rem', fontSize: '0.8rem', color: '#fca5a5' }}>
                                    {txError}
                                </div>
                            )}

                            {/* Balance hint */}
                            {appState && (
                                <div style={{ fontSize: '0.72rem', color: 'var(--text2)', padding: '0.5rem', background: 'var(--bg3)', borderRadius: '6px' }}>
                                    Saldo disponible en {containerLabel(txForm.container)}: <strong style={{ color: 'var(--text)' }}>{formatARS(appState.containers[txForm.container] ?? 0)}</strong>
                                    {txForm.type === 'egreso' && appState.containers.caja_chica > 0 && txForm.container === 'efectivo' && (
                                        <span style={{ display: 'block', marginTop: '0.25rem' }}>
                                            💡 Si el efectivo no alcanza, se usará Caja Chica automáticamente.
                                        </span>
                                    )}
                                </div>
                            )}

                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <button className="btn btn-secondary" onClick={() => { setShowTxModal(false); setTxError(''); }} style={{ flex: 1 }} disabled={loadingTx}>
                                    Cancelar
                                </button>
                                <button className="btn btn-primary" onClick={handleAddTx} style={{ flex: 1 }} disabled={loadingTx}>
                                    {loadingTx ? 'Guardando...' : 'Registrar'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── POS modal ─────────────────────────────────────────────────────────── */}
            {showPosModal && (
                <POSModal
                    onClose={() => setShowPosModal(false)}
                    onConfirmSale={handleConfirmSale}
                />
            )}
        </div>
    );
}

export default function TurnoPage() {
    return (
        <Suspense fallback={<div style={{ color: 'var(--text2)', padding: '2rem' }}>Cargando módulo de turno...</div>}>
            <TurnoContent />
        </Suspense>
    );
}
