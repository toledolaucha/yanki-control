import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🌱 Starting database seed...');

    // Hash the requested password
    const passwordHash = await bcrypt.hash('theyanki', 10);

    // Create the God Admin User
    const godUser = await prisma.user.upsert({
        where: { email: 'admin@yanki.com.ar' },
        update: {},
        create: {
            name: 'God Admin',
            email: 'admin@yanki.com.ar',
            password_hash: passwordHash,
            role: 'ADMIN',
            is_active: true,
        },
    });

    console.log(`✅ God user created/verified: ${godUser.email} / ${godUser.role}`);
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error(e);
        await prisma.$disconnect();
        process.exit(1);
    });
