'use server';

import prisma from '@/lib/prisma';
import { Product } from '@/lib/types';
import { revalidatePath } from 'next/cache';
import { getUser } from '@/server/services/auth';
import { mapProduct } from '@/server/mappers/products';
import { assertUniqueBarcode } from '@/server/services/products';

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

    await assertUniqueBarcode(data.barcode);

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
        data: { user_id: caller.id, action: 'CREATE_PRODUCT', entity: 'Product', entity_id: p.id, new_data: JSON.stringify({ name: p.name, stock: p.stock }) }
    });

    revalidatePath('/dashboard/productos');
    return mapProduct(p);
}

export async function updateProduct(id: string, data: { name: string, barcode?: string, costPrice: number, salePrice: number, stock: number, minStock?: number, categoryId?: string }): Promise<Product> {
    const caller = await getUser();
    if (!caller) throw new Error('No autorizado');

    await assertUniqueBarcode(data.barcode, id);

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

    if (current && (current.cost_price !== data.costPrice || current.sale_price !== data.salePrice)) {
        await (prisma as any).priceHistory.create({
            data: { product_id: id, cost_price: data.costPrice, sale_price: data.salePrice, changed_by: caller.name }
        });
    }

    await prisma.auditLog.create({
        data: { user_id: caller.id, action: 'UPDATE_PRODUCT', entity: 'Product', entity_id: p.id, new_data: JSON.stringify({ name: p.name, new_stock: p.stock }) }
    });

    revalidatePath('/dashboard/productos');
    return mapProduct(p);
}

export async function getPriceHistory(productId: string): Promise<{ id: string, costPrice: number, salePrice: number, changedBy: string | null, createdAt: string }[]> {
    const caller = await getUser();
    if (!caller) throw new Error('No autorizado');

    const history = await (prisma as any).priceHistory.findMany({ where: { product_id: productId }, orderBy: { created_at: 'desc' }, take: 30 });

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
            data: { product_id: productId, initial_quantity: quantity, current_quantity: quantity, cost_price: costPrice, provider: provider || null }
        });

        const p = await tx.product.update({
            where: { id: productId },
            data: { stock: { increment: quantity }, cost_price: costPrice }
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

        const batches = await tx.productBatch.findMany({ where: { product_id: productId, current_quantity: { gt: 0 } }, orderBy: { created_at: 'asc' } });

        let remainingToDeduct = quantity;
        let totalCogs = 0;

        for (const b of batches) {
            if (remainingToDeduct <= 0) break;
            const taking = Math.min(b.current_quantity, remainingToDeduct);
            totalCogs += taking * b.cost_price;
            remainingToDeduct -= taking;
            await tx.productBatch.update({ where: { id: b.id }, data: { current_quantity: b.current_quantity - taking } });
        }

        if (remainingToDeduct > 0) totalCogs += remainingToDeduct * p.cost_price;

        const loss = await tx.productLoss.create({
            data: { product_id: productId, quantity, cogs: totalCogs, reason, user_id: caller.id }
        });

        await tx.product.update({ where: { id: productId }, data: { stock: { decrement: quantity } } });

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

    const p = await prisma.product.update({ where: { id }, data: { is_active: false } });

    await prisma.auditLog.create({
        data: { user_id: caller.id, action: 'DELETE_PRODUCT', entity: 'Product', entity_id: p.id, new_data: JSON.stringify({ name: p.name }) }
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
            OR: isBarcode ? [{ barcode: query }, { name: { contains: query } }] : [{ name: { contains: query } }]
        },
        take: 10
    });

    return products.map(mapProduct);
}
