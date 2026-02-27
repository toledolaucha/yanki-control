'use server';

import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { Shift, ShiftPeriod, Transaction, TransactionCategory, TransactionType, Product, ContainerKey, Category, AuditLog } from '@/lib/types';
import { revalidatePath } from 'next/cache';

async function getUser() {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;

    // Verify the user actually exists in the DB (protects against stale sessions after DB reset)
    const dbUser = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (dbUser) return { ...session.user, id: dbUser.id };

    // Fallback: look up by email (session ID might be from a previous DB)
    const byEmail = await prisma.user.findUnique({ where: { email: session.user.email! } });
    if (byEmail) return { ...session.user, id: byEmail.id, role: byEmail.role };

    return null;
}

function mapShift(dbShift: any): Shift {
    return {
        id: dbShift.id,
        date: new Date(dbShift.started_at).toISOString().slice(0, 10),
        period: dbShift.shift_type.toLowerCase() as ShiftPeriod,
        openedBy: dbShift.user_id,
        openedAt: new Date(dbShift.started_at).toISOString(),
        cashStart: dbShift.initial_cash,
        mpStart: dbShift.initial_mp,
        status: dbShift.status.toLowerCase() as 'open' | 'closed',
        closedAt: dbShift.ended_at ? new Date(dbShift.ended_at).toISOString() : undefined,
    };
}

function mapTx(dbTx: any): Transaction {
    const reverseContMap: Record<string, any> = {
        'CASH': 'efectivo',
        'MERCADO_PAGO': 'mercado_pago',
        'PETTY_CASH': 'caja_chica',
        'SAFE': 'caja_fuerte'
    };
    const reverseCatMap: Record<string, any> = {
        'SALE': 'venta',
        'PROVIDER_PAYMENT': 'proveedor',
        'SALARY_ADVANCE': 'sueldo',
        'TO_PETTY_CASH': 'retiro_chica',
        'EXPENSE': 'otro_egreso',
        'INCOME': 'otro_ingreso',
        'PETTY_CASH_DEPOSIT': 'deposito_chica'
    };

    return {
        id: dbTx.id,
        shiftId: dbTx.shift_id,
        type: dbTx.type === 'INCOME' ? 'ingreso' : 'egreso' as TransactionType,
        category: reverseCatMap[dbTx.category] || 'venta',
        amount: dbTx.amount,
        sourceContainer: dbTx.source_container ? reverseContMap[dbTx.source_container] : undefined,
        destContainer: dbTx.destination_container ? reverseContMap[dbTx.destination_container] : undefined,
        description: dbTx.description,
        createdBy: dbTx.user_id || 'System (Deleted)',
        createdAt: new Date(dbTx.created_at).toISOString(),
    };
}

export async function getActiveShift(): Promise<Shift | null> {
    const user = await getUser();
    if (!user) return null;

    const shift = await prisma.shift.findFirst({
        where: {
            status: 'OPEN',
            user_id: user.role === 'ADMIN' ? undefined : user.id,
        },
        orderBy: { created_at: 'desc' }
    });
    return shift ? mapShift(shift) : null;
}

export async function openShift(data: { date: string, period: ShiftPeriod, cashStart: number, mpStart: number, notes: string }): Promise<Shift> {
    const user = await getUser();
    if (!user) throw new Error('No autorizado');

    // Valida no tener ya un turno
    const existing = await prisma.shift.findFirst({
        where: { status: 'OPEN' }
    });
    if (existing) throw new Error('Ya hay un turno abierto en el sistema.');

    // Validar montos
    if (data.cashStart < 0 || data.mpStart < 0) throw new Error('Montos iniciales inválidos');

    const shift = await prisma.shift.create({
        data: {
            user_id: user.id,
            shift_type: data.period.toUpperCase() as any,
            initial_cash: data.cashStart,
            initial_mp: data.mpStart,
            started_at: new Date(data.date).toISOString(), // o new Date()
        }
    });

    await prisma.auditLog.create({
        data: {
            user_id: user.id,
            action: 'OPEN_SHIFT',
            entity: 'Shift',
            entity_id: shift.id,
            new_data: JSON.stringify(shift)
        }
    });

    revalidatePath('/dashboard/turno');
    return mapShift(shift);
}

export async function closeShift(shiftId: string, finalCash: number, finalMp: number): Promise<Shift> {
    const user = await getUser();
    if (!user) throw new Error('No autorizado');

    const shift = await prisma.shift.update({
        where: { id: shiftId },
        data: {
            status: 'CLOSED' as any,
            ended_at: new Date().toISOString(),
            final_cash: finalCash,
            final_mp: finalMp
        }
    });

    await prisma.auditLog.create({
        data: {
            user_id: user.id,
            action: 'CLOSE_SHIFT',
            entity: 'Shift',
            entity_id: shift.id,
            new_data: JSON.stringify(shift)
        }
    });

    revalidatePath('/dashboard/turno');
    revalidatePath('/dashboard/reportes');
    return mapShift(shift);
}

export async function deleteShift(shiftId: string): Promise<void> {
    const user = await getUser();
    if (!user || user.role !== 'ADMIN') throw new Error('No autorizado');

    const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
    if (!shift) throw new Error('Turno no encontrado');

    // Delete transactions first (cascade may not be set)
    await prisma.transaction.deleteMany({ where: { shift_id: shiftId } });
    await prisma.shift.delete({ where: { id: shiftId } });

    await prisma.auditLog.create({
        data: {
            user_id: user.id,
            action: 'DELETE_SHIFT',
            entity: 'Shift',
            entity_id: shiftId,
            new_data: JSON.stringify(shift)
        }
    });

    revalidatePath('/dashboard/reportes');
}

