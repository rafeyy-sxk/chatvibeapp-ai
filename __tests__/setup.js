/**
 * Jest Test Setup
 * Configures mocks and test environment
 */

// Mock Next.js App Router
jest.mock("next/server", () => ({
  NextRequest: jest.fn((url, init) => {
    const urlObj = typeof url === "string" ? new URL(url) : url;
    const headers = new Map(Object.entries(init?.headers || {}));
    
    // Add cookies support
    const cookies = new Map();
    if (init?.cookies) {
      Object.entries(init.cookies).forEach(([key, value]) => {
        cookies.set(key, { value });
      });
    }

    return {
      url: urlObj.toString(),
      method: init?.method || "GET",
      headers,
      cookies: {
        get: jest.fn((name) => cookies.get(name)),
        set: jest.fn(),
        has: jest.fn((name) => cookies.has(name)),
        delete: jest.fn(),
        getAll: jest.fn(() => Array.from(cookies.values())),
      },
      json: jest.fn(async () => {
        try {
          return JSON.parse(init?.body || "{}");
        } catch {
          return {};
        }
      }),
      text: jest.fn(async () => init?.body || ""),
      formData: jest.fn(),
      signal: {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        aborted: false,
      },
      ip: init?.ip || "127.0.0.1",
      ...init,
    };
  }),
  NextResponse: {
    json: jest.fn((data, init) => {
      const response = {
        json: jest.fn(async () => data),
        text: jest.fn(async () => JSON.stringify(data)),
        status: init?.status || 200,
        statusText: init?.statusText || "OK",
        headers: new Map(),
        cookies: {
          set: jest.fn(),
          delete: jest.fn(),
          get: jest.fn(),
        },
        ...init,
      };
      return response;
    }),
  },
  headers: jest.fn(async () => ({
    get: jest.fn(),
  })),
}));

// Comprehensive Prisma Mock
jest.mock("@/lib/prisma", () => {
  const createMockModel = () => ({
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
  });

  return {
    __esModule: true,
    default: {
      user: createMockModel(),
      refreshToken: createMockModel(),
      analysisReport: createMockModel(),
      analysisJob: createMockModel(),
      userSession: createMockModel(),
      billingCustomer: createMockModel(),
      billingSubscription: createMockModel(),
      billingUsage: createMockModel(),
      billingEvent: createMockModel(),
      billingLog: createMockModel(),
      userAIEmbedding: createMockModel(),
      pastAnalysis: createMockModel(),
      relationshipGraph: createMockModel(),
      userAIProfile: createMockModel(),
      userActivityLog: createMockModel(),
      auditLog: createMockModel(),
      adminUser: createMockModel(),
      systemHealthSnapshot: createMockModel(),
      $transaction: jest.fn(async (callback) => {
        const prisma = jest.requireActual("@/lib/prisma").default;
        return await callback(prisma);
      }),
      $queryRaw: jest.fn(),
      $executeRaw: jest.fn(),
      $connect: jest.fn(),
      $disconnect: jest.fn(),
    },
  };
});

// Comprehensive Stripe Mock
jest.mock("@/lib/billing/stripe", () => ({
  __esModule: true,
  stripe: {
    customers: {
      create: jest.fn(),
      update: jest.fn(),
      retrieve: jest.fn(),
      list: jest.fn(),
      del: jest.fn(),
      delete: jest.fn(),
    },
    checkout: {
      sessions: {
        create: jest.fn(),
        retrieve: jest.fn(),
        list: jest.fn(),
        expire: jest.fn(),
      },
    },
    subscriptions: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      cancel: jest.fn(),
      list: jest.fn(),
      del: jest.fn(),
      delete: jest.fn(),
    },
    invoices: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      list: jest.fn(),
      pay: jest.fn(),
    },
    webhooks: {
      constructEvent: jest.fn(),
      generateTestHeaderString: jest.fn(),
    },
    paymentMethods: {
      create: jest.fn(),
      retrieve: jest.fn(),
      update: jest.fn(),
      list: jest.fn(),
      attach: jest.fn(),
      detach: jest.fn(),
    },
  },
  TIER_CONFIG: {
    FREE: { name: "Free", monthlyPrice: 0, monthlyCredits: 10 },
    PRO: { name: "Pro", monthlyPrice: 1900, monthlyCredits: 100 },
    ELITE: { name: "Elite", monthlyPrice: 4900, monthlyCredits: 500 },
  },
  getTierConfig: jest.fn((tier) => ({
    FREE: { name: "Free", monthlyPrice: 0, monthlyCredits: 10 },
    PRO: { name: "Pro", monthlyPrice: 1900, monthlyCredits: 100 },
    ELITE: { name: "Elite", monthlyPrice: 4900, monthlyCredits: 500 },
  }[tier] || { name: "Free", monthlyPrice: 0, monthlyCredits: 10 })),
  centsToDollars: jest.fn((cents) => (cents / 100).toFixed(2)),
  dollarsToCents: jest.fn((dollars) => Math.round(dollars * 100)),
  getUserTier: jest.fn(),
}));

