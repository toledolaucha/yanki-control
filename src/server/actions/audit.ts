'use server';

import prisma from '@/lib/prisma';
import { AuditLog } from '@/lib/types';

export async function getAuditLogs(): Promise<AuditLog[]> {
    const logs = await prisma.auditLog.findMany({ include: { user: true }, orderBy: { created_at: 'desc' } });

    return logs.map((log) => ({
        id: log.id,
        userId: log.user_id || 'unknown',
        userName: log.user?.name || 'Sistema/Desconocido',
        action: log.action,
        entityType: log.entity.toLowerCase() as any,
        entityId: log.entity_id,
        before: log.previous_data ? JSON.parse(log.previous_data) : null,
        after: log.new_data ? JSON.parse(log.new_data) : {},
        timestamp: log.created_at.toISOString()
    }));
}
