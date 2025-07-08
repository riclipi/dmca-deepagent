// lib/redis-enhanced.ts - Enhanced Redis client with production features
import { Redis } from '@upstash/redis'
import { redisMonitor } from './monitoring/redis-metrics'

// Circuit breaker state
interface CircuitBreakerState {
  failures: number
  lastFailureTime: number
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN'
  successCount: number
}

// Health check result
interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded'
  latency: number
  error?: string
  lastCheck: Date
}

export class EnhancedRedisClient {
  private client: Redis | null = null
  private circuitBreaker: CircuitBreakerState = {
    failures: 0,
    lastFailureTime: 0,
    state: 'CLOSED',
    successCount: 0
  }
  
  // Configuration from environment
  private readonly config = {
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    maxRetries: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.REDIS_RETRY_DELAY || '1000'),
    connectionTimeout: parseInt(process.env.REDIS_CONNECTION_TIMEOUT || '5000'),
    circuitBreakerThreshold: 5,
    circuitBreakerTimeout: 60000, // 1 minute
    halfOpenRequests: 3
  }

  private lastHealthCheck: HealthCheckResult = {
    status: 'healthy',
    latency: 0,
    lastCheck: new Date()
  }

  constructor() {
    // Validate configuration in production
    if (process.env.NODE_ENV === 'production') {
      if (!this.config.url || !this.config.token) {
        throw new Error(
          'CRITICAL: Redis configuration missing in production. ' +
          'Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.'
        )
      }
    }

    this.initializeClient()
    this.startHealthCheckInterval()
  }

  private initializeClient() {
    try {
      this.client = new Redis({
        url: this.config.url,
        token: this.config.token,
        retry: {
          retries: this.config.maxRetries,
          backoff: (retryCount: number) => {
            return Math.min(this.config.retryDelay * Math.pow(2, retryCount), 10000)
          }
        }
      })

      redisMonitor.setType('upstash')
      console.log('✅ Enhanced Redis client initialized')
    } catch (error) {
      console.error('❌ Failed to initialize Redis client:', error)
      throw error
    }
  }

  /**
   * Circuit breaker logic
   */
  private async withCircuitBreaker<T>(
    operation: () => Promise<T>,
    operationName: string
  ): Promise<T> {
    // Check circuit breaker state
    if (this.circuitBreaker.state === 'OPEN') {
      const timeSinceLastFailure = Date.now() - this.circuitBreaker.lastFailureTime
      
      // Check if we should try half-open
      if (timeSinceLastFailure > this.config.circuitBreakerTimeout) {
        this.circuitBreaker.state = 'HALF_OPEN'
        this.circuitBreaker.successCount = 0
        console.log('🔄 Circuit breaker moving to HALF_OPEN state')
      } else {
        redisMonitor.recordError(new Error('Circuit breaker OPEN'))
        throw new Error('Redis circuit breaker is OPEN - service temporarily unavailable')
      }
    }

    try {
      const startTime = Date.now()
      const result = await operation()
      const duration = Date.now() - startTime

      // Record success
      redisMonitor.incrementOperation(operationName as any)
      redisMonitor.recordLatency(duration)

      // Update circuit breaker on success
      if (this.circuitBreaker.state === 'HALF_OPEN') {
        this.circuitBreaker.successCount++
        
        if (this.circuitBreaker.successCount >= this.config.halfOpenRequests) {
          this.circuitBreaker.state = 'CLOSED'
          this.circuitBreaker.failures = 0
          console.log('✅ Circuit breaker CLOSED - service recovered')
        }
      } else {
        this.circuitBreaker.failures = Math.max(0, this.circuitBreaker.failures - 1)
      }

      return result
    } catch (error) {
      // Record failure
      this.circuitBreaker.failures++
      this.circuitBreaker.lastFailureTime = Date.now()
      redisMonitor.recordError(error as Error)

      // Open circuit if threshold reached
      if (this.circuitBreaker.failures >= this.config.circuitBreakerThreshold) {
        this.circuitBreaker.state = 'OPEN'
        console.error('❌ Circuit breaker OPEN - too many Redis failures')
      }

      throw error
    }
  }

  /**
   * Health check implementation
   */
  async healthCheck(): Promise<HealthCheckResult> {
    try {
      const startTime = Date.now()
      
      // Simple ping operation
      await this.withCircuitBreaker(
        async () => {
          if (!this.client) throw new Error('Redis client not initialized')
          await this.client.ping()
          return true
        },
        'ping'
      )

      const latency = Date.now() - startTime

      // Determine health status based on latency
      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
      if (latency > 1000) {
        status = 'degraded'
      } else if (latency > 5000) {
        status = 'unhealthy'
      }

      this.lastHealthCheck = {
        status,
        latency,
        lastCheck: new Date()
      }

      return this.lastHealthCheck
    } catch (error) {
      this.lastHealthCheck = {
        status: 'unhealthy',
        latency: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date()
      }

      return this.lastHealthCheck
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthCheckInterval() {
    // Health check every 30 seconds
    setInterval(async () => {
      await this.healthCheck()
    }, 30000)
  }

  /**
   * Get current health status
   */
  getHealthStatus(): HealthCheckResult {
    return this.lastHealthCheck
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(): CircuitBreakerState {
    return { ...this.circuitBreaker }
  }

  /**
   * Redis operations with circuit breaker
   */
  async get(key: string): Promise<string | null> {
    return this.withCircuitBreaker(
      async () => {
        if (!this.client) throw new Error('Redis client not initialized')
        return await this.client.get(key)
      },
      'get'
    )
  }

  async set(
    key: string, 
    value: string | number, 
    options?: { ex?: number; px?: number }
  ): Promise<'OK'> {
    const result = await this.withCircuitBreaker(
      async () => {
        if (!this.client) throw new Error('Redis client not initialized')
        
        if (options?.ex) {
          return await this.client.set(key, value, { ex: options.ex })
        } else if (options?.px) {
          return await this.client.set(key, value, { px: options.px })
        }
        
        return await this.client.set(key, value)
      },
      'set'
    )
    
    return result as 'OK'
  }

  async incr(key: string): Promise<number> {
    return this.withCircuitBreaker(
      async () => {
        if (!this.client) throw new Error('Redis client not initialized')
        return await this.client.incr(key)
      },
      'incr'
    )
  }

  async expire(key: string, seconds: number): Promise<number> {
    return this.withCircuitBreaker(
      async () => {
        if (!this.client) throw new Error('Redis client not initialized')
        return await this.client.expire(key, seconds)
      },
      'expire'
    )
  }

  async ttl(key: string): Promise<number> {
    return this.withCircuitBreaker(
      async () => {
        if (!this.client) throw new Error('Redis client not initialized')
        return await this.client.ttl(key)
      },
      'ttl'
    )
  }

  async del(...keys: string[]): Promise<number> {
    return this.withCircuitBreaker(
      async () => {
        if (!this.client) throw new Error('Redis client not initialized')
        return await this.client.del(...keys)
      },
      'del'
    )
  }

  async keys(pattern: string): Promise<string[]> {
    return this.withCircuitBreaker(
      async () => {
        if (!this.client) throw new Error('Redis client not initialized')
        return await this.client.keys(pattern)
      },
      'keys'
    )
  }

  // Rate limiting specific methods
  async checkRateLimit(
    identifier: string,
    limit: number,
    window: number = 3600
  ): Promise<{ allowed: boolean; remaining: number; resetAt: Date }> {
    const key = `rate_limit:${identifier}`
    
    try {
      const current = await this.incr(key)
      
      if (current === 1) {
        await this.expire(key, window)
      }
      
      const ttl = await this.ttl(key)
      const resetAt = new Date(Date.now() + ttl * 1000)
      
      return {
        allowed: current <= limit,
        remaining: Math.max(0, limit - current),
        resetAt
      }
    } catch (error) {
      // On error, fail open but log
      console.error('Rate limit check failed:', error)
      redisMonitor.recordError(error as Error)
      
      // Fail open - allow the request but log the incident
      return {
        allowed: true,
        remaining: limit,
        resetAt: new Date(Date.now() + window * 1000)
      }
    }
  }

  // Sliding window rate limiter
  async slidingWindowRateLimit(
    identifier: string,
    limit: number,
    window: number = 3600
  ): Promise<{ allowed: boolean; remaining: number }> {
    const now = Date.now()
    const windowStart = now - window * 1000
    const key = `sliding:${identifier}`
    
    try {
      // Get all timestamps in the current window
      const timestamps = await this.get(key)
      const timestampList = timestamps ? JSON.parse(timestamps as string) : []
      
      // Filter out expired timestamps
      const validTimestamps = timestampList.filter((ts: number) => ts > windowStart)
      
      if (validTimestamps.length >= limit) {
        return { allowed: false, remaining: 0 }
      }
      
      // Add current timestamp
      validTimestamps.push(now)
      
      // Store updated timestamps
      await this.set(key, JSON.stringify(validTimestamps), { ex: window })
      
      return {
        allowed: true,
        remaining: limit - validTimestamps.length
      }
    } catch (error) {
      console.error('Sliding window rate limit failed:', error)
      redisMonitor.recordError(error as Error)
      
      // Fail open
      return {
        allowed: true,
        remaining: limit
      }
    }
  }

  // Get raw client for advanced operations
  getRawClient(): Redis | null {
    return this.client
  }
}

// Export singleton instance
let redisInstance: EnhancedRedisClient | null = null

export function getEnhancedRedis(): EnhancedRedisClient {
  if (!redisInstance) {
    redisInstance = new EnhancedRedisClient()
  }
  return redisInstance
}

// Export convenience methods
export async function checkRedisHealth(): Promise<HealthCheckResult> {
  return getEnhancedRedis().healthCheck()
}

export function getRedisCircuitBreakerStatus(): CircuitBreakerState {
  return getEnhancedRedis().getCircuitBreakerStatus()
}