export async function addTransaction(data: {
    shiftId: string,
    type: 'ingreso' | 'egreso',
    category: TransactionCategory,
    container: string,
    amount: number,
    description: string
}): Promise<Transaction> {
    const user = await getUser();
    if (!user) throw new Error('No autorizado');

    if (data.amount <= 0) throw new Error('Monto inválido');

    // Mapeos a Prisma Enums (strings in SQLite)
    const typeMap = { 'ingreso': 'INCOME', 'egreso': 'EXPENSE' };
    const mappedType = typeMap[data.type];
    const catMap: Record<string, string> = {
        'venta': 'SALE',
        'proveedor': 'PROVIDER_PAYMENT',
        'sueldo': 'SALARY_ADVANCE',
        'retiro_chica': 'TO_PETTY_CASH', // or FROM pending context
        'otro_egreso': 'EXPENSE',
        'otro_ingreso': 'INCOME',
        'deposito_chica': 'PETTY_CASH_DEPOSIT'
    };

    // Contenedores a DB
    const contMap: Record<string, string> = {
        'efectivo': 'CASH',
        'mercado_pago': 'MERCADO_PAGO',
        'caja_chica': 'PETTY_CASH',
        'caja_fuerte': 'SAFE'
    };

    const tx = await prisma.transaction.create({
        data: {
            shift_id: data.shiftId,
            user_id: user.id,
            type: mappedType as any,
            category: (catMap[data.category] || 'SALE') as any,
            amount: data.amount,
            description: data.description,
            source_container: (mappedType === 'EXPENSE' ? contMap[data.container] : 'CASH') as any,
            destination_container: (mappedType === 'INCOME' ? contMap[data.container] : null) as any,
        }
    });

    await prisma.auditLog.create({
        data: {
            user_id: user.id,
            action: 'CREATE_TX',
            entity: 'Transaction',
            entity_id: tx.id,
            new_data: JSON.stringify(tx)
        }
    });

    revalidatePath('/dashboard/turno');
    revalidatePath('/dashboard/reportes');
    return mapTx(tx);
}

export async function getShiftTransactions(shiftId: string): Promise<Transaction[]> {
    const txs = await prisma.transaction.findMany({
        where: { shift_id: shiftId },
        orderBy: { created_at: 'asc' }
    });
    return txs.map(mapTx);
}

export async function getShift(shiftId: string): Promise<Shift | null> {
    const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
    return shift ? mapShift(shift) : null;
}

export async function deleteTransaction(txId: string) {
    const user = await getUser();
    if (!user) throw new Error('No autorizado');

    const tx = await prisma.transaction.findUnique({ where: { id: txId } });
    if (!tx) throw new Error('Transacción no encontrada');

    if (user.role !== 'ADMIN') {
        if (tx.category !== 'SALE') throw new Error('No autorizado: Sólo podés anular ventas.');

        // Ensure the shift is active and belongs to the user
        const shift = await prisma.shift.findFirst({
            where: {
                id: tx.shift_id || '',
                status: 'OPEN',
                user_id: user.id
            }
        });
        if (!shift) throw new Error('No autorizado: Sólo podés anular ventas de tu turno activo.');
    }

    // Restaurar stock si fue una venta
    if (tx.category === 'SALE' && tx.receipt_items) {
        try {
            const items = JSON.parse(tx.receipt_items);
            await prisma.$transaction(async (prismaCtx) => {
                for (const item of items) {
                    await prismaCtx.product.update({
                        where: { id: item.productId },
                        data: { stock: { increment: item.quantity } }
                    });
                }
            });
        } catch (e) {
            console.error("Error restaurando stock de la venta anulada", e);
        }
    }

    await prisma.transaction.delete({ where: { id: txId } });

    await prisma.auditLog.create({
        data: {
            user_id: user.id,
            action: 'DELETE_TX',
            entity: 'Transaction',
            entity_id: txId,
            new_data: JSON.stringify(tx)
        }
    });

    revalidatePath('/dashboard/turno');
    revalidatePath('/dashboard/reportes');
}

export async function getBalances() {
    // Basic dynamic calculation from txs (in a real app, track running balances in Container table)
    const txs = await prisma.transaction.findMany();
    let { CASH, MERCADO_PAGO, PETTY_CASH, SAFE } = { CASH: 0, MERCADO_PAGO: 0, PETTY_CASH: 0, SAFE: 0 };

    for (const tx of txs) {
        if (tx.type === 'INCOME' && tx.destination_container) {
            if (tx.destination_container === 'CASH') CASH += tx.amount;
            if (tx.destination_container === 'MERCADO_PAGO') MERCADO_PAGO += tx.amount;
            if (tx.destination_container === 'PETTY_CASH' || tx.destination_container === 'CAJA_CHICA') PETTY_CASH += tx.amount;
            if (tx.destination_container === 'SAFE' || tx.destination_container === 'CAJA_FUERTE') SAFE += tx.amount;
        } else if (tx.type === 'EXPENSE' && tx.source_container) {
            if (tx.source_container === 'CASH') CASH -= tx.amount;
            if (tx.source_container === 'MERCADO_PAGO') MERCADO_PAGO -= tx.amount;
            if (tx.source_container === 'PETTY_CASH' || tx.source_container === 'CAJA_CHICA') PETTY_CASH -= tx.amount;
            if (tx.source_container === 'SAFE' || tx.source_container === 'CAJA_FUERTE') SAFE -= tx.amount;
        }
    }

    const openShifts = await prisma.shift.findMany({ where: { status: 'OPEN' } });
    for (const sh of openShifts) {
        CASH += sh.initial_cash;
        MERCADO_PAGO += sh.initial_mp;
    }

    return { efectivo: CASH, mercado_pago: MERCADO_PAGO, caja_chica: PETTY_CASH, caja_fuerte: SAFE };
}

