/**
 * Logger Tests
 */

import { logger, log, createLogger, getCorrelationId } from "../lib/logger";
import { withCorrelationId } from "../lib/logger";

describe("Logger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("log object", () => {
    it("should log error", () => {
      const spy = jest.spyOn(logger, "error");
      log.error("Test error", new Error("Test"), { context: "test" });
      expect(spy).toHaveBeenCalled();
    });

    it("should log warn", () => {
      const spy = jest.spyOn(logger, "warn");
      log.warn("Test warning", { context: "test" });
      expect(spy).toHaveBeenCalled();
    });

    it("should log info", () => {
      const spy = jest.spyOn(logger, "info");
      log.info("Test info", { context: "test" });
      expect(spy).toHaveBeenCalled();
    });

    it("should log debug", () => {
      const spy = jest.spyOn(logger, "debug");
      log.debug("Test debug", { context: "test" });
      expect(spy).toHaveBeenCalled();
    });
  });

  describe("createLogger", () => {
    it("should create logger with correlation ID", () => {
      const childLogger = createLogger("corr123", { userId: "user123" });
      expect(childLogger).toHaveProperty("error");
      expect(childLogger).toHaveProperty("warn");
      expect(childLogger).toHaveProperty("info");
      expect(childLogger).toHaveProperty("debug");
    });

    it("should log with correlation ID", () => {
      const spy = jest.spyOn(logger, "info");
      const childLogger = createLogger("corr123");
      childLogger.info("Test message", { extra: "data" });
      expect(spy).toHaveBeenCalled();
    });
  });

  describe("getCorrelationId", () => {
    it("should generate new correlation ID if none provided", () => {
      const id = getCorrelationId(null);
      expect(id).toBeDefined();
      expect(typeof id).toBe("string");
    });

    it("should return correlation ID from request headers", () => {
      const request = {
        headers: {
          get: jest.fn((key) => (key === "x-correlation-id" ? "header-id" : null)),
        },
      };

      const id = getCorrelationId(request);
      expect(id).toBe("header-id");
    });

    it("should return correlation ID from request object", () => {
      const request = {
        correlationId: "request-id",
      };

      const id = getCorrelationId(request);
      expect(id).toBe("request-id");
    });
  });

  describe("withCorrelationId", () => {
    it("should add correlation ID to request and response", () => {
      const req = {
        headers: {},
      };
      const res = {
        setHeader: jest.fn(),
      };
      const next = jest.fn();

      const id = withCorrelationId(req, res, next);
      expect(id).toBeDefined();
      expect(res.setHeader).toHaveBeenCalledWith("X-Correlation-ID", id);
      expect(next).toHaveBeenCalled();
    });
  });
});



























