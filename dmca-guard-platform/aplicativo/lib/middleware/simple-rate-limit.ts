// Simple rate limiter that works with MockRedis
import { redis } from '@/lib/redis'

interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: Date
}

export async function simpleRateLimit(
  identifier: string,
  limit: number = 100,
  window: number = 3600 // seconds
): Promise<RateLimitResult> {
  const key = `rate_limit:${identifier}`
  const now = Date.now()
  
  try {
    // Try to increment the counter
    const count = await redis.incr(key)
    
    // Set TTL on first request
    if (count === 1) {
      await redis.expire(key, window)
    }
    
    // Get TTL for reset time
    const ttl = await redis.ttl(key)
    const resetAt = new Date(now + (ttl > 0 ? ttl * 1000 : window * 1000))
    
    const success = count <= limit
    const remaining = Math.max(0, limit - count)
    
    return {
      success,
      limit,
      remaining,
      reset: resetAt
    }
  } catch (error) {
    console.error('Rate limit error:', error)
    // On error, allow the request
    return {
      success: true,
      limit,
      remaining: limit,
      reset: new Date(now + window * 1000)
    }
  }
}

export function getRateLimitHeaders(result: RateLimitResult): Headers {
  const headers = new Headers()
  headers.set('X-RateLimit-Limit', result.limit.toString())
  headers.set('X-RateLimit-Remaining', result.remaining.toString())
  headers.set('X-RateLimit-Reset', result.reset.toISOString())
  
  if (!result.success) {
    headers.set('Retry-After', Math.ceil((result.reset.getTime() - Date.now()) / 1000).toString())
  }
  
  return headers
}