export async function getClosedShifts(): Promise<Shift[]> {
    const shifts = await prisma.shift.findMany({
        where: { status: 'CLOSED' },
        orderBy: { created_at: 'desc' },
        take: 5
    });
    return shifts.map(mapShift);
}

// ── ADMIN: User Management ──────────────────────────────────────────────────

import bcrypt from 'bcryptjs';
import { User, Role } from '@/lib/types';

function mapUser(dbUser: any): User {
    return {
        id: dbUser.id,
        name: dbUser.name,
        email: dbUser.email,
        password: '', // Non-exposable
        role: dbUser.role.toLowerCase() as Role,
        active: dbUser.is_active,
        createdAt: new Date(dbUser.created_at).toISOString(),
        createdBy: 'system', // Prisma schema has no created_by on User
    };
}

export async function getUsers(): Promise<User[]> {
    const user = await getUser();
    if (!user || user.role !== 'ADMIN') throw new Error('No autorizado');

    const users = await prisma.user.findMany({ orderBy: { created_at: 'asc' } });
    return users.map(mapUser);
}

export async function createUser(data: { name: string, email: string, password: string, role: Role }): Promise<User> {
    const caller = await getUser();
    if (!caller || caller.role !== 'ADMIN') throw new Error('No autorizado');

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) throw new Error('El email ya está en uso');

    const hashedPassword = await bcrypt.hash(data.password, 10);
    const u = await prisma.user.create({
        data: {
            name: data.name,
            email: data.email,
            password_hash: hashedPassword,
            role: data.role.toUpperCase() as any,
            is_active: true
        }
    });

    await prisma.auditLog.create({
        data: {
            user_id: caller.id,
            action: 'CREATE_USER',
            entity: 'User',
            entity_id: u.id,
            new_data: JSON.stringify({ email: u.email, role: u.role })
        }
    });

    revalidatePath('/dashboard/usuarios');
    return mapUser(u);
}

export async function updateUser(userId: string, data: { name: string, email: string, password?: string, role: Role }): Promise<User> {
    const caller = await getUser();
    if (!caller || caller.role !== 'ADMIN') throw new Error('No autorizado');

    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing && existing.id !== userId) throw new Error('El email ya está en uso por otro usuario');

    const updateData: any = {
        name: data.name,
        email: data.email,
        role: data.role.toUpperCase()
    };

    if (data.password) {
        updateData.password_hash = await bcrypt.hash(data.password, 10);
    }

    const u = await prisma.user.update({
        where: { id: userId },
        data: updateData
    });

    await prisma.auditLog.create({
        data: {
            user_id: caller.id,
            action: 'UPDATE_USER',
            entity: 'User',
            entity_id: u.id,
            new_data: JSON.stringify({ email: u.email, role: u.role })
        }
    });

    revalidatePath('/dashboard/usuarios');
    return mapUser(u);
}

export async function toggleUserActive(userId: string): Promise<User> {
    const caller = await getUser();
    if (!caller || caller.role !== 'ADMIN') throw new Error('No autorizado');
    if (caller.id === userId) throw new Error('No podés desactivar tu propia cuenta');

    const u = await prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new Error('Usuario no encontrado');

    const updated = await prisma.user.update({
        where: { id: userId },
        data: { is_active: !u.is_active }
    });

    await prisma.auditLog.create({
        data: {
            user_id: caller.id,
            action: updated.is_active ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
            entity: 'User',
            entity_id: u.id,
            new_data: JSON.stringify({ active: updated.is_active })
        }
    });

    revalidatePath('/dashboard/usuarios');
    return mapUser(updated);
}

export async function deleteUser(userId: string): Promise<void> {
    const caller = await getUser();
    if (!caller || caller.role !== 'ADMIN') throw new Error('No autorizado');
    if (caller.id === userId) throw new Error('No podés eliminar tu propia cuenta');

    const u = await prisma.user.findUnique({ where: { id: userId } });
    if (!u) throw new Error('Usuario no encontrado');

    const deletedUser = await prisma.user.delete({
        where: { id: userId }
    });

    await prisma.auditLog.create({
        data: {
            user_id: caller.id,
            action: 'DELETE_USER',
            entity: 'User',
            entity_id: u.id,
            new_data: JSON.stringify({ email: deletedUser.email, role: deletedUser.role })
        }
    });

    revalidatePath('/dashboard/usuarios');
}

// ── ADMIN: Safe Management ──────────────────────────────────────────────────

export async function getSafeTransactions(): Promise<Transaction[]> {
    const caller = await getUser();
    if (!caller || caller.role !== 'ADMIN') throw new Error('No autorizado');

    const txs = await prisma.transaction.findMany({
        where: {
            OR: [
                { source_container: 'SAFE' },
                { destination_container: 'SAFE' }
            ]
        },
        orderBy: { created_at: 'desc' }
    });

    return txs.map(mapTx);
}

