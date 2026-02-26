'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Category } from '@/lib/types';
import { getCategories, createCategory, updateCategory, deleteCategory } from '@/app/actions';

export default function CategoriasPage() {
    const { user, isAdmin } = useAuth();
    const router = useRouter();
    const toast = useToast();

    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    const [showModal, setShowModal] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [form, setForm] = useState({
        name: '',
        description: ''
    });
    const [saving, setSaving] = useState(false);

    const reload = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getCategories();
            setCategories(data);
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
        setForm({ name: '', description: '' });
        setShowModal(true);
    }

    function openEdit(c: Category) {
        setEditingId(c.id);
        setForm({
            name: c.name,
            description: c.description || ''
        });
        setShowModal(true);
    }

    async function handleSave() {
        if (!form.name.trim()) { toast('El nombre es requerido', 'error'); return; }

        try {
            setSaving(true);
            const data = {
                name: form.name.trim(),
                description: form.description.trim() || undefined
            };

            if (editingId) {
                await updateCategory(editingId, data);
                toast('Categoría actualizada', 'success');
            } else {
                await createCategory(data);
                toast('Categoría creada', 'success');
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
        if (!confirm('¿Seguro de eliminar/desactivar esta categoría? Todos los productos asociados mantendrán su relación pero la categoría no se sugerirá.')) return;
        try {
            await deleteCategory(id);
            toast('Categoría eliminada', 'success');
            await reload();
        } catch (e: any) {
            toast(e.message || 'Error al eliminar', 'error');
        }
    }

    const filtered = categories.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) return <div style={{ color: 'var(--text2)' }}>Cargando categorías...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>🏷️ Categorías de Productos</h1>
                    <p style={{ color: 'var(--text2)', fontSize: '0.875rem' }}>Gestioná las agrupaciones de tus productos</p>
                </div>
                <button className="btn btn-success" onClick={openCreate}>
                    ➕ Añadir Categoría
                </button>
            </div>

            <div className="card">
                <input
                    type="text"
                    className="input"
                    placeholder="🔍 Buscar categoría..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    style={{ marginBottom: '1rem', maxWidth: '400px' }}
                />

                {filtered.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text2)' }}>
                        No se encontraron categorías.
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table>
                            <thead>
                                <tr>
                                    <th>Nombre</th>
                                    <th>Descripción</th>
                                    <th style={{ textAlign: 'right' }}>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(c => (
                                    <tr key={c.id}>
                                        <td style={{ fontWeight: 600 }}>{c.name}</td>
                                        <td style={{ color: 'var(--text2)' }}>{c.description || '—'}</td>
                                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                            <button className="btn btn-secondary btn-sm" style={{ marginRight: '0.5rem' }} onClick={() => openEdit(c)}>✏️ Editar</button>
                                            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.id)}>🗑️</button>
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
                            {editingId ? 'Editar Categoría' : 'Nueva Categoría'}
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div>
                                <label className="input-label">Nombre de Categoría</label>
                                <input className="input" type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej: Bebidas sin alcohol" />
                            </div>
                            <div>
                                <label className="input-label">Descripción (opcional)</label>
                                <textarea className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Detalle interno..." rows={3} />
                            </div>

                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancelar</button>
                                <button className="btn btn-success" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
