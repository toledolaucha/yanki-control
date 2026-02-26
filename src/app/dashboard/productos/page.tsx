'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Product, Category } from '@/lib/types';
import { formatARS } from '@/lib/store';
import { getProducts, createProduct, updateProduct, deleteProduct, getCategories, addProductBatch, reportProductLoss } from '@/app/actions';

export default function ProductosPage() {
    const { user, isAdmin } = useAuth();
    const router = useRouter();
    const toast = useToast();

    const [products, setProducts] = useState<Product[]>([]);
    const [categoriesList, setCategoriesList] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [showStockModal, setShowStockModal] = useState(false);
    const [showLossModal, setShowLossModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [stockForm, setStockForm] = useState({ quantity: '', costPrice: '', provider: '' });
    const [lossForm, setLossForm] = useState({ quantity: '', reason: '' });

    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({
        name: '',
        barcode: '',
        costPrice: '',
        salePrice: '',
        margin: '',
        stock: '',
        categoryId: ''
    });
    const [saving, setSaving] = useState(false);
    const [searchingBarcode, setSearchingBarcode] = useState(false);

    const reload = useCallback(async () => {
        try {
            setLoading(true);
            const [prods, cats] = await Promise.all([
                getProducts(),
                getCategories()
            ]);
            setProducts(prods);
            setCategoriesList(cats);
        } catch (e) {
            toast('Error conectando a la base de datos', 'error');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => {
        if (!user) { router.replace('/login'); return; }
        reload();
    }, [user, reload, router]);

    function openCreate() {
        setEditingId(null);
        setForm({ name: '', barcode: '', costPrice: '', salePrice: '', margin: '', stock: '0', categoryId: categoriesList[0]?.id || '' });
        setShowModal(true);
    }

    function openEdit(p: Product) {
        setEditingId(p.id);
        let mStr = '';
        if (p.costPrice > 0 && p.salePrice > 0) {
            const m = ((p.salePrice - p.costPrice) / p.costPrice) * 100;
            mStr = m.toFixed(2).replace(/\.00$/, '');
        }
        setForm({
            name: p.name,
            barcode: p.barcode || '',
            costPrice: p.costPrice.toString(),
            salePrice: p.salePrice.toString(),
            margin: mStr,
            stock: p.stock.toString(),
            categoryId: p.categoryId || (categoriesList[0]?.id || '')
        });
        setShowModal(true);
    }

    function openStock(p: Product) {
        setSelectedProduct(p);
        setStockForm({ quantity: '', costPrice: p.costPrice.toString(), provider: '' });
        setShowStockModal(true);
    }

    function openLoss(p: Product) {
        setSelectedProduct(p);
        setLossForm({ quantity: '', reason: '' });
        setShowLossModal(true);
    }

    async function handleBarcodeChange(val: string) {
        setForm(f => ({ ...f, barcode: val }));

        const isEanLength = val.length === 8 || val.length === 13 || val.length === 14;
        if (!editingId && form.name === '' && isEanLength) {
            setSearchingBarcode(true);
            try {
                const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${val}.json`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === 1 && data.product && data.product.product_name) {
                        setForm(f => ({ ...f, barcode: val, name: data.product.product_name }));
                        toast('Producto localizado automáticamente', 'success');
                    }
                }
            } catch (e) {
                console.error("Error buscando en Open Food Facts:", e);
            } finally {
                setSearchingBarcode(false);
            }
        }
    }

    function handleCostChange(val: string) {
        let marginStr = form.margin;
        const cp = parseFloat(val);
        const sp = parseFloat(form.salePrice);
        if (!isNaN(cp) && cp > 0 && !isNaN(sp)) {
            const m = ((sp - cp) / cp) * 100;
            marginStr = m.toFixed(2).replace(/\.00$/, '');
        } else if (!val || isNaN(cp) || cp === 0) {
            marginStr = '';
        }
        setForm(f => ({ ...f, costPrice: val, margin: marginStr }));
    }

    function handleSaleChange(val: string) {
        let marginStr = form.margin;
        const cp = parseFloat(form.costPrice);
        const sp = parseFloat(val);
        if (!isNaN(cp) && cp > 0 && !isNaN(sp)) {
            const m = ((sp - cp) / cp) * 100;
            marginStr = m.toFixed(2).replace(/\.00$/, '');
        }
        setForm(f => ({ ...f, salePrice: val, margin: marginStr }));
    }

    function handleMarginChange(val: string) {
        let saleStr = form.salePrice;
        const cp = parseFloat(form.costPrice);
        const m = parseFloat(val);
        if (!isNaN(cp) && cp > 0 && !isNaN(m)) {
            const sp = cp * (1 + m / 100);
            saleStr = Math.round(sp).toString();
        }
        setForm(f => ({ ...f, margin: val, salePrice: saleStr }));
    }

    async function handleSave() {
        if (!form.name.trim()) { toast('El nombre es requerido', 'error'); return; }
        const cp = parseFloat(form.costPrice);
        const sp = parseFloat(form.salePrice);
        const st = parseInt(form.stock, 10);

        if (isNaN(cp) || cp < 0) { toast('Precio de costo inválido', 'error'); return; }
        if (isNaN(sp) || sp < 0) { toast('Precio de venta inválido', 'error'); return; }
        if (isNaN(st)) { toast('Stock inválido', 'error'); return; }

        try {
            setSaving(true);
            const data = {
                name: form.name.trim(),
                barcode: form.barcode.trim() || undefined,
                costPrice: cp,
                salePrice: sp,
                stock: st,
                categoryId: form.categoryId || undefined
            };

            if (editingId) {
                await updateProduct(editingId, data);
                toast('Producto actualizado correctamente', 'success');
            } else {
                await createProduct(data);
                toast('Producto creado correctamente', 'success');
            }
            setShowModal(false);
            await reload();
        } catch (e: any) {
            toast(e.message || 'Error al guardar', 'error');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('¿Seguro de eliminar/desactivar este producto?')) return;
        try {
            await deleteProduct(id);
            toast('Producto eliminado', 'success');
            await reload();
        } catch (e: any) {
            toast(e.message || 'Error al eliminar', 'error');
        }
    }

    async function handleSaveStock() {
        if (!selectedProduct) return;
        const q = parseInt(stockForm.quantity, 10);
        const c = parseFloat(stockForm.costPrice);

        if (isNaN(q) || q <= 0) { toast('Cantidad inválida', 'error'); return; }
        if (isNaN(c) || c < 0) { toast('Precio de costo inválido', 'error'); return; }

        try {
            setSaving(true);
            await addProductBatch(selectedProduct.id, q, c, stockForm.provider);
            toast('Stock ingresado correctamente', 'success');
            setShowStockModal(false);
            await reload();
        } catch (e: any) {
            toast(e.message || 'Error al ingresar stock', 'error');
        } finally {
            setSaving(false);
        }
    }

    async function handleSaveLoss() {
        if (!selectedProduct) return;
        const q = parseInt(lossForm.quantity, 10);

        if (isNaN(q) || q <= 0) { toast('Cantidad inválida', 'error'); return; }
        if (!lossForm.reason.trim()) { toast('Debe especificar un motivo', 'error'); return; }

        try {
            setSaving(true);
            await reportProductLoss(selectedProduct.id, q, lossForm.reason.trim());
            toast('Merma registrada y stock actualizado', 'success');
            setShowLossModal(false);
            await reload();
        } catch (e: any) {
            toast(e.message || 'Error al reportar merma', 'error');
        } finally {
            setSaving(false);
        }
    }

    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode && p.barcode.includes(search))
    );

    if (loading) return <div style={{ color: 'var(--text2)' }}>Cargando inventario...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>📦 Inventario de Productos</h1>
                    <p style={{ color: 'var(--text2)', fontSize: '0.875rem' }}>Gestión de stock, códigos de barra y precios</p>
                </div>
                <button className="btn btn-success" onClick={openCreate}>
                    ➕ Añadir Producto
                </button>
            </div>

            <div className="card">
                <input
                    type="text"
                    className="input"
                    placeholder="🔍 Buscar por nombre o código de barras..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ marginBottom: '1rem', maxWidth: '400px' }}
                />

                {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text2)' }}>
                        No se encontraron productos.
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Cód. Barras</th>
                                    <th>Categoría</th>
                                    <th style={{ textAlign: 'right' }}>Costo</th>
                                    <th style={{ textAlign: 'right' }}>Margen</th>
                                    <th style={{ textAlign: 'right' }}>Venta</th>
                                    <th style={{ textAlign: 'center' }}>Stock</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(p => (
                                    <tr key={p.id}>
                                        <td style={{ fontWeight: 600 }}>{p.name}</td>
                                        <td style={{ color: 'var(--text2)', fontSize: '0.8rem' }}>{p.barcode || '—'}</td>
                                        <td><span className="badge badge-secondary">{p.category?.name || 'S/Categoría'}</span></td>
                                        <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{formatARS(p.costPrice)}</td>
                                        <td style={{ textAlign: 'right', color: 'var(--text2)', fontSize: '0.85rem' }}>
                                            {p.costPrice > 0 ? (((p.salePrice - p.costPrice) / p.costPrice) * 100).toFixed(0) + '%' : '—'}
                                        </td>
                                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>{formatARS(p.salePrice)}</td>
                                        <td style={{ textAlign: 'center' }}>
                                            <span className={`badge ${p.stock <= 5 ? (p.stock <= 0 ? 'badge-danger' : 'badge-warning') : 'badge-success'}`}>
                                                {p.stock}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            <button className="btn btn-primary btn-sm" style={{ marginRight: '0.5rem' }} onClick={() => openStock(p)}>📦 Lote</button>
                                            <button className="btn btn-sm" style={{ marginRight: '0.5rem', background: '#f59e0b', color: 'white', border: 'none' }} onClick={() => openLoss(p)}>📉 Merma</button>
                                            <button className="btn btn-secondary btn-sm" style={{ marginRight: '0.5rem' }} onClick={() => openEdit(p)}>✏️ Editar</button>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(p.id)}>🗑️</button>
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
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>
                            {editingId ? 'Editar Producto' : 'Nuevo Producto'}
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div>
                                <label className="input-label" style={{ fontWeight: 800, color: 'var(--accent1)' }}>Código de Barras</label>
                                <div style={{ position: 'relative' }}>
                                    <input className="input" autoFocus type="text" value={form.barcode} onChange={e => handleBarcodeChange(e.target.value)} placeholder="Ej: 779123456 (escaneá aquí)" />
                                    {searchingBarcode && <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.8rem', color: 'var(--text2)' }}>Buscando...</div>}
                                </div>
                            </div>
                            <div>
                                <label className="input-label">Nombre del Producto</label>
                                <input className="input" type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Coca Cola 2L" />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                    <label className="input-label">Precio Costo (ARS)</label>
                                    <input className="input" type="number" min="0" step="1" value={form.costPrice} onChange={e => handleCostChange(e.target.value)} placeholder="0" />
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                    <label className="input-label">Margen (%)</label>
                                    <input className="input" type="number" min="0" step="1" value={form.margin} onChange={e => handleMarginChange(e.target.value)} placeholder="0" />
                                </div>
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                                    <label className="input-label">Precio Venta (ARS)</label>
                                    <input className="input" type="number" min="0" step="1" value={form.salePrice} onChange={e => handleSaleChange(e.target.value)} placeholder="0" />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div style={{ flex: 1 }}>
                                    <label className="input-label">Stock Actual</label>
                                    <input className="input" type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} placeholder="0" />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="input-label">Categoría</label>
                                    <select
                                        className="input"
                                        value={form.categoryId}
                                        onChange={e => setForm({ ...form, categoryId: e.target.value })}
                                        style={{ height: '38px' }} // Match normal input height
                                    >
                                        <option value="" disabled>Seleccione...</option>
                                        {categoriesList.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancelar</button>
                                <button className="btn btn-success" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Stock Batch Modal */}
            {showStockModal && selectedProduct && (
                <div className="modal-backdrop" onClick={() => setShowStockModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                            Ingresar Lote de Stock
                        </h2>
                        <p style={{ color: 'var(--text2)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                            Producto: <strong>{selectedProduct.name}</strong>
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label className="input-label">Cantidad a Ingresar</label>
                                <input className="input" autoFocus type="number" min="1" step="1" value={stockForm.quantity} onChange={e => setStockForm({ ...stockForm, quantity: e.target.value })} placeholder="Ej: 24" />
                            </div>

                            <div>
                                <label className="input-label">Precio de Costo C/U (ARS)</label>
                                <input className="input" type="number" min="0" step="any" value={stockForm.costPrice} onChange={e => setStockForm({ ...stockForm, costPrice: e.target.value })} placeholder="Ej: 1250.50" />
                                <small style={{ color: 'var(--text2)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                                    Este es el precio que pagaste por unidad en *esta* compra.
                                </small>
                            </div>

                            <div>
                                <label className="input-label">Proveedor (Opcional)</label>
                                <input className="input" type="text" value={stockForm.provider} onChange={e => setStockForm({ ...stockForm, provider: e.target.value })} placeholder="Ej: Distribuidora Norte" />
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowStockModal(false)}>Cancelar</button>
                                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSaveStock} disabled={saving}>{saving ? 'Guardando...' : 'Ingresar Stock'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Product Loss (Merma) Modal */}
            {showLossModal && selectedProduct && (
                <div className="modal-backdrop" onClick={() => setShowLossModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '0.5rem', color: '#f59e0b' }}>
                            Reportar Merma / Pérdida
                        </h2>
                        <p style={{ color: 'var(--text2)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
                            Descontá stock de <strong>{selectedProduct.name}</strong> por vencimientos o roturas. El sistema calculará el costo exacto perdido.
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div>
                                <label className="input-label">Unidades Perdidas</label>
                                <input className="input" autoFocus type="number" min="1" step="1" value={lossForm.quantity} onChange={e => setLossForm({ ...lossForm, quantity: e.target.value })} placeholder="Ej: 3" />
                            </div>

                            <div>
                                <label className="input-label">Motivo de la baja</label>
                                <select className="input" style={{ height: '38px' }} value={lossForm.reason} onChange={e => setLossForm({ ...lossForm, reason: e.target.value })}>
                                    <option value="" disabled>Seleccionar motivo...</option>
                                    <option value="Vencido">Fecha Vencida</option>
                                    <option value="Roto / Dañado">Roto / Dañado</option>
                                    <option value="Pérdida desconocida">Pérdida desconocida</option>
                                    <option value="Consumo interno">Consumo interno</option>
                                    <option value="Otro">Otro motivo</option>
                                </select>
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowLossModal(false)}>Cancelar</button>
                                <button className="btn" style={{ flex: 1, background: '#f59e0b', color: 'white', border: 'none' }} onClick={handleSaveLoss} disabled={saving}>{saving ? 'Procesando...' : 'Confirmar Baja'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
