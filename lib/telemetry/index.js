/**
 * OpenTelemetry Setup
 * Distributed tracing and observability
 */

import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { log } from "../logger";

let sdk = null;

/**
 * Initialize OpenTelemetry SDK
 */
export function initTelemetry() {
  // Skip if already initialized or if endpoint not configured
  if (sdk || !process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return;
  }

  try {
    const traceExporter = new OTLPTraceExporter({
      url: `${process.env.OTEL_EXPORTER_OTLP_ENDPOINT}/v1/traces`,
      headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
        ? JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS)
        : {},
    });

    sdk = new NodeSDK({
      resource: new Resource({
        [SemanticResourceAttributes.SERVICE_NAME]: "chatvibe-api",
        [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version || "1.0.0",
        [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || "development",
      }),
      traceExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Disable fs instrumentation to reduce noise
          "@opentelemetry/instrumentation-fs": {
            enabled: false,
          },
        }),
      ],
      // Sample rate: 10% in production, 100% in development
      sampler: {
        sampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
      },
    });

    sdk.start();
    log.info("OpenTelemetry initialized", {
      endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    });
  } catch (error) {
    log.error("Failed to initialize OpenTelemetry", error);
  }
}

/**
 * Shutdown OpenTelemetry SDK
 */
export async function shutdownTelemetry() {
  if (sdk) {
    try {
      await sdk.shutdown();
      log.info("OpenTelemetry shutdown complete");
    } catch (error) {
      log.error("Error shutting down OpenTelemetry", error);
    }
  }
}

// Auto-initialize if in Node.js environment
if (typeof window === "undefined" && process.env.OTEL_EXPORTER_OTLP_ENDPOINT) {
  initTelemetry();
}

export { sdk };

