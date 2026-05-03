/**
 * Centralized Mock Definitions
 * All mocks for Prisma, Stripe, Redis, and other dependencies
 */

// Comprehensive Prisma Mock
const createPrismaMock = () => ({
  __esModule: true,
  default: {
    // User model
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    // RefreshToken model
    refreshToken: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    // AnalysisReport model
    analysisReport: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    // AnalysisJob model
    analysisJob: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    // UserSession model
    userSession: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    // BillingCustomer model
    billingCustomer: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    // BillingSubscription model
    billingSubscription: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    // BillingUsage model
    billingUsage: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    // BillingEvent model
    billingEvent: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    // BillingLog model
    billingLog: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    // UserAIEmbedding model
    userAIEmbedding: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    // PastAnalysis model
    pastAnalysis: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    // RelationshipGraph model
    relationshipGraph: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    // UserAIProfile model
    userAIProfile: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    // UserActivityLog model
    userActivityLog: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    // AuditLog model
    auditLog: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    // AdminUser model
    adminUser: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    // SystemHealthSnapshot model
    systemHealthSnapshot: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      upsert: jest.fn(),
      count: jest.fn(),
    },
    // Transaction support
    $transaction: jest.fn(async (callback) => {
      return await callback(createPrismaMock().default);
    }),
    // Raw query support
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    // Connection management
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  },
});

// Comprehensive Stripe Mock
const createStripeMock = () => ({
  __esModule: true,
  stripe: {
    // Customers
    customers: {
      create: jest.fn(),
      update: jest.fn(),
      retrieve: jest.fn(),
      list: jest.fn(),
      del: jest.fn(),
      delete: jest.fn(),
    },
    // Checkout Sessions
    checkout: {
      sessions: {
        create: jest.fn(),
        retrieve: jest.fn(),
        list: jest.fn(),
        expire: jest.fn(),
      },
    },
    // Subscriptions
    subscriptions: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
      list: jest.fn(),
      del: jest.fn(),
      delete: jest.fn(),
    },
    // Invoices
    invoices: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      list: jest.fn(),
      pay: jest.fn(),
    },
    // Webhooks
    webhooks: {
      constructEvent: jest.fn(),
      generateTestHeaderString: jest.fn(),
    },
    // Payment Methods
    paymentMethods: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      list: jest.fn(),
      attach: jest.fn(),
      detach: jest.fn(),
    },
  },
});

// Redis Mock Factory
const createRedisMock = () => {
  const Redis = require("ioredis-mock");
  return new Redis();
};

// Queue Mock Factory
const createQueueMock = () => ({
  analysisQueue: {
    add: jest.fn(),
    getJob: jest.fn(),
    getJobs: jest.fn(),
    getWaitingCount: jest.fn(),
    getActiveCount: jest.fn(),
    getCompletedCount: jest.fn(),
    getFailedCount: jest.fn(),
    close: jest.fn(),
  },
  queueEvents: {
    on: jest.fn(),
    close: jest.fn(),
  },
  addAnalysisJob: jest.fn(),
  getJobStatus: jest.fn(),
  createAnalysisWorker: jest.fn(),
  closeQueue: jest.fn(),
  connection: createRedisMock(),
});

// Gemini API Mock Factory
const createGeminiFetchMock = () => {
  return jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  summary: "Test summary",
                  overall_vibe: "positive",
                  metrics: {
                    flirty: 10,
                    passive_aggressive: 0,
                    friendly: 80,
                    romantic: 5,
                    dry_energy: 5,
                    angry: 0,
                    confused: 0,
                  },
                  personality_traits: [],
                  behavior_flags: [],
                  advice: "Test advice",
                }),
              },
            ],
          },
        },
      ],
    }),
  });
};

// Tesseract Mock Factory
const createTesseractMock = () => ({
  recognize: jest.fn().mockResolvedValue({
    data: {
      text: "test ocr text",
    },
  }),
  createWorker: jest.fn(),
  setLogging: jest.fn(),
});

// Export for CommonJS compatibility
module.exports = {
  createPrismaMock,
  createStripeMock,
  createRedisMock,
  createQueueMock,
  createGeminiFetchMock,
  createTesseractMock,
};

