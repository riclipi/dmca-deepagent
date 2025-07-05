import { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'
import { z } from 'zod'

// Create registry
export const registry = new OpenAPIRegistry()

// Common schemas
const ErrorResponseSchema = z.object({
  success: z.literal(false),
  message: z.string(),
  errors: z.array(z.string()).optional(),
  meta: z.record(z.any()).optional()
})

const SuccessResponseSchema = z.object({
  success: z.literal(true),
  data: z.any(),
  meta: z.record(z.any()).optional()
})

const PaginatedResponseSchema = z.object({
  success: z.literal(true),
  data: z.any(),
  meta: z.object({
    page: z.number(),
    limit: z.number(),
    total: z.number(),
    totalPages: z.number()
  })
})

// Register common schemas
registry.register('ErrorResponse', ErrorResponseSchema)
registry.register('SuccessResponse', SuccessResponseSchema)
registry.register('PaginatedResponse', PaginatedResponseSchema)

// Health Check
const HealthStatusSchema = z.object({
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  timestamp: z.string(),
  uptime: z.number(),
  services: z.object({
    database: z.object({
      status: z.enum(['up', 'down', 'degraded']),
      responseTime: z.number().optional(),
      error: z.string().optional()
    }),
    redis: z.object({
      status: z.enum(['up', 'down', 'degraded']),
      responseTime: z.number().optional(),
      error: z.string().optional()
    }),
    websocket: z.object({
      status: z.enum(['up', 'down', 'degraded']),
      details: z.any().optional()
    }),
    queue: z.object({
      status: z.enum(['up', 'down', 'degraded']),
      details: z.any().optional()
    }),
    cache: z.object({
      status: z.enum(['up', 'down', 'degraded']),
      responseTime: z.number().optional()
    })
  }),
  system: z.object({
    memory: z.object({
      used: z.number(),
      total: z.number(),
      percentage: z.number()
    }),
    nodejs: z.object({
      version: z.string(),
      heap: z.object({
        used: z.number(),
        total: z.number(),
        percentage: z.number()
      })
    })
  })
})

registry.register('HealthStatus', HealthStatusSchema)

registry.registerPath({
  method: 'get',
  path: '/api/health',
  description: 'Check the health status of all services',
  summary: 'Health Check',
  tags: ['System'],
  responses: {
    200: {
      description: 'Health status retrieved successfully',
      content: {
        'application/json': {
          schema: SuccessResponseSchema.extend({
            data: HealthStatusSchema
          })
        }
      }
    },
    503: {
      description: 'Service unhealthy',
      content: {
        'application/json': {
          schema: SuccessResponseSchema.extend({
            data: HealthStatusSchema
          })
        }
      }
    }
  }
})

// Queue Status
const QueueStatusSchema = z.object({
  userId: z.string(),
  activeScans: z.number(),
  queuedScans: z.number(),
  position: z.number().nullable(),
  estimatedWaitTime: z.number().nullable(),
  userPlan: z.enum(['FREE', 'BASIC', 'PREMIUM', 'ENTERPRISE', 'SUPER_USER']),
  planLimits: z.object({
    maxConcurrent: z.number(),
    priority: z.number()
  })
})

registry.register('QueueStatus', QueueStatusSchema)

registry.registerPath({
  method: 'get',
  path: '/api/queue/status',
  description: 'Get the current queue status for the authenticated user',
  summary: 'Get Queue Status',
  tags: ['Queue'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Queue status retrieved successfully',
      content: {
        'application/json': {
          schema: SuccessResponseSchema.extend({
            data: QueueStatusSchema
          })
        }
      }
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
})

// Brand Profiles
const BrandProfileSchema = z.object({
  id: z.string(),
  userId: z.string(),
  brandName: z.string(),
  description: z.string().nullable(),
  officialUrls: z.array(z.string()),
  socialMedia: z.any().nullable(),
  keywords: z.array(z.string()),
  safeKeywords: z.array(z.string()),
  moderateKeywords: z.array(z.string()),
  dangerousKeywords: z.array(z.string()),
  isActive: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string()
})

const CreateBrandProfileSchema = z.object({
  brandName: z.string().min(1).max(100),
  description: z.string().optional(),
  officialUrls: z.array(z.string().url()),
  socialMedia: z.record(z.string()).optional(),
  keywords: z.array(z.string()).optional()
})

registry.register('BrandProfile', BrandProfileSchema)
registry.register('CreateBrandProfile', CreateBrandProfileSchema)

registry.registerPath({
  method: 'post',
  path: '/api/brand-profiles',
  description: 'Create a new brand profile',
  summary: 'Create Brand Profile',
  tags: ['Brand Profiles'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateBrandProfileSchema
        }
      }
    }
  },
  responses: {
    201: {
      description: 'Brand profile created successfully',
      content: {
        'application/json': {
          schema: SuccessResponseSchema.extend({
            data: BrandProfileSchema
          })
        }
      }
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
})

// Monitoring Sessions
const MonitoringSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  brandProfileId: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  targetPlatforms: z.array(z.string()),
  useProfileKeywords: z.boolean(),
  customKeywords: z.array(z.string()),
  excludeKeywords: z.array(z.string()),
  status: z.enum(['IDLE', 'RUNNING', 'PAUSED', 'COMPLETED', 'ERROR']),
  currentKeyword: z.string().nullable(),
  progress: z.number(),
  totalKeywords: z.number(),
  processedKeywords: z.number(),
  resultsFound: z.number(),
  isActive: z.boolean(),
  lastScanAt: z.string().nullable(),
  nextScanAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string()
})