export async function addSafeTransaction(data: { type: 'ingreso' | 'egreso', amount: number, description: string }): Promise<Transaction> {
    const caller = await getUser();
    if (!caller || caller.role !== 'ADMIN') throw new Error('No autorizado');

    if (data.amount <= 0) throw new Error('Monto inválido');

    // Mapeos a DB
    const isIncome = data.type === 'ingreso';

    const tx = await prisma.transaction.create({
        data: {
            user_id: caller.id,
            type: (isIncome ? 'INCOME' : 'EXPENSE') as any,
            category: (isIncome ? 'SAFE_DEPOSIT' : 'SAFE_WITHDRAWAL') as any, // category in DB is string
            amount: data.amount,
            description: data.description,
            source_container: (isIncome ? null : 'SAFE') as any,
            destination_container: (isIncome ? 'SAFE' : null) as any,
        }
    });

    await prisma.auditLog.create({
        data: {
            user_id: caller.id,
            action: 'SAFE_TRANSACTION',
            entity: 'Transaction',
            entity_id: tx.id,
            new_data: JSON.stringify(tx)
        }
    });

    revalidatePath('/dashboard/caja-fuerte');
    return mapTx(tx);
}

// ── ADMIN: Petty Cash Management ────────────────────────────────────────────

export async function getPettyCashTransactions(): Promise<Transaction[]> {
    const caller = await getUser();
    if (!caller || caller.role !== 'ADMIN') throw new Error('No autorizado');

    const txs = await prisma.transaction.findMany({
        where: {
            OR: [
                { source_container: 'CAJA_CHICA' as any },
                { destination_container: 'CAJA_CHICA' as any }
            ]
        },
        orderBy: { created_at: 'desc' }
    });

    return txs.map(mapTx);
}

export async function addPettyCashTransaction(data: { type: 'ingreso' | 'egreso', amount: number, description: string }): Promise<Transaction> {
    const caller = await getUser();
    if (!caller || caller.role !== 'ADMIN') throw new Error('No autorizado');

    if (data.amount <= 0) throw new Error('Monto inválido');

    // Mapeos a DB
    const isIncome = data.type === 'ingreso';

    const tx = await prisma.transaction.create({
        data: {
            user_id: caller.id,
            type: (isIncome ? 'INCOME' : 'EXPENSE') as any,
            category: (isIncome ? 'PETTY_CASH_DEPOSIT' : 'PETTY_CASH_WITHDRAWAL') as any, // category in DB is string
            amount: data.amount,
            description: data.description,
            source_container: (isIncome ? null : 'CAJA_CHICA') as any,
            destination_container: (isIncome ? 'CAJA_CHICA' : null) as any,
        }
    });

    await prisma.auditLog.create({
        data: {
            user_id: caller.id,
            action: 'PETTY_CASH_TRANSACTION',
            entity: 'Transaction',
            entity_id: tx.id,
            new_data: JSON.stringify(tx)
        }
    });

    revalidatePath('/dashboard/caja-chica');
    return mapTx(tx);
}

// ── ADMIN: Reports ─────────────────────────────────────────────────────────

export interface ReportRow {
    shift: Shift;
    ventas: number;
    egresos: number;
    balance: number;
    costoMercaderia: number;
    gananciaNeta: number;
    txCount: number;
    operatorName: string;
}

export interface ReportsData {
    rows: ReportRow[];
    totalMermas: number;
}

export async function getReportsData(fromStr: string, toStr: string): Promise<ReportsData> {
    const caller = await getUser();
    if (!caller || caller.role !== 'ADMIN') throw new Error('No autorizado');

    const fromDate = new Date(fromStr);
    const toDate = new Date(toStr);
    toDate.setHours(23, 59, 59, 999);

    const [shifts, losses] = await Promise.all([
        prisma.shift.findMany({
            where: {
                started_at: {
                    gte: fromDate,
                    lte: toDate
                }
            },
            include: {
                transactions: true,
                user: true
            },
            orderBy: {
                started_at: 'desc'
            }
        }),
        prisma.productLoss.findMany({
            where: {
                created_at: {
                    gte: fromDate,
                    lte: toDate
                }
            }
        })
    ]);

    const totalMermas = losses.reduce((acc: number, val: any) => acc + val.cogs, 0);

    const rows = shifts.map((sh: any) => {
        let ventas = 0;
        let egresos = 0;
        let cogs = 0;

        for (const t of sh.transactions) {
            if (t.type === 'INCOME' && t.category === 'SALE') {
                ventas += t.amount;
                if (t.receipt_items) {
                    try {
                        const items = JSON.parse(t.receipt_items);
                        for (const item of items) {
                            if (item.cost_price !== undefined) {
                                cogs += item.cost_price;
                            } else {
                                // Fallback pre-FIFO phase
                                cogs += 0;
                            }
                        }
                    } catch (e) { }
                }
            }
            else if (t.type === 'EXPENSE') {
                egresos += t.amount;
            }
            else if (t.type === 'INCOME') {
                ventas += t.amount; // otros ingresos
            }
        }

        return {
            shift: mapShift(sh),
            ventas,
            egresos,
            balance: ventas - egresos,
            costoMercaderia: cogs,
            gananciaNeta: ventas - cogs, // Ganancia pura sobre ventas reales (sin restar egresos de caja para este cálculo comercial)
            txCount: sh.transactions.length,
            operatorName: sh.user?.name || 'Sistema'
        };
    });

    return { rows, totalMermas };
}

