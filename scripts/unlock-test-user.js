const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const result = await prisma.user.updateMany({
    where: { email: 'verify@test.com' },
    data: { isLockedUntil: null, failedLoginCount: 0 },
  });
  console.log('Reset', result.count, 'users');
}

main().finally(() => prisma.$disconnect());