registry.register('MonitoringSession', MonitoringSessionSchema)

// Known Sites Scan
const ScanRequestSchema = z.object({
  brandProfileId: z.string(),
  siteIds: z.array(z.string()).optional(),
  keywords: z.array(z.string()).optional()
})

registry.registerPath({
  method: 'post',
  path: '/api/agents/known-sites/scan',
  description: 'Start a scan of known sites for violations',
  summary: 'Scan Known Sites',
  tags: ['Agents'],
  security: [{ bearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: ScanRequestSchema
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Scan initiated successfully',
      content: {
        'application/json': {
          schema: SuccessResponseSchema.extend({
            data: z.object({
              sessionId: z.string(),
              status: z.enum(['PROCESSING', 'QUEUED']),
              queueId: z.string().optional(),
              position: z.number().optional(),
              estimatedStartTime: z.string().optional()
            })
          })
        }
      }
    },
    400: {
      description: 'Bad request',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    429: {
      description: 'Rate limit exceeded',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
})

// Cron Jobs
registry.registerPath({
  method: 'get',
  path: '/api/cron/abuse-monitoring',
  description: 'Run the abuse monitoring job',
  summary: 'Abuse Monitoring Cron',
  tags: ['Cron Jobs'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Job completed successfully',
      content: {
        'application/json': {
          schema: SuccessResponseSchema
        }
      }
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Job failed',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
})

registry.registerPath({
  method: 'get',
  path: '/api/cron/cache-cleanup',
  description: 'Run the cache cleanup job',
  summary: 'Cache Cleanup Cron',
  tags: ['Cron Jobs'],
  security: [{ bearerAuth: [] }],
  responses: {
    200: {
      description: 'Job completed successfully',
      content: {
        'application/json': {
          schema: SuccessResponseSchema.extend({
            data: z.object({
              message: z.string(),
              startedAt: z.string(),
              completedAt: z.string(),
              stats: z.object({
                totalScanned: z.number(),
                totalDeleted: z.number(),
                errors: z.number(),
                duration: z.number()
              })
            })
          })
        }
      }
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    },
    500: {
      description: 'Job failed',
      content: {
        'application/json': {
          schema: ErrorResponseSchema
        }
      }
    }
  }
})

// Generate OpenAPI document
import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi'

const generator = new OpenApiGeneratorV3(registry.definitions)

export const openApiDocument = generator.generateDocument({
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'DMCA Guard Platform API',
    description: 'API documentation for DMCA Guard Platform - A comprehensive copyright protection system',
    contact: {
      name: 'DMCA Guard Support',
      email: 'support@dmcaguard.com'
    }
  },
  servers: [
    {
      url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      description: 'Current environment'
    }
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      }
    }
  },
  tags: [
    {
      name: 'System',
      description: 'System health and status endpoints'
    },
    {
      name: 'Queue',
      description: 'Fair queue management endpoints'
    },
    {
      name: 'Brand Profiles',
      description: 'Brand profile management'
    },
    {
      name: 'Monitoring Sessions',
      description: 'Monitoring session management'
    },
    {
      name: 'Agents',
      description: 'AI agent operations'
    },
    {
      name: 'Cron Jobs',
      description: 'Scheduled job endpoints'
    }
  ]
})