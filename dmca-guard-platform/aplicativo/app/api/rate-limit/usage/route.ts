import { NextRequest } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ApiResponse } from '@/lib/api-response'
import { redis } from '@/lib/redis'

interface RateLimitUsage {
  endpoint: string
  limit: number
  used: number
  remaining: number
  resetAt: Date
  resetIn: number // seconds
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user) {
      return ApiResponse.unauthorized()
    }

    const userId = session.user.id
    const now = Date.now()

    // Get rate limit keys for user
    const pattern = `rate_limit:${userId}:*`
    const keys = await redis.keys(pattern)

    if (keys.length === 0) {
      return ApiResponse.success({
        usage: [],
        globalUsage: {
          limit: getRateLimitForPlan(session.user.planType),
          used: 0,
          remaining: getRateLimitForPlan(session.user.planType),
          resetAt: new Date(now + 3600000), // 1 hour from now
          resetIn: 3600
        }
      })
    }

    // Get usage for each endpoint
    const usage: RateLimitUsage[] = []
    
    for (const key of keys) {
      const parts = key.split(':')
      const endpoint = parts.slice(3).join(':') || 'global'
      
      // Get current count
      const count = await redis.get(key)
      const used = count && typeof count === 'string' ? parseInt(count) : 0
      
      // Get TTL for reset time
      const ttl = await redis.ttl(key)
      const resetAt = ttl > 0 ? new Date(now + ttl * 1000) : new Date(now + 3600000)
      
      const limit = getRateLimitForEndpoint(endpoint, session.user.planType)
      
      usage.push({
        endpoint,
        limit,
        used,
        remaining: Math.max(0, limit - used),
        resetAt,
        resetIn: ttl > 0 ? ttl : 3600
      })
    }

    // Calculate global usage (sum of all endpoints)
    const globalLimit = getRateLimitForPlan(session.user.planType)
    const globalUsed = usage.reduce((sum, item) => sum + item.used, 0)
    
    return ApiResponse.success({
      usage: usage.sort((a, b) => b.used - a.used), // Sort by most used
      globalUsage: {
        limit: globalLimit,
        used: globalUsed,
        remaining: Math.max(0, globalLimit - globalUsed),
        resetAt: usage[0]?.resetAt || new Date(now + 3600000),
        resetIn: usage[0]?.resetIn || 3600
      }
    })
  } catch (error) {
    console.error('Error fetching rate limit usage:', error)
    return ApiResponse.serverError(
      error instanceof Error ? error : new Error('Failed to fetch rate limit usage'),
      process.env.NODE_ENV === 'development'
    )
  }
}

function getRateLimitForPlan(planType: string): number {
  const limits: Record<string, number> = {
    FREE: 100,
    PROFESSIONAL: 1000,
    BUSINESS: 5000,
    ENTERPRISE: 10000,
    SUPER_USER: 50000
  }
  
  return limits[planType] || 100
}

function getRateLimitForEndpoint(endpoint: string, planType: string): number {
  // Different endpoints can have different limits
  const endpointMultipliers: Record<string, number> = {
    'takedown': 0.1, // 10% of global limit
    'scan': 0.2, // 20% of global limit
    'agent': 0.15, // 15% of global limit
    'webhook': 0.05, // 5% of global limit
    'global': 1 // 100% of global limit
  }
  
  const baseLimit = getRateLimitForPlan(planType)
  const multiplier = endpointMultipliers[endpoint] || 1
  
  return Math.floor(baseLimit * multiplier)
}