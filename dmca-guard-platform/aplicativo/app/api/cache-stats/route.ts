import { NextResponse } from 'next/server'
import { getAgentCache } from '@/lib/cache/agent-cache-manager'
import { withCacheHeaders } from '@/lib/middleware/cache-headers'

async function handler(request: Request) {
  try {
    const cache = getAgentCache()
    const stats = cache.getStats()
    
    // Calcular taxa de hit
    const totalRequests = stats.total.hits + stats.total.misses
    const hitRate = totalRequests > 0 ? (stats.total.hits / totalRequests * 100).toFixed(2) : 0
    
    return NextResponse.json({
      success: true,
      data: {
        stats: {
          content: {
            size: stats.content.size,
            hits: stats.content.hits,
            misses: stats.content.misses,
            hitRate: stats.content.hits > 0 ? 
              ((stats.content.hits / (stats.content.hits + stats.content.misses)) * 100).toFixed(2) : 0
          },
          robots: {
            size: stats.robots.size,
            hits: stats.robots.hits,
            misses: stats.robots.misses,
            hitRate: stats.robots.hits > 0 ? 
              ((stats.robots.hits / (stats.robots.hits + stats.robots.misses)) * 100).toFixed(2) : 0
          },
          metadata: {
            size: stats.metadata.size,
            hits: stats.metadata.hits,
            misses: stats.metadata.misses,
            hitRate: stats.metadata.hits > 0 ? 
              ((stats.metadata.hits / (stats.metadata.hits + stats.metadata.misses)) * 100).toFixed(2) : 0
          },
          screenshot: {
            size: stats.screenshot.size,
            hits: stats.screenshot.hits,
            misses: stats.screenshot.misses,
            hitRate: stats.screenshot.hits > 0 ? 
              ((stats.screenshot.hits / (stats.screenshot.hits + stats.screenshot.misses)) * 100).toFixed(2) : 0
          },
          total: {
            size: stats.total.size,
            hits: stats.total.hits,
            misses: stats.total.misses,
            hitRate: `${hitRate}%`
          }
        },
        summary: {
          totalEntries: stats.total.size,
          totalHits: stats.total.hits,
          overallHitRate: `${hitRate}%`,
          mostUsedCache: Object.entries(stats)
            .filter(([key]) => key !== 'total')
            .sort(([, a], [, b]) => b.hits - a.hits)[0]?.[0] || 'none'
        }
      }
    })
  } catch (error) {
    console.error('Cache stats error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve cache statistics' },
      { status: 500 }
    )
  }
}

export const GET = withCacheHeaders(handler)