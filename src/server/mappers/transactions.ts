import { Transaction, TransactionType } from '@/lib/types';

const reverseContMap: Record<string, any> = {
    CASH: 'efectivo',
    MERCADO_PAGO: 'mercado_pago',
    PETTY_CASH: 'caja_chica',
    SAFE: 'caja_fuerte'
};

const reverseCatMap: Record<string, any> = {
    SALE: 'venta',
    PROVIDER_PAYMENT: 'proveedor',
    SALARY_ADVANCE: 'sueldo',
    TO_PETTY_CASH: 'retiro_chica',
    EXPENSE: 'otro_egreso',
    INCOME: 'otro_ingreso',
    PETTY_CASH_DEPOSIT: 'deposito_chica'
};

export function mapTx(dbTx: any): Transaction {
    return {
        id: dbTx.id,
        shiftId: dbTx.shift_id,
        type: (dbTx.type === 'INCOME' ? 'ingreso' : 'egreso') as TransactionType,
        category: reverseCatMap[dbTx.category] || 'venta',
        amount: dbTx.amount,
        sourceContainer: dbTx.source_container ? reverseContMap[dbTx.source_container] : undefined,
        destContainer: dbTx.destination_container ? reverseContMap[dbTx.destination_container] : undefined,
        description: dbTx.description,
        createdBy: dbTx.user_id || 'System (Deleted)',
        createdAt: new Date(dbTx.created_at).toISOString(),
    };
}
