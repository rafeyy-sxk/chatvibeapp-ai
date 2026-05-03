const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

/** @type {import('jest').Config} */
const customJestConfig = {
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.[jt]s?(x)"],
  setupFiles: ["dotenv/config"],
  setupFilesAfterEnv: ["<rootDir>/__tests__/setup.js"],
  moduleFileExtensions: ["js", "jsx", "json"],
  collectCoverageFrom: [
    "app/**/*.{js,jsx}",
    "lib/**/*.{js,jsx}",
    "middleware/**/*.{js,jsx}",
    "server/**/*.{js,jsx}",
    "!**/*.d.ts",
    "!**/node_modules/**",
    "!**/.next/**",
    "!**/coverage/**",
    "!**/__tests__/**",
  ],
  coverageThreshold: {
    global: {
      branches: 90,
      functions: 92,
      lines: 92,
      statements: 92,
    },
    // Higher thresholds for critical systems
    "./lib/queue/": {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    "./server/workers/": {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    "./app/api/analyze/": {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    "./app/api/billing/webhook/": {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    "./lib/auth/": {
      branches: 95,
      functions: 95,
      lines: 95,
      statements: 95,
    },
  },
  coverageReporters: ["text", "lcov", "html", "json"],
  coverageDirectory: "coverage",
  testTimeout: 30000,
  // Module name mapping
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  // Transform ignore patterns
  transformIgnorePatterns: [
    "node_modules/(?!(ioredis-mock)/)",
  ],
};

module.exports = createJestConfig(customJestConfig);

