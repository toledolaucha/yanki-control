import { Product } from '@/lib/types';

export function mapProduct(dbProduct: any): Product {
    return {
        id: dbProduct.id,
        name: dbProduct.name,
        barcode: dbProduct.barcode,
        costPrice: dbProduct.cost_price,
        salePrice: dbProduct.sale_price,
        stock: dbProduct.stock,
        minStock: dbProduct.min_stock ?? 0,
        categoryId: dbProduct.category_id,
        category: dbProduct.category
            ? {
                id: dbProduct.category.id,
                name: dbProduct.category.name,
                description: dbProduct.category.description,
                isActive: dbProduct.category.is_active
            }
            : null,
        isActive: dbProduct.is_active,
    };
}
