'use server';

import prisma from '@/lib/prisma';
import { Shift, ShiftPeriod } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { getUser } from '@/server/services/auth';
import { mapShift } from '@/server/mappers/shifts';
import { assertCanOpenShift, toDbShiftType } from '@/server/services/shifts';

export async function getActiveShift(): Promise<Shift | null> {
    const user = await getUser();
    if (!user) return null;

    const shift = await prisma.shift.findFirst({
        where: { status: 'OPEN', user_id: user.role === 'ADMIN' ? undefined : user.id },
        orderBy: { created_at: 'desc' }
    });
    return shift ? mapShift(shift) : null;
}

export async function openShift(data: { date: string, period: ShiftPeriod, cashStart: number, mpStart: number, notes: string }): Promise<Shift> {
    const user = await getUser();
    if (!user) throw new Error('No autorizado');

    await assertCanOpenShift(data.cashStart, data.mpStart);

    const shift = await prisma.shift.create({
        data: {
            user_id: user.id,
            shift_type: toDbShiftType(data.period),
            initial_cash: data.cashStart,
            initial_mp: data.mpStart,
            started_at: new Date(data.date).toISOString(),
        }
    });

    await prisma.auditLog.create({
        data: { user_id: user.id, action: 'OPEN_SHIFT', entity: 'Shift', entity_id: shift.id, new_data: JSON.stringify(shift) }
    });

    revalidatePath('/dashboard/turno');
    return mapShift(shift);
}

export async function closeShift(shiftId: string, finalCash: number, finalMp: number): Promise<Shift> {
    const user = await getUser();
    if (!user) throw new Error('No autorizado');

    const shift = await prisma.shift.update({
        where: { id: shiftId },
        data: { status: 'CLOSED' as any, ended_at: new Date().toISOString(), final_cash: finalCash, final_mp: finalMp }
    });

    await prisma.auditLog.create({
        data: { user_id: user.id, action: 'CLOSE_SHIFT', entity: 'Shift', entity_id: shift.id, new_data: JSON.stringify(shift) }
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

    await prisma.transaction.deleteMany({ where: { shift_id: shiftId } });
    await prisma.shift.delete({ where: { id: shiftId } });

    await prisma.auditLog.create({
        data: { user_id: user.id, action: 'DELETE_SHIFT', entity: 'Shift', entity_id: shiftId, new_data: JSON.stringify(shift) }
    });

    revalidatePath('/dashboard/reportes');
}

export async function getShift(shiftId: string): Promise<Shift | null> {
    const shift = await prisma.shift.findUnique({ where: { id: shiftId } });
    return shift ? mapShift(shift) : null;
}

export async function getClosedShifts(): Promise<Shift[]> {
    const shifts = await prisma.shift.findMany({ where: { status: 'CLOSED' }, orderBy: { created_at: 'desc' }, take: 5 });
    return shifts.map(mapShift);
}
