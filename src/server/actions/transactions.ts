'use server';

import prisma from '@/lib/prisma';
import { Transaction, TransactionCategory } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { getUser } from '@/server/services/auth';
import { mapTx } from '@/server/mappers/transactions';
import { assertValidAmount, mapTransactionInput } from '@/server/services/transactions';

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

    assertValidAmount(data.amount);
    const mapped = mapTransactionInput(data.type, data.category, data.container);

    const tx = await prisma.transaction.create({
        data: {
            shift_id: data.shiftId,
            user_id: user.id,
            type: mapped.mappedType as any,
            category: mapped.mappedCategory,
            amount: data.amount,
            description: data.description,
            source_container: mapped.sourceContainer,
            destination_container: mapped.destinationContainer,
        }
    });

    await prisma.auditLog.create({
        data: { user_id: user.id, action: 'CREATE_TX', entity: 'Transaction', entity_id: tx.id, new_data: JSON.stringify(tx) }
    });

    revalidatePath('/dashboard/turno');
    revalidatePath('/dashboard/reportes');
    return mapTx(tx);
}

export async function getShiftTransactions(shiftId: string): Promise<Transaction[]> {
    const txs = await prisma.transaction.findMany({ where: { shift_id: shiftId }, orderBy: { created_at: 'asc' } });
    return txs.map(mapTx);
}

export async function deleteTransaction(txId: string) {
    const user = await getUser();
    if (!user) throw new Error('No autorizado');

    const tx = await prisma.transaction.findUnique({ where: { id: txId } });
    if (!tx) throw new Error('Transacción no encontrada');

    if (user.role !== 'ADMIN') {
        if (tx.category !== 'SALE') throw new Error('No autorizado: Sólo podés anular ventas.');
        const shift = await prisma.shift.findFirst({ where: { id: tx.shift_id || '', status: 'OPEN', user_id: user.id } });
        if (!shift) throw new Error('No autorizado: Sólo podés anular ventas de tu turno activo.');
    }

    if (tx.category === 'SALE' && tx.receipt_items) {
        try {
            const items = JSON.parse(tx.receipt_items);
            await prisma.$transaction(async (prismaCtx) => {
                for (const item of items) {
                    await prismaCtx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
                }
            });
        } catch (e) {
            console.error('Error restaurando stock de la venta anulada', e);
        }
    }

    await prisma.transaction.delete({ where: { id: txId } });
    await prisma.auditLog.create({
        data: { user_id: user.id, action: 'DELETE_TX', entity: 'Transaction', entity_id: txId, new_data: JSON.stringify(tx) }
    });

    revalidatePath('/dashboard/turno');
    revalidatePath('/dashboard/reportes');
}

export async function getBalances() {
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

export async function getSafeTransactions(): Promise<Transaction[]> {
    const caller = await getUser();
    if (!caller || caller.role !== 'ADMIN') throw new Error('No autorizado');

    const txs = await prisma.transaction.findMany({
        where: { OR: [{ source_container: 'SAFE' }, { destination_container: 'SAFE' }] },
        orderBy: { created_at: 'desc' }
    });
    return txs.map(mapTx);
}

export async function addSafeTransaction(data: { type: 'ingreso' | 'egreso', amount: number, description: string }): Promise<Transaction> {
    const caller = await getUser();
    if (!caller || caller.role !== 'ADMIN') throw new Error('No autorizado');
    assertValidAmount(data.amount);

    const isIncome = data.type === 'ingreso';
    const tx = await prisma.transaction.create({
        data: {
            user_id: caller.id,
            type: (isIncome ? 'INCOME' : 'EXPENSE') as any,
            category: (isIncome ? 'SAFE_DEPOSIT' : 'SAFE_WITHDRAWAL') as any,
            amount: data.amount,
            description: data.description,
            source_container: (isIncome ? null : 'SAFE') as any,
            destination_container: (isIncome ? 'SAFE' : null) as any,
        }
    });

    await prisma.auditLog.create({
        data: { user_id: caller.id, action: 'SAFE_TRANSACTION', entity: 'Transaction', entity_id: tx.id, new_data: JSON.stringify(tx) }
    });

    revalidatePath('/dashboard/caja-fuerte');
    return mapTx(tx);
}

export async function getPettyCashTransactions(): Promise<Transaction[]> {
    const caller = await getUser();
    if (!caller || caller.role !== 'ADMIN') throw new Error('No autorizado');

    const txs = await prisma.transaction.findMany({
        where: { OR: [{ source_container: 'CAJA_CHICA' as any }, { destination_container: 'CAJA_CHICA' as any }] },
        orderBy: { created_at: 'desc' }
    });
    return txs.map(mapTx);
}

export async function addPettyCashTransaction(data: { type: 'ingreso' | 'egreso', amount: number, description: string }): Promise<Transaction> {
    const caller = await getUser();
    if (!caller || caller.role !== 'ADMIN') throw new Error('No autorizado');
    assertValidAmount(data.amount);

    const isIncome = data.type === 'ingreso';
    const tx = await prisma.transaction.create({
        data: {
            user_id: caller.id,
            type: (isIncome ? 'INCOME' : 'EXPENSE') as any,
            category: (isIncome ? 'PETTY_CASH_DEPOSIT' : 'PETTY_CASH_WITHDRAWAL') as any,
            amount: data.amount,
            description: data.description,
            source_container: (isIncome ? null : 'CAJA_CHICA') as any,
            destination_container: (isIncome ? 'CAJA_CHICA' : null) as any,
        }
    });

    await prisma.auditLog.create({
        data: { user_id: caller.id, action: 'PETTY_CASH_TRANSACTION', entity: 'Transaction', entity_id: tx.id, new_data: JSON.stringify(tx) }
    });

    revalidatePath('/dashboard/caja-chica');
    return mapTx(tx);
}