// ── ADMIN & GENERAL: Dashboard ────────────────────────────────────────────

export async function getDashboardMetrics() {
    // Get metrics for the last 7 days
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const lastWeek = new Date(today);
    lastWeek.setDate(lastWeek.getDate() - 6);
    lastWeek.setHours(0, 0, 0, 0);

    const shifts = await prisma.shift.findMany({
        where: {
            started_at: {
                gte: lastWeek,
                lte: today
            }
        },
        include: {
            transactions: true
        }
    });

    // Group by day string (YYYY-MM-DD)
    const metricsByDay: Record<string, { ventas: number, egresos: number }> = {};

    // Initialize 7 days
    for (let i = 0; i < 7; i++) {
        const d = new Date(lastWeek);
        d.setDate(d.getDate() + i);
        metricsByDay[d.toISOString().slice(0, 10)] = { ventas: 0, egresos: 0 };
    }

    let todayVentas = 0;
    let todayEgresos = 0;
    const todayStr = today.toISOString().slice(0, 10);

    for (const sh of shifts) {
        const dayStr = sh.started_at.toISOString().slice(0, 10);
        let shVentas = 0;
        let shEgresos = 0;

        for (const t of sh.transactions) {
            if (t.type === 'INCOME' && t.category === 'SALE') shVentas += t.amount;
            else if (t.type === 'EXPENSE') shEgresos += t.amount;
            else if (t.type === 'INCOME') shVentas += t.amount;
        }

        if (metricsByDay[dayStr]) {
            metricsByDay[dayStr].ventas += shVentas;
            metricsByDay[dayStr].egresos += shEgresos;
        }

        if (dayStr === todayStr) {
            todayVentas += shVentas;
            todayEgresos += shEgresos;
        }
    }

    // Calcular ingresos totales en efectivo y egresos totales
    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const allTxs = await prisma.transaction.findMany({
        where: {
            created_at: {
                gte: firstDayOfMonth,
                lte: today
            }
        }
    });

    let efvoIngresos = 0;
    let totalEgresosAll = 0;
    for (const t of allTxs) {
        if (t.type === 'INCOME' && (t.destination_container === 'CASH' || t.destination_container === 'EFECTIVO')) {
            efvoIngresos += t.amount;
        }
        if (t.type === 'EXPENSE' && t.category !== 'SAFE_DEPOSIT' && t.category !== 'PETTY_CASH_DEPOSIT' && t.category !== 'SAFE_WITHDRAWAL' && t.category !== 'PETTY_CASH_WITHDRAWAL') {
            totalEgresosAll += t.amount;
        }
    }

    const last7 = Object.keys(metricsByDay).sort().map(k => ({
        date: k,
        ventas: metricsByDay[k].ventas
    }));

    // --- PHASE 7: Analytics (Top Selling & Top Margin) ---
    // 1. Top Margin Products
    const allProducts = await prisma.product.findMany({
        where: { is_active: true }
    });

    const topMargin = allProducts
        .filter(p => p.cost_price > 0 && p.sale_price > 0)
        .map(p => ({
            id: p.id,
            name: p.name,
            margin: ((p.sale_price - p.cost_price) / p.cost_price) * 100
        }))
        .sort((a, b) => b.margin - a.margin)
        .slice(0, 5);

    // 2. Top Selling Products (Last 30 days)
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const recentSales = await prisma.transaction.findMany({
        where: {
            type: 'INCOME',
            category: 'SALE',
            created_at: { gte: thirtyDaysAgo, lte: today },
            receipt_items: { not: null }
        }
    });

    const salesMap: Record<string, { id?: string, name: string, quantity: number }> = {};

    for (const t of recentSales) {
        if (!t.receipt_items) continue;
        try {
            const items = JSON.parse(t.receipt_items);
            for (const item of items) {
                const key = item.id || item.productId || item.name;
                if (!salesMap[key]) {
                    // name may be missing in old sales — resolve later
                    salesMap[key] = { id: item.id || item.productId, name: item.name || '', quantity: 0 };
                }
                salesMap[key].quantity += item.quantity;
            }
        } catch (e) { }
    }

    // Resolve missing names from DB (for sales recorded before the name fix)
    const missingIds = Object.values(salesMap)
        .filter(p => !p.name && p.id)
        .map(p => p.id as string);

    if (missingIds.length > 0) {
        const dbProducts = await prisma.product.findMany({
            where: { id: { in: missingIds } },
            select: { id: true, name: true }
        });
        const nameById: Record<string, string> = {};
        for (const p of dbProducts) nameById[p.id] = p.name;

        for (const entry of Object.values(salesMap)) {
            if (!entry.name && entry.id && nameById[entry.id]) {
                entry.name = nameById[entry.id];
            }
        }
    }

    const topSelling = Object.values(salesMap)
        .filter(p => p.name) // skip entries we couldn't resolve
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5);

    // 3. Low stock products (stock < min_stock, only when min_stock > 0)
    const lowStockProducts = await (prisma.product as any).findMany({
        where: {
            is_active: true,
            min_stock: { gt: 0 }
        },
        select: { id: true, name: true, stock: true, min_stock: true },
        orderBy: { name: 'asc' }
    });

    const lowStock = lowStockProducts
        .filter((p: any) => p.stock < p.min_stock)
        .map((p: any) => ({ id: p.id, name: p.name, stock: p.stock, minStock: p.min_stock }));

    return {
        today: {
            ventas: todayVentas,
            egresos: todayEgresos,
            balanceNeto: todayVentas - todayEgresos
        },
        totals: {
            ingresosEfectivo: efvoIngresos,
            gastosTotales: totalEgresosAll
        },
        last7,
        topMargin,
        topSelling,
        lowStock
    };
}

