import prisma from '@/lib/prisma';
import { ShiftPeriod } from '@/lib/types';

export async function assertCanOpenShift(cashStart: number, mpStart: number) {
    const existing = await prisma.shift.findFirst({ where: { status: 'OPEN' } });
    if (existing) throw new Error('Ya hay un turno abierto en el sistema.');
    if (cashStart < 0 || mpStart < 0) throw new Error('Montos iniciales inválidos');
}

export function toDbShiftType(period: ShiftPeriod) {
    return period.toUpperCase() as any;
}
