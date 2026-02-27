import { Shift, ShiftPeriod } from '@/lib/types';

export function mapShift(dbShift: any): Shift {
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