export async function getRecentTransactions(): Promise<(Transaction & { userName: string })[]> {
    const txs = await prisma.transaction.findMany({
        orderBy: { created_at: 'desc' },
        take: 8,
        include: { user: true }
    });

    return txs.map((t: any) => ({
        ...mapTx(t),
        userName: t.user ? t.user.name : 'Usuario Eliminado'
    }));
}

// ── CATEGORIES ────────────────────────────────────────────────────────────

export async function getCategories(): Promise<Category[]> {
    const user = await getUser();
    if (!user) throw new Error('No autorizado');

    const categories = await prisma.category.findMany({
        where: { is_active: true },
        orderBy: { name: 'asc' }
    });
    return categories.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        isActive: c.is_active
    }));
}

export async function createCategory(data: { name: string, description?: string }): Promise<Category> {
    const caller = await getUser();
    if (!caller) throw new Error('No autorizado');

    const existing = await prisma.category.findUnique({ where: { name: data.name } });
    if (existing) throw new Error('La categoría ya existe');

    const c = await prisma.category.create({
        data: {
            name: data.name,
            description: data.description || null
        }
    });

    await prisma.auditLog.create({
        data: {
            user_id: caller.id,
            action: 'CREATE_CATEGORY',
            entity: 'Category',
            entity_id: c.id,
            new_data: JSON.stringify({ name: c.name })
        }
    });

    revalidatePath('/dashboard/categorias');
    revalidatePath('/dashboard/productos');
    return { id: c.id, name: c.name, description: c.description, isActive: c.is_active };
}

export async function updateCategory(id: string, data: { name: string, description?: string }): Promise<Category> {
    const caller = await getUser();
    if (!caller) throw new Error('No autorizado');

    const existing = await prisma.category.findUnique({ where: { name: data.name } });
    if (existing && existing.id !== id) throw new Error('El nombre de categoría ya está en uso');

    const c = await prisma.category.update({
        where: { id },
        data: {
            name: data.name,
            description: data.description || null
        }
    });

    await prisma.auditLog.create({
        data: {
            user_id: caller.id,
            action: 'UPDATE_CATEGORY',
            entity: 'Category',
            entity_id: c.id,
            new_data: JSON.stringify({ name: c.name })
        }
    });

    revalidatePath('/dashboard/categorias');
    revalidatePath('/dashboard/productos');
    return { id: c.id, name: c.name, description: c.description, isActive: c.is_active };
}

export async function deleteCategory(id: string): Promise<void> {
    const caller = await getUser();
    if (!caller) throw new Error('No autorizado');

    const c = await prisma.category.update({
        where: { id },
        data: { is_active: false }
    });

    await prisma.auditLog.create({
        data: {
            user_id: caller.id,
            action: 'DELETE_CATEGORY',
            entity: 'Category',
            entity_id: c.id,
            new_data: JSON.stringify({ name: c.name })
        }
    });

    revalidatePath('/dashboard/categorias');
    revalidatePath('/dashboard/productos');
}

// ── PRODUCTS & INVENTORY (POS) ────────────────────────────────────────────

function mapProduct(dbProduct: any): Product {
    return {
        id: dbProduct.id,
        name: dbProduct.name,
        barcode: dbProduct.barcode,
        costPrice: dbProduct.cost_price,
        salePrice: dbProduct.sale_price,
        stock: dbProduct.stock,
        minStock: dbProduct.min_stock ?? 0,
        categoryId: dbProduct.category_id,
        category: dbProduct.category ? {
            id: dbProduct.category.id,
            name: dbProduct.category.name,
            description: dbProduct.category.description,
            isActive: dbProduct.category.is_active
        } : null,
        isActive: dbProduct.is_active,
    };
}

export async function getProducts(): Promise<Product[]> {
    const user = await getUser();
    if (!user) throw new Error('No autorizado');

    const products = await prisma.product.findMany({
        where: { is_active: true },
        include: { category: true },
        orderBy: { name: 'asc' }
    });
    return products.map(mapProduct);
}

export async function createProduct(data: { name: string, barcode?: string, costPrice: number, salePrice: number, stock: number, minStock?: number, categoryId?: string }): Promise<Product> {
    const caller = await getUser();
    if (!caller) throw new Error('No autorizado');

    if (data.barcode) {
        const existing = await prisma.product.findUnique({ where: { barcode: data.barcode } });
        if (existing) throw new Error('El código de barras ya está en uso');
    }

    const p = await (prisma.product as any).create({
        data: {
            name: data.name,
            barcode: data.barcode || null,
            cost_price: data.costPrice,
            sale_price: data.salePrice,
            stock: data.stock,
            min_stock: data.minStock ?? 0,
            category_id: data.categoryId || null
        },
        include: { category: true }
    });

    await prisma.auditLog.create({
        data: {
            user_id: caller.id,
            action: 'CREATE_PRODUCT',
            entity: 'Product',
            entity_id: p.id,
            new_data: JSON.stringify({ name: p.name, stock: p.stock })
        }
    });

    revalidatePath('/dashboard/productos');
    return mapProduct(p);
}

