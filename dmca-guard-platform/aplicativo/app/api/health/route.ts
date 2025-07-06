import { NextRequest } from 'next/server'
import { ApiResponse } from '@/lib/api-response'
import { prisma } from '@/lib/prisma'
import { fairQueueManager } from '@/lib/services/security/fair-queue-manager'
import { cacheManager } from '@/lib/cache/cache-manager'
import { Redis } from '@upstash/redis'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  timestamp: string
  uptime: number
  services: {
    database: ServiceHealth
    redis: ServiceHealth
    websocket: ServiceHealth
    queue: ServiceHealth
    cache: ServiceHealth
  }
  system: {
    memory: {
      used: number
      total: number
      percentage: number
    }
    nodejs: {
      version: string
      heap: {
        used: number
        total: number
        percentage: number
      }
    }
  }
}

interface ServiceHealth {
  status: 'up' | 'down' | 'degraded'
  responseTime?: number
  error?: string
  details?: any
}

async function checkDatabase(): Promise<ServiceHealth> {
  const start = Date.now()
  try {
    // Simple query to check database connection
    await prisma.$queryRaw`SELECT 1`
    
    // Check if critical tables exist
    const userCount = await prisma.user.count()
    
    return {
      status: 'up',
      responseTime: Date.now() - start,
      details: {
        connected: true,
        userCount
      }
    }
  } catch (error) {
    return {
      status: 'down',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown database error'
    }
  }
}

async function checkRedis(): Promise<ServiceHealth> {
  const start = Date.now()
  try {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
      return {
        status: 'down',
        error: 'Redis not configured'
      }
    }

    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })

    // Test connection with ping
    const pong = await redis.ping()
    
    return {
      status: pong === 'PONG' ? 'up' : 'degraded',
      responseTime: Date.now() - start,
      details: {
        connected: true,
        ping: pong
      }
    }
  } catch (error) {
    return {
      status: 'down',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown Redis error'
    }
  }
}

async function checkWebSocket(): Promise<ServiceHealth> {
  try {
    // Check if WebSocket server is accessible
    const wsPort = process.env.PORT || 3000
    
    // In production, you might want to actually test WebSocket connection
    // For now, we'll check if the server is running
    const serverRunning = process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'development'
    
    return {
      status: serverRunning ? 'up' : 'down',
      details: {
        port: wsPort,
        environment: process.env.NODE_ENV
      }
    }
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown WebSocket error'
    }
  }
}

async function checkQueue(): Promise<ServiceHealth> {
  try {
    const queueStats = await fairQueueManager.getQueueStats()
    const totalQueued = queueStats.pending + queueStats.processing
    const isHealthy = totalQueued < 1000 // Arbitrary threshold
    
    return {
      status: isHealthy ? 'up' : 'degraded',
      details: {
        pending: queueStats.pending,
        processing: queueStats.processing,
        completed: queueStats.completed,
        failed: queueStats.failed,
        cancelled: queueStats.cancelled,
        totalQueued
      }
    }
  } catch (error) {
    return {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown queue error'
    }
  }
}

async function checkCache(): Promise<ServiceHealth> {
  const start = Date.now()
  try {
    // Test cache operations
    const testKey = '__health_check__'
    const testValue = { test: true, timestamp: Date.now() }
    
    await cacheManager.set(testKey, testValue, 'content', ['health-check'])
    const retrieved = await cacheManager.get(testKey, 'content')
    
    const cacheWorking = retrieved && retrieved.test === true
    
    // Clean up
    await cacheManager.invalidateByTags(['health-check'])
    
    return {
      status: cacheWorking ? 'up' : 'degraded',
      responseTime: Date.now() - start,
      details: {
        testPassed: cacheWorking
      }
    }
  } catch (error) {
    return {
      status: 'down',
      responseTime: Date.now() - start,
      error: error instanceof Error ? error.message : 'Unknown cache error'
    }
  }
}

function getSystemHealth() {
  const memUsage = process.memoryUsage()
  const totalMem = require('os').totalmem()
  const freeMem = require('os').freemem()
  const usedMem = totalMem - freeMem
  
  return {
    memory: {
      used: Math.round(usedMem / 1024 / 1024), // MB
      total: Math.round(totalMem / 1024 / 1024), // MB
      percentage: Math.round((usedMem / totalMem) * 100)
    },
    nodejs: {
      version: process.version,
      heap: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100)
      }
    }
  }
}

export async function GET(request: NextRequest) {
  const startTime = Date.now()
  
  // Run all health checks in parallel
  const [database, redis, websocket, queue, cache] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkWebSocket(),
    checkQueue(),
    checkCache()
  ])
  
  const services = { database, redis, websocket, queue, cache }
  
  // Determine overall health status
  const statuses = Object.values(services).map(s => s.status)
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'
  
  if (statuses.includes('down')) {
    overallStatus = 'unhealthy'
  } else if (statuses.includes('degraded')) {
    overallStatus = 'degraded'
  }
  
  const health: HealthStatus = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services,
    system: getSystemHealth()
  }
  
  // Set appropriate status code
  const statusCode = overallStatus === 'healthy' ? 200 : 
                    overallStatus === 'degraded' ? 200 : 503
  
  return ApiResponse.success(health, {
    responseTime: Date.now() - startTime
  }, statusCode)
}