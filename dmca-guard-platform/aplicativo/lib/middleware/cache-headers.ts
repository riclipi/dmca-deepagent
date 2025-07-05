import { NextResponse } from 'next/server'
import { getAgentCache } from '../cache/agent-cache-manager'

export function withCacheHeaders(
  handler: (req: Request, context?: any) => Promise<Response>
) {
  return async (req: Request, context?: any) => {
    const startTime = Date.now()
    const cacheKey = req.url
    
    // Verificar se tem cache hit
    const cache = getAgentCache()
    const stats = cache.getStats()
    
    // Executar handler original
    const response = await handler(req, context)
    
    // Adicionar headers de cache e performance
    const headers = new Headers(response.headers)
    
    // Headers de performance
    headers.set('X-Response-Time', `${Date.now() - startTime}ms`)
    
    // Headers de cache stats
    headers.set('X-Cache-Stats', JSON.stringify({
      total: stats.total,
      content: stats.content.hits,
      metadata: stats.metadata.hits
    }))
    
    // Se foi um cache hit (verificar pela velocidade de resposta)
    if (Date.now() - startTime < 50) {
      headers.set('X-Cache-Hit', 'true')
    } else {
      headers.set('X-Cache-Hit', 'false')
    }
    
    // Cache control headers para respostas
    if (response.status === 200) {
      // Cache público por 5 minutos
      headers.set('Cache-Control', 'public, max-age=300')
      headers.set('Vary', 'Accept-Encoding')
    } else if (response.status === 404) {
      // Cache 404s por 1 hora
      headers.set('Cache-Control', 'public, max-age=3600')
    } else {
      // Não cachear erros
      headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    }
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    })
  }
}