import { AppState, ContainerKey } from './types';

const DEMO_USERS = [
    {
        id: 'admin-001',
        name: 'Administrador',
        email: 'admin@kiosko.com',
        password: 'admin123',
        role: 'admin' as const,
        active: true,
        createdAt: new Date('2024-01-01').toISOString(),
        createdBy: 'system',
    },
    {
        id: 'emp-001',
        name: 'María González',
        email: 'empleado@kiosko.com',
        password: 'empleado123',
        role: 'empleado' as const,
        active: true,
        createdAt: new Date('2024-01-01').toISOString(),
        createdBy: 'admin-001',
    },
];

const INITIAL_STATE: AppState = {
    users: DEMO_USERS,
    shifts: [],
    transactions: [],
    containers: {
        efectivo: 0,
        mercado_pago: 0,
        caja_chica: 5000,
        caja_fuerte: 50000,
    },
    auditLogs: [],
};

const STORAGE_KEY = 'kiosko_app_state';

export function getState(): AppState {
    if (typeof window === 'undefined') return INITIAL_STATE;
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return INITIAL_STATE;
        const parsed = JSON.parse(raw) as AppState;
        // Merge demo users always (in case seed changed)
        const existingIds = parsed.users.map((u) => u.id);
        DEMO_USERS.forEach((du) => {
            if (!existingIds.includes(du.id)) parsed.users.push(du);
        });
        return parsed;
    } catch {
        return INITIAL_STATE;
    }
}

export function setState(state: AppState): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_STATE));
}

// ─── Helpers ────────────────────────────────────────────────────────────────

export function genId(): string {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export function formatARS(amount: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 2,
    }).format(amount);
}

export function containerLabel(key: ContainerKey): string {
    const labels: Record<ContainerKey, string> = {
        efectivo: 'Efectivo',
        mercado_pago: 'Mercado Pago',
        caja_chica: 'Caja Chica',
        caja_fuerte: 'Caja Fuerte',
    };
    return labels[key];
}

export function periodLabel(period: string): string {
    const labels: Record<string, string> = {
        mañana: '🌅 Mañana (06:00–14:00)',
        tarde: '☀️ Tarde (14:00–22:00)',
        noche: '🌙 Noche (22:00–06:00)',
    };
    return labels[period] ?? period;
}

export function formatDate(dateInput: string | Date): string {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    // If it's an invalid date, return the original string
    if (isNaN(d.getTime())) return String(dateInput);

    // Si viene un string 'YYYY-MM-DD' sin hora, al hacer new Date() puede restar un día por el timezone.
    // Para evitarlo, chequeamos si es exactamente YYYY-MM-DD
    if (typeof dateInput === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateInput)) {
        const [y, m, day] = dateInput.split('-');
        return `${day}/${m}/${y}`;
    }

    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}