// Mock Redis - Use ioredis-mock
jest.mock("ioredis", () => {
  const RedisMock = require("ioredis-mock");
  // Return the constructor function
  return function(...args) {
    return new RedisMock(...args);
  };
});

// Mock Cache module
jest.mock("@/lib/cache", () => {
  const RedisMock = require("ioredis-mock");
  
  return {
    __esModule: true,
    getCachedOCR: jest.fn(),
    setCachedOCR: jest.fn(),
    getCachedAnalysis: jest.fn(),
    setCachedAnalysis: jest.fn(),
    memoryCacheLayer: {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
    },
    redisCacheLayer: {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
    },
    getCached: jest.fn(),
    setCached: jest.fn(),
    invalidateCache: jest.fn(),
    cacheRedis: new RedisMock(),
  };
});

// Mock Queue module
jest.mock("@/lib/queue", () => {
  const Redis = require("ioredis-mock");
  const { Queue, Worker, QueueEvents } = require("bullmq");
  
  const mockRedis = new Redis();
  const mockQueue = {
    add: jest.fn(),
    getJob: jest.fn(),
    getJobs: jest.fn(),
    getWaitingCount: jest.fn().mockResolvedValue(0),
    getActiveCount: jest.fn().mockResolvedValue(0),
    getCompletedCount: jest.fn().mockResolvedValue(0),
    getFailedCount: jest.fn().mockResolvedValue(0),
    close: jest.fn(),
  };
  
  return {
    __esModule: true,
    analysisQueue: mockQueue,
    queueEvents: {
      on: jest.fn(),
      close: jest.fn(),
    },
    createRedisConnection: jest.fn(() => new Redis()),
    createAnalysisWorker: jest.fn((processor, options) => {
      const Worker = require("bullmq").Worker;
      return new Worker("test-queue", processor, {
        connection: mockRedis,
        ...options,
      });
    }),
    addAnalysisJob: jest.fn().mockResolvedValue({
      id: "job-123",
      data: {},
      opts: {},
      updateProgress: jest.fn(),
    }),
    getJobStatus: jest.fn(),
    closeQueue: jest.fn(),
    initializeQueue: jest.fn((queueName, redisUrl) => ({
      queue: mockQueue,
      connection: mockRedis,
      queueName: queueName || "test-queue",
    })),
    connection: mockRedis,
  };
});

