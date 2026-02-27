import { TransactionCategory } from '@/lib/types';

export function assertValidAmount(amount: number) {
    if (amount <= 0) throw new Error('Monto inválido');
}

export function mapTransactionInput(type: 'ingreso' | 'egreso', category: TransactionCategory, container: string) {
    const typeMap = { ingreso: 'INCOME', egreso: 'EXPENSE' } as const;
    const catMap: Record<string, string> = {
        venta: 'SALE',
        proveedor: 'PROVIDER_PAYMENT',
        sueldo: 'SALARY_ADVANCE',
        retiro_chica: 'TO_PETTY_CASH',
        otro_egreso: 'EXPENSE',
        otro_ingreso: 'INCOME',
        deposito_chica: 'PETTY_CASH_DEPOSIT'
    };
    const contMap: Record<string, string> = {
        efectivo: 'CASH',
        mercado_pago: 'MERCADO_PAGO',
        caja_chica: 'PETTY_CASH',
        caja_fuerte: 'SAFE'
    };

    const mappedType = typeMap[type];
    return {
        mappedType,
        mappedCategory: (catMap[category] || 'SALE') as any,
        sourceContainer: (mappedType === 'EXPENSE' ? contMap[container] : 'CASH') as any,
        destinationContainer: (mappedType === 'INCOME' ? contMap[container] : null) as any
    };
}
