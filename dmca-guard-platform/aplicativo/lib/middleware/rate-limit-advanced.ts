// lib/middleware/rate-limit-advanced.ts
import { NextRequest, NextResponse } from 'next/server'
import { Ratelimit } from '@upstash/ratelimit'
import { getToken } from 'next-auth/jwt'

// Tipos de rate limiting
type RateLimitType = 'sliding' | 'fixed' | 'token-bucket'

interface RateLimitConfig {
  type: RateLimitType
  requests: number
  window: string
  namespace?: string
}

// Configurações por plano
const PLAN_CONFIGS: Record<string, Record<string, RateLimitConfig>> = {
  FREE: {
    default: { type: 'sliding', requests: 100, window: '1h' },
    api: { type: 'sliding', requests: 50, window: '1h' },
    'api/monitoring-sessions': { type: 'fixed', requests: 10, window: '1h' },
    'api/agents/known-sites/scan': { type: 'token-bucket', requests: 5, window: '24h' },
    'api/takedown-requests': { type: 'sliding', requests: 10, window: '1h' },
    'api/brand-profiles': { type: 'sliding', requests: 20, window: '1h' }
  },
  BASIC: {
    default: { type: 'sliding', requests: 500, window: '1h' },
    api: { type: 'sliding', requests: 200, window: '1h' },
    'api/monitoring-sessions': { type: 'fixed', requests: 50, window: '1h' },
    'api/agents/known-sites/scan': { type: 'token-bucket', requests: 20, window: '12h' },
    'api/takedown-requests': { type: 'sliding', requests: 50, window: '1h' },
    'api/brand-profiles': { type: 'sliding', requests: 100, window: '1h' }
  },
  PREMIUM: {
    default: { type: 'sliding', requests: 2000, window: '1h' },
    api: { type: 'sliding', requests: 1000, window: '1h' },
    'api/monitoring-sessions': { type: 'fixed', requests: 200, window: '1h' },
    'api/agents/known-sites/scan': { type: 'token-bucket', requests: 100, window: '6h' },
    'api/takedown-requests': { type: 'sliding', requests: 200, window: '1h' },
    'api/brand-profiles': { type: 'sliding', requests: 500, window: '1h' }
  },
  ENTERPRISE: {
    default: { type: 'sliding', requests: 10000, window: '1h' },
    api: { type: 'sliding', requests: 5000, window: '1h' },
    'api/monitoring-sessions': { type: 'fixed', requests: 1000, window: '1h' },
    'api/agents/known-sites/scan': { type: 'token-bucket', requests: 500, window: '1h' },
    'api/takedown-requests': { type: 'sliding', requests: 1000, window: '1h' },
    'api/brand-profiles': { type: 'sliding', requests: 2000, window: '1h' }
  },
  SUPER_USER: {
    default: { type: 'sliding', requests: 100000, window: '1h' },
    api: { type: 'sliding', requests: 50000, window: '1h' }
  }
}

// Cache de rate limiters para evitar recriação
const rateLimiterCache = new Map<string, Ratelimit>()

/**
 * Cria ou obtém rate limiter do cache
 */
function getRateLimiter(config: RateLimitConfig, redis: any): Ratelimit {
  const cacheKey = `${config.type}-${config.requests}-${config.window}-${config.namespace || 'default'}`
  
  if (rateLimiterCache.has(cacheKey)) {
    return rateLimiterCache.get(cacheKey)!
  }

  let limiter: Ratelimit

  switch (config.type) {
    case 'sliding':
      limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(config.requests, config.window),
        analytics: true,
        prefix: config.namespace ? `@dmca/${config.namespace}` : '@dmca/ratelimit'
      })
      break

    case 'fixed':
      limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.fixedWindow(config.requests, config.window),
        analytics: true,
        prefix: config.namespace ? `@dmca/${config.namespace}` : '@dmca/ratelimit'
      })
      break

    case 'token-bucket':
      limiter = new Ratelimit({
        redis,
        limiter: Ratelimit.tokenBucket(
          config.requests,
          config.window,
          Math.max(1, Math.floor(config.requests / 10)) // 10% burst capacity
        ),
        analytics: true,
        prefix: config.namespace ? `@dmca/${config.namespace}` : '@dmca/ratelimit'
      })
      break
  }

  rateLimiterCache.set(cacheKey, limiter)
  return limiter
}

/**
 * Middleware de rate limiting avançado
 */