// Mock global fetch for Gemini API
global.fetch = jest.fn().mockResolvedValue({
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

// Mock Tesseract.js
jest.mock("tesseract.js", () => ({
  recognize: jest.fn().mockResolvedValue({
    data: {
      text: "test ocr text",
    },
  }),
  createWorker: jest.fn(),
  setLogging: jest.fn(),
}));

// Mock Logger
jest.mock("@/lib/logger", () => ({
  __esModule: true,
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  captureException: jest.fn(),
  getCorrelationId: jest.fn(() => "test-correlation-id"),
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  })),
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Logger index
jest.mock("@/lib/logger/index", () => ({
  __esModule: true,
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
  getCorrelationId: jest.fn(() => "test-correlation-id"),
  createLogger: jest.fn(),
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Env module
jest.mock("@/lib/env", () => ({
  __esModule: true,
  env: {
    databaseUrl: process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test",
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
    jwtSecret: process.env.JWT_SECRET || "test_jwt_secret_key_min_32_chars_long",
    refreshSecret: process.env.REFRESH_TOKEN_SECRET || "test_refresh_secret_key_min_32_chars",
    accessTokenExpiry: "15m",
    refreshTokenExpiry: "7d",
    bcryptRounds: 12,
    frontendOrigin: "http://localhost:3000",
    smtpHost: "",
    smtpPort: 587,
    smtpUser: "",
    smtpPass: "",
    stripeSecretKey: "sk_test_mock",
    stripeWebhookSecret: "whsec_test_mock",
    stripePriceIdPro: "price_pro_mock",
    stripePriceIdElite: "price_elite_mock",
    geminiApiKey: "test_gemini_key",
    openaiApiKey: "",
    queueName: "test-queue",
  },
}));

// Mock Analysis Engine
jest.mock("@/server/src/services/analysisEngine", () => ({
  __esModule: true,
  runAnalysisEngine: jest.fn().mockReturnValue({
    sentimentTimeline: [],
    toxicity: { average: 0, perMessage: [] },
    responsiveness: { messageCount: 4 },
    dominance: { speakers: {} },
    keywordClusters: [],
    behaviorFlags: {
      anxious: true,
      avoidant: false,
      manipulation: false,
      clinginess: true,
      indifference: true,
      inconsistency: false,
      details: [
        { type: "anxious", matches: ["are you mad", "sorry if"] },
        { type: "clinginess", matches: ["why didn't you reply"] },
        { type: "indifference", matches: ["k", "whatever"] },
      ],
    },
    piiDetected: {},
    sanitizedText: "test text",
  }),
  default: jest.fn().mockReturnValue({
    sentimentTimeline: [],
    toxicity: { average: 0 },
    responsiveness: { messageCount: 4 },
    dominance: { speakers: {} },
    keywordClusters: [],
    behaviorFlags: {
      anxious: true,
      avoidant: false,
      manipulation: false,
      clinginess: true,
      indifference: true,
      inconsistency: false,
      details: [
        { type: "anxious", matches: ["are you mad", "sorry if"] },
        { type: "clinginess", matches: ["why didn't you reply"] },
        { type: "indifference", matches: ["k", "whatever"] },
      ],
    },
    piiDetected: {},
    sanitizedText: "test text",
  }),
}));

// Mock Middleware
jest.mock("@/middleware/rateLimit", () => ({
  __esModule: true,
  enforceRateLimit: jest.fn().mockResolvedValue(null),
}));

jest.mock("@/middleware/csrf", () => ({
  __esModule: true,
  validateCsrf: jest.fn().mockReturnValue(null),
  ensureCsrfCookie: jest.fn(),
  getCsrfToken: jest.fn(() => "test-csrf-token"),
}));

// Mock Security modules
jest.mock("@/lib/security/password", () => ({
  __esModule: true,
  verifyPassword: jest.fn(),
  hashPassword: jest.fn(),
}));

jest.mock("@/lib/security/sessionManager", () => ({
  __esModule: true,
  createUserSession: jest.fn(),
  revokeUserSession: jest.fn(),
  getUserSessions: jest.fn(),
}));

jest.mock("@/lib/security/headers", () => ({
  __esModule: true,
  SECURITY_HEADERS: {
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  },
  applySecurityHeaders: jest.fn((response) => response),
  applyNodeSecurityHeaders: jest.fn((res) => res),
}));

// Mock Auth modules
jest.mock("@/lib/auth/lockout", () => ({
  __esModule: true,
  isLocked: jest.fn().mockReturnValue(false),
  registerFailedLogin: jest.fn(),
  resetFailedLogins: jest.fn(),
}));

jest.mock("@/lib/auth/refreshStore", () => ({
  __esModule: true,
  persistRefreshToken: jest.fn(),
  revokeRefreshToken: jest.fn(),
  findValidRefreshToken: jest.fn(),
}));

jest.mock("@/lib/auth/cookies", () => ({
  __esModule: true,
  setRefreshCookie: jest.fn(),
  clearRefreshCookie: jest.fn(),
}));

// Mock HTTP helpers
jest.mock("@/lib/http", () => ({
  __esModule: true,
  jsonResponse: jest.fn((data, init) => ({
    json: jest.fn(async () => data),
    status: init?.status || 200,
    headers: new Map(),
  })),
  errorResponse: jest.fn((message, status, extra) => ({
    json: jest.fn(async () => ({ error: message, ...extra })),
    status: status || 400,
    headers: new Map(),
  })),
}));

// Mock Billing modules
jest.mock("@/lib/billing/customer", () => ({
  __esModule: true,
  getOrCreateStripeCustomer: jest.fn(),
  getCustomerByUserId: jest.fn(),
  getCustomerByStripeId: jest.fn(),
  updateCustomer: jest.fn(),
}));

jest.mock("@/lib/billing/subscription", () => ({
  __esModule: true,
  createSubscription: jest.fn(),
  cancelSubscription: jest.fn(),
  updateSubscriptionFromStripe: jest.fn(),
  getUserSubscription: jest.fn(),
  getUserTier: jest.fn().mockResolvedValue("FREE"),
}));

jest.mock("@/lib/billing/usage", () => ({
  __esModule: true,
  resetCreditsForPeriod: jest.fn(),
  recordUsage: jest.fn(),
  getUsageForPeriod: jest.fn(),
}));

jest.mock("@/lib/billing/checkout", () => ({
  __esModule: true,
  createCheckoutSession: jest.fn(),
}));

// Mock Redis module
jest.mock("@/lib/redis", () => {
  const RedisMock = require("ioredis-mock");
  
  return {
    __esModule: true,
    default: new RedisMock(),
    getRedisClient: jest.fn(() => new RedisMock()),
  };
});

// Mock Personalization modules
jest.mock("@/lib/personalization/embeddings", () => ({
  __esModule: true,
  generateEmbedding: jest.fn().mockResolvedValue(new Array(768).fill(0.1)),
  generateEmbeddingsBatch: jest.fn().mockResolvedValue([new Array(768).fill(0.1)]),
  cosineSimilarity: jest.fn((a, b) => 0.5),
}));

jest.mock("@/lib/personalization/relationshipGraph", () => ({
  __esModule: true,
  extractAndUpdateRelationships: jest.fn(),
  getRelationships: jest.fn(),
  updateRelationshipStrength: jest.fn(),
}));

jest.mock("@/lib/personalization/featureExtractor", () => ({
  __esModule: true,
  extractChatFeatures: jest.fn().mockReturnValue({
    emotionalFeatures: {},
    linguisticFeatures: {},
    socialFeatures: {},
  }),
}));

jest.mock("@/lib/personalization/userModeling", () => ({
  __esModule: true,
  updateUserProfile: jest.fn(),
  getUserProfile: jest.fn(),
}));

jest.mock("@/lib/personalization/similaritySearch", () => ({
  __esModule: true,
  findSimilarAnalyses: jest.fn(),
  findSimilarUsers: jest.fn(),
}));

jest.mock("@/lib/personalization/adaptiveAdvice", () => ({
  __esModule: true,
  generateAdaptiveAdvice: jest.fn(),
}));

jest.mock("@/lib/personalization/feedbackLoop", () => ({
  __esModule: true,
  recordFeedback: jest.fn(),
  updateModelWeights: jest.fn(),
}));

jest.mock("@/lib/personalization/integration", () => ({
  __esModule: true,
  personalizeAnalysis: jest.fn(),
}));

// Mock environment variables
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
process.env.JWT_SECRET = process.env.JWT_SECRET || "test_jwt_secret_key_min_32_chars_long";
process.env.REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || "test_refresh_secret_key_min_32_chars";
process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || "test_gemini_key";
process.env.QUEUE_NAME = process.env.QUEUE_NAME || "test-queue";
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "sk_test_mock";
process.env.STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "whsec_test_mock";
process.env.FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:3000";
process.env.NEXT_PUBLIC_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

// Suppress console warnings in tests (unless debugging)
if (!process.env.DEBUG_TESTS) {
  global.console = {
    ...console,
    warn: jest.fn(),
    error: jest.fn(),
    log: jest.fn(),
  };
}

// Increase timeout for integration tests
jest.setTimeout(30000);
