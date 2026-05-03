import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis;

// Prisma Client configuration optimized for Vercel/serverless
// Use connection pooling for production (PgBouncer or Prisma Data Proxy)
const prismaClientOptions = {
  log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Connection pool settings for serverless
  // These help prevent connection exhaustion in serverless environments
  ...(process.env.NODE_ENV === "production" && {
    // In production, use connection pooling
    // Ensure DATABASE_URL includes ?pgbouncer=true or use Prisma Data Proxy
  }),
};

// For Vercel/serverless: Use connection pooling
// If using PgBouncer, add ?pgbouncer=true to DATABASE_URL
// If using Prisma Data Proxy, use the proxy URL instead
const prisma = globalForPrisma.prisma || new PrismaClient(prismaClientOptions);

// Prevent connection exhaustion in serverless environments
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
} else {
  // In production, ensure we don't create multiple instances
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = prisma;
  }
}

// Graceful shutdown
if (process.env.NODE_ENV !== "production") {
  process.on("beforeExit", async () => {
    await prisma.$disconnect();
  });
}

export default prisma;