export async function rateLimitMiddleware(request: NextRequest) {
  // Skip para rotas que não precisam de rate limiting
  const pathname = request.nextUrl.pathname
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/api/auth')
  ) {
    return NextResponse.next()
  }

  try {
    // Usar Redis configurado (MockRedis ou Upstash)
    const { redis } = await import('@/lib/redis')

    // Obter identificador do usuário
    const token = await getToken({ req: request })
    const userId = token?.sub
    const userPlan = (token?.planType as string) || 'FREE'
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
    
    // Identifier composto: preferir userId, fallback para IP
    const identifier = userId || `anon:${ip}`

    // Determinar configuração baseada na rota e plano
    const config = getConfigForRoute(pathname, userPlan)
    
    // Obter rate limiter apropriado
    const limiter = getRateLimiter(config, redis)
    
    // Verificar limite
    const { success, limit, reset, remaining, pending } = await limiter.limit(identifier)

    // Aguardar analytics (não bloqueia resposta)
    pending.then(() => {
      console.log(`[RateLimit] ${identifier} - ${pathname}: ${remaining}/${limit} remaining`)
    }).catch(console.error)

    // Adicionar headers de rate limit
    const response = success ? NextResponse.next() : new NextResponse(
      JSON.stringify({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        retryAfter: Math.round((reset - Date.now()) / 1000)
      }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json' }
      }
    )

    response.headers.set('X-RateLimit-Limit', limit.toString())
    response.headers.set('X-RateLimit-Remaining', remaining.toString())
    response.headers.set('X-RateLimit-Reset', new Date(reset).toISOString())
    response.headers.set('X-RateLimit-Type', config.type)

    // Headers adicionais para debugging
    if (process.env.NODE_ENV === 'development') {
      response.headers.set('X-RateLimit-Identifier', identifier)
      response.headers.set('X-RateLimit-Plan', userPlan)
    }

    // Se rate limit excedido, registrar no sistema anti-abuse
    if (!success && userId) {
      // Importação dinâmica para evitar dependência circular
      const { abuseMonitoringService } = await import('@/lib/services/security/abuse-monitoring.service')
      
      await abuseMonitoringService.recordViolation(
        userId,
        'EXCESSIVE_REQUESTS',
        0.15,
        `Rate limit exceeded on ${pathname}`,
        { ip, pathname, plan: userPlan }
      ).catch(console.error)
    }

    return response

  } catch (error) {
    console.error('[RateLimit] Error:', error)
    // Em caso de erro, permitir requisição mas logar
    return NextResponse.next()
  }
}

/**
 * Determina configuração de rate limit para rota
 */
function getConfigForRoute(pathname: string, plan: string): RateLimitConfig {
  const planConfig = PLAN_CONFIGS[plan] || PLAN_CONFIGS.FREE
  
  // Remover barras iniciais e finais
  const cleanPath = pathname.replace(/^\/|\/$/g, '')
  
  // Buscar configuração específica da rota
  for (const [route, config] of Object.entries(planConfig)) {
    if (route === 'default' || route === 'api') continue
    
    if (cleanPath.startsWith(route)) {
      return { ...config, namespace: route.replace(/\//g, '-') }
    }
  }
  
  // Se é rota de API, usar config de API
  if (pathname.startsWith('/api/')) {
    return { ...planConfig.api, namespace: 'api' }
  }
  
  // Fallback para config default
  return { ...planConfig.default, namespace: 'default' }
}

/**
 * Helper para criar response de rate limit
 */
export function createRateLimitResponse(
  message: string = 'Rate limit exceeded',
  retryAfter: number = 60
): NextResponse {
  return new NextResponse(
    JSON.stringify({
      error: 'Too Many Requests',
      message,
      retryAfter
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': retryAfter.toString()
      }
    }
  )
}

/**
 * Hook para usar em API routes
 */
export async function checkRateLimit(
  request: NextRequest,
  options?: {
    identifier?: string
    namespace?: string
    requests?: number
    window?: string
  }
): Promise<{ success: boolean; headers: Headers }> {
  try {
    const { redis } = await import('@/lib/redis')

    const identifier = options?.identifier || 
      request.headers.get('x-forwarded-for') || 
      'unknown'

    const config: RateLimitConfig = {
      type: 'sliding',
      requests: options?.requests || 100,
      window: options?.window || '1h',
      namespace: options?.namespace
    }

    const limiter = getRateLimiter(config, redis)
    const result = await limiter.limit(identifier)

    const headers = new Headers()
    headers.set('X-RateLimit-Limit', result.limit.toString())
    headers.set('X-RateLimit-Remaining', result.remaining.toString())
    headers.set('X-RateLimit-Reset', new Date(result.reset).toISOString())

    return { success: result.success, headers }
  } catch (error) {
    console.error('[RateLimit] checkRateLimit error:', error)
    return { success: true, headers: new Headers() }
  }
}