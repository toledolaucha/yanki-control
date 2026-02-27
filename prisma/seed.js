const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  const passwordHash = await bcrypt.hash('theyanki', 10);

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
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
