import prisma from '@/lib/prisma';

export async function assertUniqueBarcode(barcode?: string, currentId?: string) {
    if (!barcode) return;
    const existing = await prisma.product.findUnique({ where: { barcode } });
    if (existing && existing.id !== currentId) {
        throw new Error(currentId ? 'El código de barras ya está en uso por otro producto' : 'El código de barras ya está en uso');
    }
}
