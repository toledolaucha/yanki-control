const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const categorias = [
    { name: 'Bebidas', description: 'Gaseosas, aguas, jugos, energizantes' },
    { name: 'Lácteos', description: 'Leche, yogur, queso, manteca' },
    { name: 'Golosinas', description: 'Caramelos, chicles, chocolates, chupetines' },
    { name: 'Snacks', description: 'Papas fritas, maníes, palitos, pochoclo' },
    { name: 'Cigarrillos', description: 'Cigarrillos y tabaco' },
    { name: 'Panificados', description: 'Pan, facturas, galletitas, alfajores' },
    { name: 'Almacén', description: 'Arroz, fideos, aceite, sal, harina' },
    { name: 'Enlatados', description: 'Conservas, atún, tomate, arvejas' },
    { name: 'Limpieza', description: 'Detergente, lavandina, desinfectante' },
    { name: 'Higiene Personal', description: 'Jabón, shampoo, desodorante, pañuelos' },
    { name: 'Fiambres y Quesos', description: 'Jamón, salami, queso en fetas' },
    { name: 'Otros', description: 'Productos que no encajan en otra categoría' },
];

async function main() {
    let created = 0;
    let skipped = 0;

    for (const cat of categorias) {
        const existing = await prisma.category.findUnique({ where: { name: cat.name } });
        if (existing) {
            console.log(`⏭️  Ya existe: ${cat.name}`);
            skipped++;
        } else {
            await prisma.category.create({ data: cat });
            console.log(`✅ Creada: ${cat.name}`);
            created++;
        }
    }

    console.log(`\n🎉 Listo: ${created} categorías creadas, ${skipped} ya existían.`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