export async function updateProduct(id: string, data: { name: string, barcode?: string, costPrice: number, salePrice: number, stock: number, minStock?: number, categoryId?: string }): Promise<Product> {
    const caller = await getUser();
    if (!caller) throw new Error('No autorizado');

    if (data.barcode) {
        const existing = await prisma.product.findUnique({ where: { barcode: data.barcode } });
        if (existing && existing.id !== id) throw new Error('El código de barras ya está en uso por otro producto');
    }

    // Get current prices before update to detect changes
    const current = await prisma.product.findUnique({ where: { id }, select: { cost_price: true, sale_price: true } });

    const p = await (prisma.product as any).update({
        where: { id },
        data: {
            name: data.name,
            barcode: data.barcode || null,
            cost_price: data.costPrice,
            sale_price: data.salePrice,
            stock: data.stock,
            min_stock: data.minStock ?? 0,
            category_id: data.categoryId || null
        },
        include: { category: true }
    });

    // Record price history if cost or sale price changed
    if (current && (current.cost_price !== data.costPrice || current.sale_price !== data.salePrice)) {
        await (prisma as any).priceHistory.create({
            data: {
                product_id: id,
                cost_price: data.costPrice,
                sale_price: data.salePrice,
                changed_by: caller.name
            }
        });
    }

    await prisma.auditLog.create({
        data: {
            user_id: caller.id,
            action: 'UPDATE_PRODUCT',
            entity: 'Product',
            entity_id: p.id,
            new_data: JSON.stringify({ name: p.name, new_stock: p.stock })
        }
    });

    revalidatePath('/dashboard/productos');
    return mapProduct(p);
}

export async function getPriceHistory(productId: string): Promise<{ id: string, costPrice: number, salePrice: number, changedBy: string | null, createdAt: string }[]> {
    const caller = await getUser();
    if (!caller) throw new Error('No autorizado');

    const history = await (prisma as any).priceHistory.findMany({
        where: { product_id: productId },
        orderBy: { created_at: 'desc' },
        take: 30
    });

    return history.map((h: any) => ({
        id: h.id,
        costPrice: h.cost_price,
        salePrice: h.sale_price,
        changedBy: h.changed_by,
        createdAt: h.created_at.toISOString()
    }));
}


export async function addProductBatch(productId: string, quantity: number, costPrice: number, provider?: string): Promise<void> {
    const caller = await getUser();
    if (!caller) throw new Error('No autorizado');

    if (quantity <= 0) throw new Error('La cantidad debe ser mayor a 0');
    if (costPrice < 0) throw new Error('El precio de costo no puede ser negativo');

    await prisma.$transaction(async (tx) => {
        const batch = await tx.productBatch.create({
            data: {
                product_id: productId,
                initial_quantity: quantity,
                current_quantity: quantity,
                cost_price: costPrice,
                provider: provider || null
            }
        });

        const p = await tx.product.update({
            where: { id: productId },
            data: {
                stock: { increment: quantity },
                cost_price: costPrice // actualizamos el precio de costo "referencial" más reciente
            }
        });

        await tx.auditLog.create({
            data: {
                user_id: caller.id,
                action: 'ADD_PRODUCT_BATCH',
                entity: 'Product',
                entity_id: p.id,
                new_data: JSON.stringify({ batch_id: batch.id, quantity, cost_price: costPrice, provider, new_total_stock: p.stock })
            }
        });
    });

    revalidatePath('/dashboard/productos');
}

export async function reportProductLoss(productId: string, quantity: number, reason: string): Promise<void> {
    const caller = await getUser();
    if (!caller) throw new Error('No autorizado');

    if (quantity <= 0) throw new Error('La cantidad debe ser mayor a 0');
    if (!reason.trim()) throw new Error('Debe especificar un motivo');

    await prisma.$transaction(async (tx) => {
        const p = await tx.product.findUnique({ where: { id: productId } });
        if (!p) throw new Error('Producto no encontrado');

        // FIFO calculation for COGS
        const batches = await tx.productBatch.findMany({
            where: { product_id: productId, current_quantity: { gt: 0 } },
            orderBy: { created_at: 'asc' }
        });

        let remainingToDeduct = quantity;
        let totalCogs = 0;

        for (const b of batches) {
            if (remainingToDeduct <= 0) break;

            const taking = Math.min(b.current_quantity, remainingToDeduct);
            totalCogs += taking * b.cost_price;
            remainingToDeduct -= taking;

            await tx.productBatch.update({
                where: { id: b.id },
                data: { current_quantity: b.current_quantity - taking }
            });
        }

        // If there's still quantity to deduct, use the fallback cost price
        if (remainingToDeduct > 0) {
            totalCogs += remainingToDeduct * p.cost_price;
        }

        // Create the loss record
        const loss = await tx.productLoss.create({
            data: {
                product_id: productId,
                quantity: quantity,
                cogs: totalCogs,
                reason: reason,
                user_id: caller.id
            }
        });

        // Update product stock
        await tx.product.update({
            where: { id: productId },
            data: { stock: { decrement: quantity } }
        });

        // Audit Log
        await tx.auditLog.create({
            data: {
                user_id: caller.id,
                action: 'REPORT_LOSS',
                entity: 'ProductLoss',
                entity_id: loss.id,
                new_data: JSON.stringify({ product_id: productId, quantity, total_cogs: totalCogs, reason })
            }
        });
    });

    revalidatePath('/dashboard/productos');
    revalidatePath('/dashboard/reportes');
}

