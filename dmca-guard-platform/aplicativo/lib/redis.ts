// Redis client for rate limiting
import { Redis } from '@upstash/redis'

// Mock Redis for local development without Redis connection
class MockRedis {
  private store: Map<string, { value: string; ttl?: number; createdAt: number }> = new Map()

  async get(key: string): Promise<string | null> {
    const item = this.store.get(key)
    
    if (!item) return null
    
    // Check if TTL expired
    if (item.ttl && Date.now() - item.createdAt > item.ttl * 1000) {
      this.store.delete(key)
      return null
    }
    
    return item.value
  }

  async set(key: string, value: string | number, ttl?: number): Promise<'OK'> {
    this.store.set(key, {
      value: String(value),
      ttl,
      createdAt: Date.now()
    })
    return 'OK'
  }

  async incr(key: string): Promise<number> {
    const current = await this.get(key)
    const newValue = current ? parseInt(current) + 1 : 1
    await this.set(key, newValue)
    return newValue
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
}

// Create Redis instance based on environment
function createRedisClient() {
  // Use Upstash Redis if credentials are available
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  
  // Otherwise use mock for local development
  console.warn('⚠️  Using MockRedis for rate limiting. Configure Upstash Redis for production.')
  return new MockRedis()
}

// Export redis instance
export const redis = createRedisClient()

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