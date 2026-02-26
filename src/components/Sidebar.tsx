'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

interface NavItem {
    href: string;
    icon: string;
    label: string;
    adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
    { href: '/dashboard', icon: '📊', label: 'Dashboard', adminOnly: true },
    { href: '/dashboard/turno', icon: '⏱️', label: 'Mi Turno' },
    { href: '/dashboard/productos', icon: '📦', label: 'Inventario' },
    { href: '/dashboard/categorias', icon: '🏷️', label: 'Categorías' },
    { href: '/dashboard/caja-chica', icon: '🪙', label: 'Caja Chica', adminOnly: true },
    { href: '/dashboard/caja-fuerte', icon: '🔒', label: 'Caja Fuerte', adminOnly: true },
    { href: '/dashboard/reportes', icon: '📈', label: 'Reportes', adminOnly: true },
    { href: '/dashboard/usuarios', icon: '👥', label: 'Usuarios', adminOnly: true },
    { href: '/dashboard/auditoria', icon: '📋', label: 'Auditoría', adminOnly: true },
];

interface SidebarProps {
    open: boolean;
    onClose: () => void;
}

export function Sidebar({ open, onClose }: SidebarProps) {
    const pathname = usePathname();
    const { user, logout, isAdmin } = useAuth();
    const router = useRouter();

    function handleLogout() {
        logout();
        router.push('/login');
    }

    const items = NAV_ITEMS.filter((item) => {
        if (item.adminOnly && !isAdmin) return false;
        if (item.href === '/dashboard/turno' && isAdmin) return false;
        return true;
    });

    return (
        <>
            {open && (
                <div
                    onClick={onClose}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.5)',
                        zIndex: 39,
                    }}
                />
            )}
            <nav className={`sidebar${open ? ' open' : ''}`}>
                {/* Logo */}
                <div
                    style={{
                        padding: '1.25rem 1rem',
                        borderBottom: '1px solid var(--border)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem',
                    }}
                >
                    <div
                        style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #6366f1, #a78bfa)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.1rem',
                            flexShrink: 0,
                        }}
                    >
                        🏪
                    </div>
                    <div>
                        <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>Yanki 24</div>
                        <div style={{ fontSize: '0.65rem', color: 'var(--text2)' }}>Gestión 24hs</div>
                    </div>
                </div>

                {/* Nav links */}
                <div style={{ flex: 1, padding: '0.75rem 0', overflowY: 'auto' }}>
                    {items.map((item) => {
                        const active =
                            item.href === '/dashboard'
                                ? pathname === '/dashboard'
                                : pathname.startsWith(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`sidebar-link${active ? ' active' : ''}`}
                                onClick={onClose}
                            >
                                <span style={{ fontSize: '1rem' }}>{item.icon}</span>
                                {item.label}
                                {item.adminOnly && (
                                    <span
                                        style={{
                                            marginLeft: 'auto',
                                            fontSize: '0.6rem',
                                            background: 'rgba(99,102,241,0.2)',
                                            color: 'var(--accent2)',
                                            padding: '0.1rem 0.4rem',
                                            borderRadius: '999px',
                                            fontWeight: 700,
                                        }}
                                    >
                                        ADMIN
                                    </span>
                                )}
                            </Link>
                        );
                    })}
                </div>

                {/* User section */}
                <div
                    style={{
                        padding: '1rem',
                        borderTop: '1px solid var(--border)',
                    }}
                >
                    <div
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.65rem',
                            marginBottom: '0.75rem',
                        }}
                    >
                        <div
                            style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: isAdmin
                                    ? 'linear-gradient(135deg, #6366f1, #a78bfa)'
                                    : 'linear-gradient(135deg, #22c55e, #86efac)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '0.9rem',
                                flexShrink: 0,
                            }}
                        >
                            {isAdmin ? '👑' : '👤'}
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div
                                style={{
                                    fontWeight: 700,
                                    fontSize: '0.8rem',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {user?.name}
                            </div>
                            <div style={{ fontSize: '0.65rem', color: 'var(--text2)', textTransform: 'uppercase' }}>
                                {user?.role}
                            </div>
                        </div>
                    </div>
                    <button
                        className="btn btn-secondary"
                        style={{ width: '100%', justifyContent: 'center', fontSize: '0.75rem' }}
                        onClick={handleLogout}
                    >
                        🚪 Cerrar sesión
                    </button>
                </div>
            </nav>
        </>
    );
}