export async function deleteProduct(id: string): Promise<void> {
    const caller = await getUser();
    if (!caller) throw new Error('No autorizado');

    // Soft delete to preserve history (sales, etc.)
    const p = await prisma.product.update({
        where: { id },
        data: { is_active: false }
    });

    await prisma.auditLog.create({
        data: {
            user_id: caller.id,
            action: 'DELETE_PRODUCT',
            entity: 'Product',
            entity_id: p.id,
            new_data: JSON.stringify({ name: p.name })
        }
    });

    revalidatePath('/dashboard/productos');
}

export async function searchProduct(query: string): Promise<Product[]> {
    const user = await getUser();
    if (!user) throw new Error('No autorizado');

    if (!query.trim()) return [];

    const isBarcode = /^[0-9]+$/.test(query);

    const products = await prisma.product.findMany({
        where: {
            is_active: true,
            OR: isBarcode
                ? [{ barcode: query }, { name: { contains: query } }] // Match SQLite contains logic (case-insensitive depends on driver, let's keep it simple)
                : [{ name: { contains: query } }]
        },
        take: 10
    });

    return products.map(mapProduct);
}

export async function processSale(shiftId: string, items: { productId: string, quantity: number, price: number }[], paymentMethod: ContainerKey): Promise<Transaction> {
    const caller = await getUser();
    if (!caller) throw new Error('No autorizado');

    let totalAmount = 0;
    const itemDetails = items.map(i => {
        totalAmount += (i.quantity * i.price);
        return `${i.quantity}x ${i.productId}`; // Simple description building
    }).join(', ');

    if (totalAmount <= 0) throw new Error('Monto inválido de venta');

    // Calculate exact cost using FIFO batches
    let enrichedItems: any[] = [];

    await prisma.$transaction(async (prismaCtx) => {
        for (const item of items) {
            // Get product to decrement global stock and read its fallback cost
            const p = await prismaCtx.product.update({
                where: { id: item.productId },
                data: {
                    stock: { decrement: item.quantity }
                }
            });

            // FIFO Batch Processing
            let qtyToDeduct = item.quantity;
            let totalItemCogs = 0; // Cost of Goods Sold for this line item

            const activeBatches = await prismaCtx.productBatch.findMany({
                where: { product_id: p.id, current_quantity: { gt: 0 } },
                orderBy: { created_at: 'asc' }
            });

            for (const batch of activeBatches) {
                if (qtyToDeduct <= 0) break;

                const deduction = Math.min(qtyToDeduct, batch.current_quantity);
                totalItemCogs += (deduction * batch.cost_price);
                qtyToDeduct -= deduction;

                await prismaCtx.productBatch.update({
                    where: { id: batch.id },
                    data: { current_quantity: { decrement: deduction } }
                });
            }

            // Fallback for remaining quantity if we didn't have enough batches (legacy stock)
            if (qtyToDeduct > 0) {
                totalItemCogs += (qtyToDeduct * p.cost_price);
            }

            enrichedItems.push({
                ...item,
                name: p.name, // Save product name for topSelling analytics
                cost_price: totalItemCogs // Save total cost of this line item quantity
            });

            await prismaCtx.auditLog.create({
                data: {
                    user_id: caller.id,
                    action: 'POS_SALE_STOCK_DECREMENT',
                    entity: 'Product',
                    entity_id: p.id,
                    new_data: JSON.stringify({ rx_id: 'pending', qty: item.quantity, remaining_stock: p.stock, cogs: totalItemCogs })
                }
            });
        }
    });

    // Create the transaction
    const contMap: Record<string, string> = {
        'efectivo': 'CASH',
        'mercado_pago': 'MERCADO_PAGO',
        'caja_chica': 'PETTY_CASH',
        'caja_fuerte': 'SAFE'
    };

    const finalTx = await prisma.transaction.create({
        data: {
            shift_id: shiftId,
            user_id: caller.id,
            type: 'INCOME',
            category: 'SALE',
            amount: totalAmount,
            description: `Venta POS: ${items.length} productos`,
            receipt_items: JSON.stringify(enrichedItems), // Now has FIFO cost
            source_container: 'CASH',
            destination_container: (contMap[paymentMethod] || 'CASH') as any,
        }
    });

    // Update the pending rx_ids in audit logs (naive approach for SQLite)
    // In a prod app we might structure the transaction block differently, 
    // but SQLite requires sequential awaits inside interactive transactions.

    revalidatePath('/dashboard/turno');
    return mapTx(finalTx);
}

export async function getAuditLogs(): Promise<AuditLog[]> {
    const logs = await prisma.auditLog.findMany({
        include: { user: true },
        orderBy: { created_at: 'desc' }
    });

    return logs.map((log) => ({
        id: log.id,
        userId: log.user_id || 'unknown',
        userName: log.user?.name || 'Sistema/Desconocido',
        action: log.action,
        entityType: log.entity.toLowerCase() as any, // mapping loosely to match frontend coloring
        entityId: log.entity_id,
        before: log.previous_data ? JSON.parse(log.previous_data) : null,
        after: log.new_data ? JSON.parse(log.new_data) : {},
        timestamp: log.created_at.toISOString()
    }));
}
