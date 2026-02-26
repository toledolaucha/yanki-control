'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Product, ContainerKey } from '@/lib/types';
import { searchProduct } from '@/app/actions';
import { formatARS } from '@/lib/store';
import { CurrencyInput } from '@/components/CurrencyInput';

interface POSItem extends Product {
    cartQuantity: number;
}

interface POSModalProps {
    onClose: () => void;
    onConfirmSale: (items: { productId: string, quantity: number, price: number }[], paymentMethod: ContainerKey) => Promise<void>;
}

export function POSModal({ onClose, onConfirmSale }: POSModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Product[]>([]);
    const [cart, setCart] = useState<POSItem[]>([]);
    const [paymentMethod, setPaymentMethod] = useState<ContainerKey>('efectivo');
    const [clientPayment, setClientPayment] = useState<number | undefined>();
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');

    const searchInputRef = useRef<HTMLInputElement>(null);

    // Auto-focus search input on mount
    useEffect(() => {
        if (searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, []);

    // Handle search debouncing and automatic barcode addition
    useEffect(() => {
        const handler = setTimeout(async () => {
            if (!searchQuery.trim()) {
                setSearchResults([]);
                return;
            }

            setLoading(true);
            try {
                const results = await searchProduct(searchQuery);

                // If it looks like a barcode scan (exact match on 1 item usually)
                // We auto-add it if it's a perfect barcode match
                if (results.length === 1 && results[0].barcode === searchQuery.trim() && results[0].stock > 0) {
                    addToCart(results[0]);
                    setSearchQuery(''); // Clear for next scan
                    setSearchResults([]);
                } else {
                    setSearchResults(results);
                }
            } catch (e) {
                console.error('Search error', e);
            } finally {
                setLoading(false);
            }
        }, 300); // 300ms debounce

        return () => clearTimeout(handler);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery]);

    function addToCart(product: Product) {
        if (product.stock <= 0) {
            setError(`Sin stock: ${product.name}`);
            return;
        }

        setCart(prev => {
            const existing = prev.find(item => item.id === product.id);
            if (existing) {
                if (existing.cartQuantity >= product.stock) {
                    setError(`Stock máximo alcanzado para ${product.name}`);
                    return prev;
                }
                return prev.map(item =>
                    item.id === product.id
                        ? { ...item, cartQuantity: item.cartQuantity + 1 }
                        : item
                );
            }
            return [...prev, { ...product, cartQuantity: 1 }];
        });
        setError('');
        setSearchQuery('');
        if (searchInputRef.current) searchInputRef.current.focus();
    }

    function updateQuantity(productId: string, delta: number) {
        setCart(prev => prev.map(item => {
            if (item.id === productId) {
                const newQty = item.cartQuantity + delta;
                if (newQty > item.stock) {
                    setError(`Stock máximo disponible: ${item.stock}`);
                    return item;
                }
                if (newQty <= 0) return item; // Handled by remove button instead
                return { ...item, cartQuantity: newQty };
            }
            return item;
        }));
    }

    function removeFromCart(productId: string) {
        setCart(prev => prev.filter(item => item.id !== productId));
    }

    const totalSale = cart.reduce((sum, item) => sum + (item.salePrice * item.cartQuantity), 0);
    const totalCost = cart.reduce((sum, item) => sum + (item.costPrice * item.cartQuantity), 0); // Opcional para mostrar rentabilidad si se quisiera

    const paymentAmount = clientPayment || 0;
    const changeDue = paymentAmount > 0 ? paymentAmount - totalSale : 0;

    async function handleConfirm() {
        if (cart.length === 0) return;
        if (paymentMethod === 'efectivo' && paymentAmount > 0 && paymentAmount < totalSale) {
            setError('El monto ingresado es menor al total de la venta');
            return;
        }

        try {
            setProcessing(true);
            setError('');
            const saleItems = cart.map(item => ({
                productId: item.id,
                quantity: item.cartQuantity,
                price: item.salePrice
            }));

            await onConfirmSale(saleItems, paymentMethod);
            onClose();
        } catch (e: any) {
            setError(e.message || 'Error al procesar la venta');
        } finally {
            setProcessing(false);
        }
    }

    return (
        <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 100 }}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '95%', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>

                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                    <div>
                        <h2 style={{ fontSize: '1.3rem', fontWeight: 800, margin: 0 }}>🛒 Punto de Venta (POS)</h2>
                        <p style={{ color: 'var(--text2)', fontSize: '0.8rem', marginTop: '0.2rem' }}>Escaneá el código de barras o buscá por nombre</p>
                    </div>
                    <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text2)' }}>✕</button>
                </div>

                <div style={{ display: 'flex', gap: '1.5rem', flex: 1, minHeight: 0, overflow: 'hidden' }}>

                    {/* Left Column: Search & Results */}
                    <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>
                        <div style={{ position: 'relative' }}>
                            <input
                                ref={searchInputRef}
                                type="text"
                                className="input"
                                placeholder="🔍 Escanear o buscar producto..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{ fontSize: '1.1rem', padding: '0.75rem 1rem' }}
                            />
                            {loading && <div style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'var(--text2)' }}>Cargando...</div>}
                        </div>

                        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg2)' }}>
                            {searchResults.length > 0 ? (
                                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                                    {searchResults.map(p => (
                                        <li
                                            key={p.id}
                                            onClick={() => p.stock > 0 ? addToCart(p) : null}
                                            style={{
                                                padding: '0.75rem 1rem',
                                                borderBottom: '1px solid var(--border)',
                                                cursor: p.stock > 0 ? 'pointer' : 'not-allowed',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                opacity: p.stock > 0 ? 1 : 0.5,
                                                background: 'var(--bg)'
                                            }}
                                            onMouseEnter={e => { if (p.stock > 0) e.currentTarget.style.background = 'var(--bg3)' }}
                                            onMouseLeave={e => { e.currentTarget.style.background = 'var(--bg)' }}
                                        >
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{p.name}</div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text2)' }}>Stock: {p.stock} | Cód: {p.barcode || 'N/A'}</div>
                                            </div>
                                            <div style={{ fontWeight: 800, color: '#22c55e' }}>
                                                {formatARS(p.salePrice)}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text2)', fontSize: '0.9rem' }}>
                                    {searchQuery ? 'No se encontraron productos' : 'Los resultados de búsqueda aparecerán aquí'}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Right Column: Ticket / Cart */}
                    <div style={{ flex: '1 1 50%', display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: 0 }}>

                        {/* Cart Items */}
                        <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg2)', padding: '0.5rem' }}>
                            {cart.length === 0 ? (
                                <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)', flexDirection: 'column' }}>
                                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🛒</div>
                                    <div style={{ fontSize: '0.9rem' }}>El carrito está vacío</div>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {cart.map(item => (
                                        <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'var(--bg)', borderRadius: '6px', border: '1px solid var(--border)' }}>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.name}</div>
                                                <div style={{ color: 'var(--text2)', fontSize: '0.75rem' }}>{formatARS(item.salePrice)} c/u</div>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg3)', borderRadius: '4px', overflow: 'hidden' }}>
                                                    <button onClick={() => updateQuantity(item.id, -1)} style={{ border: 'none', background: 'transparent', padding: '0.2rem 0.6rem', cursor: 'pointer', fontWeight: 'bold' }}>-</button>
                                                    <div style={{ padding: '0 0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>{item.cartQuantity}</div>
                                                    <button onClick={() => updateQuantity(item.id, +1)} style={{ border: 'none', background: 'transparent', padding: '0.2rem 0.6rem', cursor: 'pointer', fontWeight: 'bold' }}>+</button>
                                                </div>
                                                <div style={{ fontWeight: 700, width: '70px', textAlign: 'right' }}>
                                                    {formatARS(item.salePrice * item.cartQuantity)}
                                                </div>
                                                <button onClick={() => removeFromCart(item.id)} style={{ border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', padding: '0.2rem' }}>
                                                    🗑️
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Totals & Payment */}
                        <div style={{ background: 'var(--bg2)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border)' }}>

                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '1rem', paddingBottom: '0.75rem', borderBottom: '1px dashed var(--border)' }}>
                                <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text2)' }}>Total a Pagar</span>
                                <span style={{ fontSize: '2rem', fontWeight: 900, color: '#22c55e', lineHeight: 1 }}>{formatARS(totalSale)}</span>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                                <div>
                                    <label className="input-label" style={{ fontSize: '0.75rem' }}>Método de Pago</label>
                                    <select
                                        className="input"
                                        value={paymentMethod}
                                        onChange={(e) => {
                                            setPaymentMethod(e.target.value as ContainerKey);
                                            setClientPayment(undefined); // Reset payment amount when changing method
                                        }}
                                        style={{ fontSize: '0.9rem', padding: '0.5rem' }}
                                    >
                                        <option value="efectivo">💵 Efectivo</option>
                                        <option value="mercado_pago">📱 Mercado Pago</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="input-label" style={{ fontSize: '0.75rem' }}>Paga con (ARS)</label>
                                    <CurrencyInput
                                        className="input"
                                        placeholder="0.00"
                                        value={clientPayment}
                                        onChange={(val) => setClientPayment(val)}
                                    />
                                </div>
                            </div>

                            {/* Vuelto Section */}
                            {paymentMethod === 'efectivo' && paymentAmount > 0 && (
                                <div style={{
                                    background: changeDue >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                    border: `1px solid ${changeDue >= 0 ? '#22c55e' : '#ef4444'}`,
                                    padding: '0.75rem',
                                    borderRadius: '6px',
                                    marginBottom: '1rem',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                }}>
                                    <span style={{ fontWeight: 600, color: changeDue >= 0 ? '#16a34a' : '#dc2626' }}>
                                        {changeDue >= 0 ? '🔄 Vuelto para cliente:' : '⚠️ Faltan:'}
                                    </span>
                                    <span style={{ fontSize: '1.25rem', fontWeight: 800, color: changeDue >= 0 ? '#16a34a' : '#dc2626' }}>
                                        {formatARS(Math.abs(changeDue))}
                                    </span>
                                </div>
                            )}

                            {error && (
                                <div style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', padding: '0.5rem', borderRadius: '4px', fontSize: '0.8rem', marginBottom: '1rem', textAlign: 'center', border: '1px solid #ef4444' }}>
                                    {error}
                                </div>
                            )}

                            <button
                                className="btn btn-primary"
                                style={{ width: '100%', padding: '1rem', fontSize: '1.1rem', justifyContent: 'center' }}
                                onClick={handleConfirm}
                                disabled={processing || cart.length === 0 || (paymentMethod === 'efectivo' && paymentAmount > 0 && paymentAmount < totalSale)}
                            >
                                {processing ? 'Procesando Venta...' : '✅ Confirmar Venta'}
                            </button>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
