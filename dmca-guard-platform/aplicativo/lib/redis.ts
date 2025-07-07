// Redis client for rate limiting
import { Redis } from '@upstash/redis'
import { redisMonitor } from './monitoring/redis-metrics'

// Mock Redis for local development without Redis connection
class MockRedis {
  private store: Map<string, { value: string; ttl?: number; createdAt: number }> = new Map()

  async get(key: string): Promise<string | null> {
    try {
      redisMonitor.incrementOperation('get')
      const item = this.store.get(key)
      
      if (!item) return null
      
      // Check if TTL expired
      if (item.ttl && Date.now() - item.createdAt > item.ttl * 1000) {
        this.store.delete(key)
        return null
      }
      
      return item.value
    } catch (error) {
      redisMonitor.recordError(error as Error)
      throw error
    }
  }

  async set(key: string, value: string | number, ttl?: number): Promise<'OK'> {
    try {
      redisMonitor.incrementOperation('set')
      this.store.set(key, {
        value: String(value),
        ttl,
        createdAt: Date.now()
      })
      return 'OK'
    } catch (error) {
      redisMonitor.recordError(error as Error)
      throw error
    }
  }

  async incr(key: string): Promise<number> {
    try {
      redisMonitor.incrementOperation('incr')
      const current = await this.get(key)
      const newValue = current ? parseInt(current) + 1 : 1
      await this.set(key, newValue)
      return newValue
    } catch (error) {
      redisMonitor.recordError(error as Error)
      throw error
    }
  }

  async expire(key: string, seconds: number): Promise<number> {
    const item = this.store.get(key)
    if (!item) return 0
    
    item.ttl = seconds
    item.createdAt = Date.now()
    return 1
  }

  async ttl(key: string): Promise<number> {
    const item = this.store.get(key)
    
    if (!item || !item.ttl) return -1
    
    const elapsed = Math.floor((Date.now() - item.createdAt) / 1000)
    const remaining = item.ttl - elapsed
    
    if (remaining <= 0) {
      this.store.delete(key)
      return -2
    }
    
    return remaining
  }

  async keys(pattern: string): Promise<string[]> {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    const matchingKeys: string[] = []
    
    for (const [key, item] of this.store.entries()) {
      // Check TTL
      if (item.ttl && Date.now() - item.createdAt > item.ttl * 1000) {
        this.store.delete(key)
        continue
      }
      
      if (regex.test(key)) {
        matchingKeys.push(key)
      }
    }
    
    return matchingKeys
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0
    for (const key of keys) {
      if (this.store.delete(key)) {
        deleted++
      }
    }
    return deleted
  }

  async flushall(): Promise<'OK'> {
    this.store.clear()
    return 'OK'
  }

  // Additional methods required by Upstash Ratelimit
  async eval(script: string, keys: string[], args: string[]): Promise<any> {
    // Enhanced mock for eval - simulate sliding window logic
    if (script.includes('sliding window') || script.includes('rate limit')) {
      const key = keys[0]
      const limit = parseInt(args[0])
      const window = parseInt(args[1])
      const now = Date.now()
      
      // Get current count
      const count = await this.get(`${key}:count`) || '0'
      const windowStart = await this.get(`${key}:window`)
      
      if (!windowStart || now - parseInt(windowStart) > window * 1000) {
        // New window
        await this.set(`${key}:count`, '1', window)
        await this.set(`${key}:window`, now.toString(), window)
        return [1, limit - 1, now + window * 1000]
      }
      
      const newCount = parseInt(count) + 1
      if (newCount > limit) {
        return [0, 0, parseInt(windowStart) + window * 1000]
      }
      
      await this.set(`${key}:count`, newCount.toString())
      return [1, limit - newCount, parseInt(windowStart) + window * 1000]
    }
    
    return null
  }

  async evalsha(sha: string, keys: string[], args: string[]): Promise<any> {
    // Delegate to eval for mock
    return this.eval('sliding window rate limit', keys, args)
  }

  async script(...args: any[]): Promise<any> {
    // Enhanced mock for script commands
    if (args[0] === 'load') {
      return 'mock-script-sha'
    }
    if (args[0] === 'exists') {
      return [1] // Always return script exists
    }
    return null
  }

  async pipeline(): Promise<any> {
    // Return a simple pipeline mock
    const commands: any[] = []
    return {
      incr: (key: string) => {
        commands.push({ cmd: 'incr', key })
        return this
      },
      expire: (key: string, seconds: number) => {
        commands.push({ cmd: 'expire', key, seconds })
        return this
      },
      exec: async () => {
        const results = []
        for (const cmd of commands) {
          if (cmd.cmd === 'incr') {
            results.push(await this.incr(cmd.key))
          } else if (cmd.cmd === 'expire') {
            results.push(await this.expire(cmd.key, cmd.seconds))
          }
        }
        return results
      }
    }
  }

