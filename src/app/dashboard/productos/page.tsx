'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Product, Category } from '@/lib/types';
import { formatARS } from '@/lib/store';
import { getProducts, createProduct, updateProduct, deleteProduct, getCategories, addProductBatch, reportProductLoss, getPriceHistory } from '@/app/actions';

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
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [priceHistory, setPriceHistory] = useState<{ id: string, costPrice: number, salePrice: number, changedBy: string | null, createdAt: string }[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
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
        minStock: '0',
        categoryId: ''
    });
    const [saving, setSaving] = useState(false);
    const [searchingBarcode, setSearchingBarcode] = useState(false);
    const [productImage, setProductImage] = useState<string | null>(null);

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
        setForm({ name: '', barcode: '', costPrice: '', salePrice: '', margin: '', stock: '0', minStock: '0', categoryId: categoriesList[0]?.id || '' });
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
            minStock: p.minStock.toString(),
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

    async function openHistory(p: Product) {
        setSelectedProduct(p);
        setPriceHistory([]);
        setShowHistoryModal(true);
        setLoadingHistory(true);
        try {
            const h = await getPriceHistory(p.id);
            setPriceHistory(h);
        } catch {
            toast('Error cargando historial', 'error');
        } finally {
            setLoadingHistory(false);
        }
    }

    async function handleBarcodeChange(val: string) {
        setForm(f => ({ ...f, barcode: val }));
        if (!val) { setProductImage(null); return; }

        const isEanLength = val.length === 8 || val.length === 13 || val.length === 14;
        if (!editingId && form.name === '' && isEanLength) {
            setSearchingBarcode(true);
            setProductImage(null);
            try {
                const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${val}.json`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.status === 1 && data.product) {
                        const p = data.product;

                        // 1. Nombre: product_name, o fallback a brands
                        const name = p.product_name || p.brands || '';

                        // 2. Imagen
                        const image = p.image_front_url || p.image_url || null;
                        setProductImage(image);

                        // 3. Categoría: intentar matchear con las categorías del sistema
                        let matchedCategoryId = '';
                        if (p.categories && categoriesList.length > 0) {
                            const apiCats = p.categories.toLowerCase();
                            const match = categoriesList.find(c =>
                                apiCats.includes(c.name.toLowerCase())
                            );
                            if (match) matchedCategoryId = match.id;
                        }

                        if (name) {
                            setForm(f => ({
                                ...f,
                                barcode: val,
                                name,
                                ...(matchedCategoryId ? { categoryId: matchedCategoryId } : {})
                            }));
                            const extras = [image ? '📷 imagen' : '', matchedCategoryId ? '🏷️ categoría' : ''].filter(Boolean).join(', ');
                            toast(`Producto localizado automáticamente${extras ? ` (+ ${extras})` : ''}`, 'success');
                        } else {
                            toast('Código encontrado pero sin nombre en la base global', 'info');
                        }
                    } else {
                        toast('Código no encontrado en la base global', 'info');
                    }
                }
            } catch (e) {
                console.error('Error buscando en Open Food Facts:', e);
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
        const ms = parseInt(form.minStock, 10);

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
                minStock: isNaN(ms) ? 0 : ms,
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
                                            <span className={`badge ${p.stock <= 0 ? 'badge-danger'
                                                : p.minStock > 0 && p.stock <= p.minStock ? 'badge-warning'
                                                    : 'badge-success'
                                                }`}>
                                                {p.stock}
                                            </span>
                                            {p.minStock > 0 && p.stock <= p.minStock && (
                                                <span title={`Mínimo: ${p.minStock}`} style={{ marginLeft: '4px', fontSize: '0.7rem' }}>⚠️</span>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            <button className="btn btn-primary btn-sm" style={{ marginRight: '0.5rem' }} onClick={() => openStock(p)}>📦 Lote</button>
                                            <button className="btn btn-sm" style={{ marginRight: '0.5rem', background: '#f59e0b', color: 'white', border: 'none' }} onClick={() => openLoss(p)}>📉 Merma</button>
                                            <button className="btn btn-secondary btn-sm" style={{ marginRight: '0.5rem' }} onClick={() => openEdit(p)}>✏️ Editar</button>
                                            <button className="btn btn-sm" style={{ marginRight: '0.5rem', background: '#6366f1', color: 'white', border: 'none' }} onClick={() => openHistory(p)}>📉 Precios</button>
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

                            {/* Product image preview from Open Food Facts */}
                            {productImage && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', background: 'var(--bg3)', borderRadius: '8px' }}>
                                    <img
                                        src={productImage}
                                        alt="Imagen del producto"
                                        style={{ width: '64px', height: '64px', objectFit: 'contain', borderRadius: '6px', background: 'white', padding: '4px' }}
                                        onError={() => setProductImage(null)}
                                    />
                                    <div>
                                        <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text2)' }}>Imagen encontrada en Open Food Facts</div>
                                        <div style={{ fontSize: '0.7rem', color: 'var(--text2)', marginTop: '2px' }}>La imagen es orientativa, no se guarda en el sistema.</div>
                                    </div>
                                </div>
                            )}

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
                                    <label className="input-label">Stock Mínimo ⚠️</label>
                                    <input className="input" type="number" min="0" value={form.minStock} onChange={e => setForm({ ...form, minStock: e.target.value })} placeholder="0" />
                                    <small style={{ color: 'var(--text2)', fontSize: '0.72rem', display: 'block', marginTop: '3px' }}>Alerta cuando baje de este número</small>
                                </div>
                                <div style={{ flex: 1 }}>
                                    <label className="input-label">Categoría</label>
                                    <select
                                        className="input"
                                        value={form.categoryId}
                                        onChange={e => setForm({ ...form, categoryId: e.target.value })}
                                        style={{ height: '38px' }}
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
            {/* Price History Modal */}
            {showHistoryModal && selectedProduct && (
                <div className="modal-backdrop" onClick={() => setShowHistoryModal(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.25rem' }}>
                            📉 Historial de Precios
                        </h2>
                        <p style={{ color: 'var(--text2)', fontSize: '0.82rem', marginBottom: '1rem' }}>
                            {selectedProduct.name}
                        </p>
                        {loadingHistory ? (
                            <div style={{ color: 'var(--text2)', textAlign: 'center', padding: '1rem' }}>Cargando...</div>
                        ) : priceHistory.length === 0 ? (
                            <div style={{ color: 'var(--text2)', textAlign: 'center', padding: '1.5rem', fontSize: '0.85rem' }}>
                                Sin cambios de precio registrados.
                                <br />
                                <small>Los cambios se guardan automáticamente al editar un producto.</small>
                            </div>
                        ) : (
                            <div className="table-wrap" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Fecha</th>
                                            <th style={{ textAlign: 'right' }}>Costo</th>
                                            <th style={{ textAlign: 'right' }}>Venta</th>
                                            <th>Por</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {priceHistory.map(h => (
                                            <tr key={h.id}>
                                                <td style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>
                                                    {new Date(h.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                                </td>
                                                <td style={{ textAlign: 'right', color: '#8b5cf6' }}>{formatARS(h.costPrice)}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 700, color: '#22c55e' }}>{formatARS(h.salePrice)}</td>
                                                <td style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>{h.changedBy || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                        <div style={{ marginTop: '1rem' }}>
                            <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setShowHistoryModal(false)}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
