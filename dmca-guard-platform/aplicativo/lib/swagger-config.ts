import swaggerJSDoc from 'swagger-jsdoc'

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'DMCA Guard Platform API',
      version: '1.0.0',
      description: 'API documentation for DMCA Guard Platform - A comprehensive DMCA protection and content monitoring system',
      contact: {
        name: 'DMCA Guard Team',
        email: 'support@dmcaguard.com'
      }
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' ? 'https://dmcaguard.com' : 'http://localhost:3000',
        description: process.env.NODE_ENV === 'production' ? 'Production server' : 'Development server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        },
        sessionAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'next-auth.session-token'
        }
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Unique user identifier' },
            email: { type: 'string', format: 'email' },
            name: { type: 'string' },
            status: { 
              type: 'string', 
              enum: ['ACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION', 'DELETED'] 
            },
            planType: { 
              type: 'string', 
              enum: ['FREE', 'BASIC', 'PREMIUM', 'ENTERPRISE', 'SUPER_USER'] 
            },
            planExpiresAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        Plan: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            displayName: { type: 'string' },
            description: { type: 'string', nullable: true },
            price: { type: 'number', format: 'decimal' },
            currency: { type: 'string', default: 'BRL' },
            interval: { type: 'string', default: 'monthly' },
            features: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'List of plan features'
            },
            limits: {
              type: 'object',
              properties: {
                profiles: { type: 'number' },
                takedowns: { type: 'number' },
                scansPerDay: { type: 'number' },
                keywords: { type: 'number' }
              }
            },
            isActive: { type: 'boolean', default: true },
            isPopular: { type: 'boolean', default: false },
            sortOrder: { type: 'number', default: 0 }
          }
        },
        Subscription: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            planId: { type: 'string' },
            status: { 
              type: 'string', 
              enum: ['ACTIVE', 'CANCELLED', 'EXPIRED', 'TRIAL', 'PAST_DUE', 'SUSPENDED'] 
            },
            startDate: { type: 'string', format: 'date-time' },
            endDate: { type: 'string', format: 'date-time', nullable: true },
            amount: { type: 'number', format: 'decimal' },
            currency: { type: 'string', default: 'BRL' },
            paymentMethod: { type: 'string', nullable: true },
            cancelReason: { type: 'string', nullable: true },
            cancelledAt: { type: 'string', format: 'date-time', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' }
          }
        },
        DetectedContent: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            userId: { type: 'string' },
            brandProfileId: { type: 'string' },
            url: { type: 'string', format: 'uri' },
            title: { type: 'string', nullable: true },
            description: { type: 'string', nullable: true },
            similarity: { type: 'number', format: 'float' },
            platform: { type: 'string' },
            status: { 
              type: 'string', 
              enum: ['PENDING', 'APPROVED', 'IGNORED', 'TAKEDOWN_SENT'] 
            },
            notes: { type: 'string', nullable: true },
            detectedAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' }
          }
        },
        AnalyticsSummary: {
          type: 'object',
          properties: {
            totalUsers: { type: 'number' },
            activeUsers: { type: 'number' },
            totalSubscriptions: { type: 'number' },
            totalRevenue: { type: 'number', format: 'decimal' },
            recentSignups: { type: 'number' },
            totalDetectedContent: { type: 'number' },
            totalTakedownRequests: { type: 'number' },
            successfulTakedowns: { type: 'number' },
            successRate: { type: 'number' },
            coverage: { type: 'number' },
            effectiveness: { type: 'number' }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            details: { 
              type: 'array', 
              items: { type: 'object' },
              nullable: true 
            }
          }
        },
        PaginatedResponse: {
          type: 'object',
          properties: {
            data: { 
              type: 'array', 
              items: { type: 'object' } 
            },
            pagination: {
              type: 'object',
              properties: {
                page: { type: 'number' },
                limit: { type: 'number' },
                total: { type: 'number' },
                pages: { type: 'number' }
              }
            }
          }
        }
      }
    },
    security: [
      { sessionAuth: [] }
    ]
  },
  apis: [
    './app/api/**/*.ts', 
    './app/api/**/*.js'
  ]
}

export const swaggerSpec = swaggerJSDoc(options)