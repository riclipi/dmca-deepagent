/**
 * Redis monitoring and metrics
 */

type RedisType = 'upstash' | 'mock'

interface RedisMetrics {
  type: RedisType
  initialized: boolean
  initTime: Date
  operationCounts: {
    get: number
    set: number
    incr: number
    expire: number
    ttl: number
    keys: number
    del: number
    flushall: number
  }
  errors: {
    count: number
    lastError?: {
      message: string
      timestamp: Date
    }
  }
}

class RedisMonitor {
  private metrics: RedisMetrics = {
    type: 'mock',
    initialized: false,
    initTime: new Date(),
    operationCounts: {
      get: 0,
      set: 0,
      incr: 0,
      expire: 0,
      ttl: 0,
      keys: 0,
      del: 0,
      flushall: 0,
    },
    errors: {
      count: 0,
    },
  }

  setType(type: RedisType) {
    this.metrics.type = type
    this.metrics.initialized = true
    this.metrics.initTime = new Date()
    
    // Log initialization
    const icon = type === 'upstash' ? '🚀' : '🔧'
    console.log(`${icon} Redis initialized: ${type.toUpperCase()}`)
    
    if (type === 'mock' && process.env.NODE_ENV !== 'development') {
      console.warn('⚠️  WARNING: Using MockRedis outside of development environment')
    }
  }

  incrementOperation(operation: keyof RedisMetrics['operationCounts']) {
    this.metrics.operationCounts[operation]++
  }

  recordError(error: Error) {
    this.metrics.errors.count++
    this.metrics.errors.lastError = {
      message: error.message,
      timestamp: new Date(),
    }
    
    // Log critical errors
    if (error.message.includes('Redis configuration is required')) {
      console.error('🚨 CRITICAL: Redis configuration error in production')
    }
  }

  getMetrics(): RedisMetrics {
    return { ...this.metrics }
  }

  getHealthStatus() {
    const metrics = this.getMetrics()
    const totalOps = Object.values(metrics.operationCounts).reduce((a, b) => a + b, 0)
    const errorRate = totalOps > 0 ? (metrics.errors.count / totalOps) * 100 : 0
    
    return {
      status: metrics.type === 'mock' && process.env.NODE_ENV === 'production' ? 'critical' : 'healthy',
      type: metrics.type,
      uptime: new Date().getTime() - metrics.initTime.getTime(),
      totalOperations: totalOps,
      errorRate: errorRate.toFixed(2) + '%',
      lastError: metrics.errors.lastError,
    }
  }

  logDailyReport() {
    const metrics = this.getMetrics()
    const health = this.getHealthStatus()
    
    console.log('📊 Redis Daily Report:')
    console.log(`   Type: ${metrics.type.toUpperCase()}`)
    console.log(`   Status: ${health.status}`)
    console.log(`   Total Operations: ${health.totalOperations}`)
    console.log(`   Error Rate: ${health.errorRate}`)
    console.log(`   Top Operations:`)
    
    // Sort operations by count
    const sortedOps = Object.entries(metrics.operationCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
    
    sortedOps.forEach(([op, count]) => {
      console.log(`     - ${op}: ${count}`)
    })
  }
}

// Export singleton instance
export const redisMonitor = new RedisMonitor()

// Export convenience function for health checks
export function getRedisHealth() {
  return redisMonitor.getHealthStatus()
}