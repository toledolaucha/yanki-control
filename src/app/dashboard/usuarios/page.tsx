'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { formatDate } from '@/lib/store';
import { User, Role } from '@/lib/types';
import { getUsers, createUser, updateUser, toggleUserActive, deleteUser } from '@/app/actions';

export default function UsuariosPage() {
    const { user, isAdmin } = useAuth();
    const router = useRouter();
    const toast = useToast();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);

    const [showModal, setShowModal] = useState(false);
    const [editUser, setEditUser] = useState<User | null>(null);

    // Form state
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState<Role>('empleado');
    const [formError, setFormError] = useState('');
    const [saving, setSaving] = useState(false);

    const reload = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getUsers();
            setUsers(data);
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

    function openCreate() {
        setEditUser(null);
        setName(''); setEmail(''); setPassword(''); setRole('empleado'); setFormError('');
        setShowModal(true);
    }

    function openEdit(u: User) {
        setEditUser(u);
        setName(u.name); setEmail(u.email); setPassword(''); setRole(u.role); setFormError('');
        setShowModal(true);
    }

    async function handleSave() {
        setFormError('');
        if (!user) return;
        if (!name.trim()) { setFormError('El nombre es requerido'); return; }
        if (!email.trim() || !email.includes('@')) { setFormError('Email inválido'); return; }
        if (!editUser && password.length < 6) { setFormError('La contraseña debe tener al menos 6 caracteres'); return; }

        try {
            setSaving(true);
            if (editUser) {
                await updateUser(editUser.id, {
                    name: name.trim(),
                    email: email.trim(),
                    password: password ? password : undefined,
                    role
                });
                toast('Usuario actualizado', 'success');
            } else {
                await createUser({
                    name: name.trim(),
                    email: email.trim(),
                    password,
                    role
                });
                toast('Usuario creado correctamente', 'success');
            }
            setShowModal(false);
            await reload();
        } catch (e: any) {
            setFormError(e.message || 'Error al guardar usuario');
        } finally {
            setSaving(false);
        }
    }

    async function handleToggleActive(u: User) {
        if (u.id === user?.id) { toast('No podés desactivar tu propio usuario', 'error'); return; }

        try {
            await toggleUserActive(u.id);
            toast(`Usuario ${u.active ? 'desactivado' : 'activado'}`, 'info');
            await reload();
        } catch (e: any) {
            toast(e.message || 'Error cambiando estado', 'error');
        }
    }

    async function handleDelete(u: User) {
        if (u.id === user?.id) { toast('No podés eliminar tu propio usuario', 'error'); return; }

        if (!window.confirm(`Esta acción es irreversible. ¿Estás seguro que deseas eliminar permanentemente al usuario "${u.name}"?`)) {
            return;
        }

        try {
            await deleteUser(u.id);
            toast('Usuario eliminado exitosamente', 'success');
            await reload();
        } catch (e: any) {
            toast(e.message || 'Error al eliminar usuario', 'error');
        }
    }

    if (loading) return <div style={{ color: 'var(--text2)' }}>Cargando usuarios...</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>👥 Gestión de Usuarios</h1>
                    <p style={{ color: 'var(--text2)', fontSize: '0.875rem' }}>
                        {users.length} usuario{users.length !== 1 ? 's' : ''} registrados
                    </p>
                </div>
                <button className="btn btn-primary" onClick={openCreate}>
                    ➕ Nuevo Usuario
                </button>
            </div>

            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-wrap">
                    <table>
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Email</th>
                                <th>Rol</th>
                                <th>Estado</th>
                                <th>Creado</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map((u) => (
                                <tr key={u.id}>
                                    <td style={{ fontWeight: 600 }}>
                                        {u.role === 'admin' ? '👑 ' : '👤 '}{u.name}
                                        {u.id === user?.id && (
                                            <span style={{ marginLeft: '0.4rem', fontSize: '0.65rem', color: 'var(--accent2)' }}>(tú)</span>
                                        )}
                                    </td>
                                    <td style={{ color: 'var(--text2)' }}>{u.email}</td>
                                    <td>
                                        <span className={`badge ${u.role === 'admin' ? 'badge-info' : 'badge-success'}`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td>
                                        <span className={`badge ${u.active ? 'badge-success' : 'badge-danger'}`}>
                                            {u.active ? 'Activo' : 'Inactivo'}
                                        </span>
                                    </td>
                                    <td style={{ color: 'var(--text2)', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
                                        {formatDate(u.createdAt)}
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                                            <button className="btn btn-secondary btn-sm" onClick={() => openEdit(u)}>
                                                ✏️
                                            </button>
                                            <button
                                                className={`btn btn-sm ${u.active ? 'btn-warning' : 'btn-success'}`}
                                                onClick={() => handleToggleActive(u)}
                                                disabled={u.id === user?.id}
                                                title={u.active ? 'Desactivar usuario' : 'Activar usuario'}
                                            >
                                                {u.active ? '🚫' : '✓'}
                                            </button>
                                            <button
                                                className="btn btn-sm btn-danger"
                                                onClick={() => handleDelete(u)}
                                                disabled={u.id === user?.id}
                                                title="Eliminar usuario"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="modal-backdrop" onClick={() => setShowModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>
                            {editUser ? '✏️ Editar Usuario' : '➕ Nuevo Usuario'}
                        </h2>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                            <div>
                                <label className="input-label">Nombre completo</label>
                                <input className="input" type="text" placeholder="Juan Pérez" value={name} onChange={(e) => setName(e.target.value)} />
                            </div>
                            <div>
                                <label className="input-label">Email</label>
                                <input className="input" type="email" placeholder="juan@kiosko.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                            </div>
                            <div>
                                <label className="input-label">{editUser ? 'Contraseña (dejar vacío para no cambiar)' : 'Contraseña'}</label>
                                <input className="input" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
                            </div>
                            <div>
                                <label className="input-label">Rol</label>
                                <select className="input" value={role} onChange={(e) => setRole(e.target.value as Role)}>
                                    <option value="empleado">👤 Empleado</option>
                                    <option value="admin">👑 Administrador</option>
                                </select>
                            </div>
                            {formError && (
                                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: '8px', padding: '0.6rem 0.875rem', fontSize: '0.8rem', color: '#fca5a5' }}>
                                    {formError}
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                <button className="btn btn-secondary" onClick={() => setShowModal(false)} style={{ flex: 1 }} disabled={saving}>Cancelar</button>
                                <button className="btn btn-primary" onClick={handleSave} style={{ flex: 1 }} disabled={saving}>
                                    {saving ? 'Guardando...' : (editUser ? 'Guardar cambios' : 'Crear usuario')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
