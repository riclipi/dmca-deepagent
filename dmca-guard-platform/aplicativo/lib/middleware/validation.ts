// lib/middleware/validation.ts - Centralized validation middleware using Zod

import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError, ZodSchema } from 'zod'
import { ApiResponse } from '@/lib/api-response'

export interface ValidationConfig {
  body?: ZodSchema
  query?: ZodSchema
  params?: ZodSchema
}

/**
 * Sanitize string input to prevent XSS
 */
export function sanitizeString(str: string): string {
  return str
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .trim()
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeString(obj)
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item))
  }
  
  if (obj && typeof obj === 'object') {
    const sanitized: any = {}
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value)
    }
    return sanitized
  }
  
  return obj
}

/**
 * Validate request data against Zod schemas
 */
export async function validateRequest(
  request: NextRequest,
  config: ValidationConfig
): Promise<{
  success: boolean
  data?: {
    body?: any
    query?: any
    params?: any
  }
  error?: NextResponse
}> {
  try {
    const result: any = {}
    
    // Validate body
    if (config.body && request.method !== 'GET' && request.method !== 'HEAD') {
      try {
        const rawBody = await request.json()
        const sanitizedBody = sanitizeObject(rawBody)
        result.body = config.body.parse(sanitizedBody)
      } catch (error) {
        if (error instanceof ZodError) {
          return {
            success: false,
            error: ApiResponse.badRequest('Invalid request body', error.errors)
          }
        }
        return {
          success: false,
          error: ApiResponse.badRequest('Invalid JSON in request body')
        }
      }
    }
    
    // Validate query parameters
    if (config.query) {
      const { searchParams } = new URL(request.url)
      const query: Record<string, any> = {}
      
      searchParams.forEach((value, key) => {
        // Handle array parameters (e.g., ?tags=a&tags=b)
        if (query[key]) {
          if (Array.isArray(query[key])) {
            query[key].push(value)
          } else {
            query[key] = [query[key], value]
          }
        } else {
          query[key] = value
        }
      })
      
      try {
        const sanitizedQuery = sanitizeObject(query)
        result.query = config.query.parse(sanitizedQuery)
      } catch (error) {
        if (error instanceof ZodError) {
          return {
            success: false,
            error: ApiResponse.badRequest('Invalid query parameters', error.errors)
          }
        }
      }
    }
    
    // Validate route params (handled by Next.js route handler)
    if (config.params) {
      // Params are passed separately in Next.js 13+ route handlers
      // This is a placeholder for when params are available
      result.params = config.params.parse({})
    }
    
    return {
      success: true,
      data: result
    }
  } catch (error) {
    return {
      success: false,
      error: ApiResponse.error('Validation error')
    }
  }
}

/**
 * Common Zod schemas for reuse
 */
export const CommonSchemas = {
  // IDs
  id: z.string().cuid(),
  uuid: z.string().uuid(),
  
  // Strings
  email: z.string().email().toLowerCase(),
  url: z.string().url(),
  nonEmptyString: z.string().min(1).max(255),
  description: z.string().max(1000).optional(),
  
  // Numbers
  positiveInt: z.number().int().positive(),
  percentage: z.number().min(0).max(100),
  
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
  }),
  
  // Dates
  dateRange: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional()
  }),
  
  // File upload
  fileUpload: z.object({
    filename: z.string().max(255),
    mimetype: z.string().regex(/^[\w-]+\/[\w-]+$/),
    size: z.number().max(10 * 1024 * 1024) // 10MB max
  })
}

/**
 * Security-focused validators
 */
export const SecurityValidators = {
  // Prevent SQL injection in string fields
  safeString: z.string().regex(
    /^[a-zA-Z0-9\s\-_.@]+$/,
    'Only alphanumeric characters, spaces, hyphens, underscores, dots, and @ are allowed'
  ),
  
  // Safe filename
  safeFilename: z.string().regex(
    /^[a-zA-Z0-9\-_.]+$/,
    'Invalid filename format'
  ),
  
  // Prevent path traversal
  safePath: z.string().regex(
    /^[a-zA-Z0-9\-_./]+$/,
    'Invalid path format'
  ).refine(
    (path) => !path.includes('..'),
    'Path traversal detected'
  ),
  
  // Safe HTML content (basic)
  safeHtml: z.string().transform((str) => 
    str.replace(/<script[^>]*>.*?<\/script>/gi, '')
       .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
       .replace(/on\w+\s*=/gi, '')
  ),
  
  // Strong password
  strongPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number')
    .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')
}

/**
 * Rate limit validation
 */
export function createRateLimitedValidator(
  schema: ZodSchema,
  rateLimitKey: string,
  maxRequests: number = 10,
  windowMs: number = 60000
) {
  const requestCounts = new Map<string, { count: number; resetTime: number }>()
  
  return async (data: any, identifier: string) => {
    const now = Date.now()
    const key = `${rateLimitKey}:${identifier}`
    const record = requestCounts.get(key)
    
    if (record && now < record.resetTime) {
      if (record.count >= maxRequests) {
        throw new Error('Rate limit exceeded')
      }
      record.count++
    } else {
      requestCounts.set(key, {
        count: 1,
        resetTime: now + windowMs
      })
    }
    
    // Clean up old entries
    for (const [k, v] of requestCounts.entries()) {
      if (now > v.resetTime) {
        requestCounts.delete(k)
      }
    }
    
    return schema.parse(data)
  }
}

/**
 * Create a validated API route handler
 */
export function createValidatedHandler<T = any>(
  config: ValidationConfig,
  handler: (
    request: NextRequest,
    context: { params?: any; body?: T; query?: any }
  ) => Promise<NextResponse>
) {
  return async (request: NextRequest, props: any) => {
    // Validate request
    const validation = await validateRequest(request, config)
    
    if (!validation.success) {
      return validation.error!
    }
    
    // Call handler with validated data
    return handler(request, {
      params: props?.params,
      body: validation.data?.body,
      query: validation.data?.query
    })
  }
}

/**
 * Middleware to log validation failures (for security monitoring)
 */
export function logValidationFailure(
  endpoint: string,
  error: ZodError,
  request: NextRequest
) {
  console.warn('Validation failure:', {
    endpoint,
    timestamp: new Date().toISOString(),
    ip: request.headers.get('x-forwarded-for') || 'unknown',
    userAgent: request.headers.get('user-agent'),
    errors: error.errors,
    url: request.url
  })
}