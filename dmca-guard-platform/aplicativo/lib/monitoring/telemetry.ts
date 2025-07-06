import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { resourceFromAttributes, defaultResource } from '@opentelemetry/resources'
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from '@opentelemetry/semantic-conventions'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base'
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics'
import { diag, DiagConsoleLogger, DiagLogLevel } from '@opentelemetry/api'

// Enable OpenTelemetry logging for debugging (optional)
if (process.env.OTEL_DEBUG === 'true') {
  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG)
}

let sdk: NodeSDK | null = null

export function initializeTelemetry() {
  // Skip if already initialized or if telemetry is disabled
  if (sdk || process.env.DISABLE_TELEMETRY === 'true') {
    return
  }

  const serviceName = process.env.OTEL_SERVICE_NAME || 'dmca-guard-platform'
  const environment = process.env.NODE_ENV || 'development'
  
  // Create resource with service information
  const resource = resourceFromAttributes({
    [SEMRESATTRS_SERVICE_NAME]: serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: environment,
    'service.namespace': 'dmca-guard',
    'service.instance.id': process.env.DYNO || process.env.HOSTNAME || 'local',
  }).merge(defaultResource())

  // Configure trace exporter
  const traceExporter = new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces',
    headers: process.env.OTEL_EXPORTER_OTLP_HEADERS ? 
      JSON.parse(process.env.OTEL_EXPORTER_OTLP_HEADERS) : {},
  })

  // Create SDK with auto-instrumentation
  sdk = new NodeSDK({
    resource,
    instrumentations: [
      getNodeAutoInstrumentations({
        // Disable some instrumentations that might be too verbose
        '@opentelemetry/instrumentation-fs': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-dns': {
          enabled: false,
        },
        '@opentelemetry/instrumentation-net': {
          enabled: false,
        },
        // Configure HTTP instrumentation
        '@opentelemetry/instrumentation-http': {
          requestHook: (span, request) => {
            // Add custom attributes to HTTP spans
            if (typeof request === 'object' && 'url' in request) {
              span.setAttribute('http.full_url', request.url as string)
            }
          },
          // Ignore health check endpoints
          ignoreIncomingRequestHook: (request) => {
            const url = request.url
            return url?.includes('/api/health') || url?.includes('/_next') || false
          },
        },
        // Configure Express instrumentation
        '@opentelemetry/instrumentation-express': {
          requestHook: (span, info) => {
            if (info.request) {
              span.setAttribute('express.user_id', (info.request as any).user?.id || 'anonymous')
              span.setAttribute('express.session_id', (info.request as any).sessionID || 'none')
            }
          },
        },
      }),
    ],
    spanProcessor: new BatchSpanProcessor(traceExporter),
  })

  // Initialize the SDK
  sdk.start()
  
  console.log('🔭 OpenTelemetry initialized:', {
    serviceName,
    environment,
    endpoint: process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || 'http://localhost:4318/v1/traces'
  })

  // Graceful shutdown
  process.on('SIGTERM', () => {
    sdk?.shutdown()
      .then(() => console.log('OpenTelemetry terminated'))
      .catch((error) => console.error('Error terminating OpenTelemetry', error))
      .finally(() => process.exit(0))
  })
}

// Custom spans for business logic
import { trace, context, SpanStatusCode } from '@opentelemetry/api'

const tracer = trace.getTracer('dmca-guard-platform')

export function createSpan(name: string, fn: () => Promise<any>) {
  return tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await fn()
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      })
      span.recordException(error as Error)
      throw error
    } finally {
      span.end()
    }
  })
}

// Helper to add custom attributes to current span
export function addSpanAttributes(attributes: Record<string, any>) {
  const span = trace.getActiveSpan()
  if (span) {
    Object.entries(attributes).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        span.setAttribute(key, value)
      }
    })
  }
}

// Helper to add events to current span
export function addSpanEvent(name: string, attributes?: Record<string, any>) {
  const span = trace.getActiveSpan()
  if (span) {
    span.addEvent(name, attributes)
  }
}

// Metrics helpers
import { metrics } from '@opentelemetry/api'

const meter = metrics.getMeter('dmca-guard-platform')

// Create counters for key metrics
export const scanCounter = meter.createCounter('dmca.scans.total', {
  description: 'Total number of scans initiated',
})

export const violationCounter = meter.createCounter('dmca.violations.total', {
  description: 'Total number of violations detected',
})

export const takedownCounter = meter.createCounter('dmca.takedowns.total', {
  description: 'Total number of takedown requests sent',
})

export const queueSizeGauge = meter.createObservableGauge('dmca.queue.size', {
  description: 'Current size of the scan queue',
})

export const scanDurationHistogram = meter.createHistogram('dmca.scan.duration', {
  description: 'Duration of scan operations in milliseconds',
  unit: 'ms',
})

export const cacheHitRateGauge = meter.createObservableGauge('dmca.cache.hit_rate', {
  description: 'Cache hit rate percentage',
  unit: '%',
})

// Initialize telemetry if running in server context
if (typeof window === 'undefined') {
  initializeTelemetry()
}