  // Sorted set operations for analytics
  private sortedSets: Map<string, Map<string, number>> = new Map()

  async zincrby(key: string, increment: number, member: string): Promise<number> {
    if (!this.sortedSets.has(key)) {
      this.sortedSets.set(key, new Map())
    }
    
    const sortedSet = this.sortedSets.get(key)!
    const currentScore = sortedSet.get(member) || 0
    const newScore = currentScore + increment
    sortedSet.set(member, newScore)
    
    return newScore
  }

  async zrange(key: string, start: number, stop: number, options?: { withScores?: boolean }): Promise<any[]> {
    const sortedSet = this.sortedSets.get(key)
    if (!sortedSet) return []
    
    // Convert to array and sort by score
    const entries = Array.from(sortedSet.entries())
      .sort((a, b) => a[1] - b[1])
      .slice(start, stop + 1)
    
    if (options?.withScores) {
      return entries.flat()
    }
    
    return entries.map(([member]) => member)
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    if (!this.sortedSets.has(key)) {
      this.sortedSets.set(key, new Map())
    }
    
    const sortedSet = this.sortedSets.get(key)!
    const existed = sortedSet.has(member)
    sortedSet.set(member, score)
    
    return existed ? 0 : 1
  }
}

// Create Redis instance based on environment
function createRedisClient() {
  const hasRedisCredentials = process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
  
  // Always use Upstash Redis if credentials are available
  if (hasRedisCredentials) {
    console.log('✅ Using Upstash Redis for rate limiting')
    redisMonitor.setType('upstash')
    
    // Create Upstash client with monitoring wrapper
    const upstashClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    
    // Wrap Upstash methods with monitoring
    return new Proxy(upstashClient, {
      get(target, prop) {
        const original = target[prop as keyof typeof target]
        if (typeof original === 'function') {
          return async (...args: any[]) => {
            try {
              // Track operation if it's a monitored method
              const monitoredOps = ['get', 'set', 'incr', 'expire', 'ttl', 'keys', 'del', 'flushall']
              if (monitoredOps.includes(prop as string)) {
                redisMonitor.incrementOperation(prop as any)
              }
              return await (original as Function).apply(target, args)
            } catch (error) {
              redisMonitor.recordError(error as Error)
              throw error
            }
          }
        }
        return original
      }
    }) as any
  }
  
  // In development, allow MockRedis
  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
    console.warn('⚠️  Using MockRedis for rate limiting in development mode. Configure Redis for production.')
    redisMonitor.setType('mock')
    return new MockRedis()
  }
  
  // In production, Redis is mandatory - no exceptions
  throw new Error(
    '❌ Redis configuration is required in production. ' +
    'Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables. ' +
    'Visit https://upstash.com to create a free Redis instance.'
  )
}

// Lazy initialization to avoid build-time errors
let redisInstance: ReturnType<typeof createRedisClient> | null = null

export function getRedis() {
  if (!redisInstance) {
    redisInstance = createRedisClient()
  }
  return redisInstance
}

// Export a proxy that initializes Redis on first use
export const redis = new Proxy({} as ReturnType<typeof createRedisClient>, {
  get(target, prop) {
    const instance = getRedis()
    return instance[prop as keyof typeof instance]
  }
})

// Helper functions for rate limiting
export async function checkRateLimit(
  identifier: string,
  limit: number,
  window: number = 3600 // 1 hour in seconds
): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
  const key = `rate_limit:${identifier}`
  const current = await redis.incr(key)
  
  if (current === 1) {
    await redis.expire(key, window)
  }
  
  const ttl = await redis.ttl(key)
  const resetAt = new Date(Date.now() + ttl * 1000)
  
  return {
    allowed: current <= limit,
    remaining: Math.max(0, limit - current),
    resetAt
  }
}

// Sliding window rate limiter
export async function slidingWindowRateLimit(
  identifier: string,
  limit: number,
  window: number = 3600 // 1 hour in seconds
): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now()
  const windowStart = now - window * 1000
  const key = `sliding:${identifier}`
  
  // Get all timestamps in the current window
  const timestamps = await redis.get(key)
  const timestampList = timestamps ? JSON.parse(timestamps as string) : []
  
  // Filter out expired timestamps
  const validTimestamps = timestampList.filter((ts: number) => ts > windowStart)
  
  if (validTimestamps.length >= limit) {
    return { allowed: false, remaining: 0 }
  }
  
  // Add current timestamp
  validTimestamps.push(now)
  
  // Store updated timestamps
  await redis.set(key, JSON.stringify(validTimestamps), window)
  
  return {
    allowed: true,
    remaining: limit - validTimestamps.length
  }
}