/**
 * Production-Grade Structured Logging
 * JSON logs with correlation IDs, OpenTelemetry integration, and Sentry
 */

import winston from "winston";
import * as Sentry from "@sentry/node";
import { context, trace } from "@opentelemetry/api";

const { combine, timestamp, json, errors, printf } = winston.format;

// Generate correlation ID
function generateCorrelationId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Get current trace context
function getTraceContext() {
  const activeSpan = trace.getActiveSpan();
  if (!activeSpan) {
    return {};
  }

  const spanContext = activeSpan.spanContext();
  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceFlags: spanContext.traceFlags,
  };
}

// Custom format for structured logging
const structuredFormat = combine(
  timestamp(),
  errors({ stack: true }),
  json(),
  printf((info) => {
    const traceCtx = getTraceContext();
    const correlationId = context.active().getValue(Symbol.for("correlationId")) || generateCorrelationId();

    const logEntry = {
      timestamp: info.timestamp,
      level: info.level,
      message: info.message,
      correlationId,
      ...traceCtx,
      ...(info.error && {
        error: {
          name: info.error.name,
          message: info.error.message,
          stack: info.error.stack,
        },
      }),
      ...(info.metadata && { metadata: info.metadata }),
    };

    // Send errors to Sentry
    if (info.level === "error" && info.error) {
      Sentry.captureException(info.error, {
        extra: {
          correlationId,
          ...info.metadata,
        },
        tags: {
          level: info.level,
        },
      });
    }

    return JSON.stringify(logEntry);
  })
);

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === "production" ? "info" : "debug"),
  format: structuredFormat,
  defaultMeta: {
    service: "chatvibe-api",
    environment: process.env.NODE_ENV || "development",
  },
  transports: [
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
});

// Helper to create child logger with correlation ID
export function createLogger(correlationId, metadata = {}) {
  return {
    error: (message, error, meta = {}) => logger.error(message, { error, metadata: { ...metadata, ...meta }, correlationId }),
    warn: (message, meta = {}) => logger.warn(message, { metadata: { ...metadata, ...meta }, correlationId }),
    info: (message, meta = {}) => logger.info(message, { metadata: { ...metadata, ...meta }, correlationId }),
    debug: (message, meta = {}) => logger.debug(message, { metadata: { ...metadata, ...meta }, correlationId }),
  };
}

// Audit logging for compliance and security events
export const auditLog = {
  userAction: (userId, action, metadata = {}) => {
    logger.info(`USER_ACTION: ${action}`, {
      metadata: {
        userId,
        actionType: "user_action",
        ...metadata,
      },
    });
  },
  
  securityEvent: (eventType, metadata = {}) => {
    logger.warn(`SECURITY_EVENT: ${eventType}`, {
      metadata: {
        eventType: "security",
        ...metadata,
      },
    });
  },
  
  apiAccess: (userId, endpoint, method, statusCode, metadata = {}) => {
    logger.info(`API_ACCESS: ${method} ${endpoint}`, {
      metadata: {
        userId,
        actionType: "api_access",
        endpoint,
        method,
        statusCode,
        ...metadata,
      },
    });
  },
  
  dataProcessing: (userId, operation, dataType, metadata = {}) => {
    logger.info(`DATA_PROCESSING: ${operation}`, {
      metadata: {
        userId,
        actionType: "data_processing",
        operation,
        dataType,
        ...metadata,
      },
    });
  },
  
  piiDetected: (userId, piiTypes, metadata = {}) => {
    logger.warn(`PII_DETECTED: ${piiTypes.join(", ")}`, {
      metadata: {
        userId,
        actionType: "pii_detection",
        piiTypes,
        ...metadata,
      },
    });
  },
};

// Logging helpers
export const log = {
  error: (message, error, metadata = {}) => {
    logger.error(message, { error, metadata });
  },
  warn: (message, metadata = {}) => {
    logger.warn(message, { metadata });
  },
  info: (message, metadata = {}) => {
    logger.info(message, { metadata });
  },
  debug: (message, metadata = {}) => {
    logger.debug(message, { metadata });
  },
};

// Get correlation ID from request (for Next.js App Router)
export function getCorrelationId(request) {
  if (!request) return generateCorrelationId();
  
  // Try to get from headers
  const headerId = request.headers?.get?.("x-correlation-id");
  if (headerId) return headerId;
  
  // Try to get from request object
  if (request.correlationId) return request.correlationId;
  
  // Generate new one
  const correlationId = generateCorrelationId();
  
  // Set in OpenTelemetry context
  context.active().setValue(Symbol.for("correlationId"), correlationId);
  
  return correlationId;
}

// Middleware to add correlation ID to context
export function withCorrelationId(req, res, next) {
  const correlationId = req.headers["x-correlation-id"] || generateCorrelationId();
  
  // Set in OpenTelemetry context
  context.active().setValue(Symbol.for("correlationId"), correlationId);
  
  // Add to response headers
  res.setHeader("X-Correlation-ID", correlationId);
  
  // Add to request for easy access
  req.correlationId = correlationId;
  
  if (next) next();
  return correlationId;
}

export default logger;

