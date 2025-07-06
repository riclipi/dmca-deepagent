// lib/middleware/rate-limit-edge.ts
// Versão Edge-compatible do rate limit (sem Prisma)
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
    default: { type: 'sliding', requests: 50000, window: '1h' },
    api: { type: 'sliding', requests: 50000, window: '1h' }
  }
}

// Criar rate limiter com base na configuração
function getRateLimiter(config: RateLimitConfig, redis: any): Ratelimit {
  const { type, requests, window } = config
  
  // Parse window string to Duration object
  const parseWindow = (w: string): { ms: number } => {
    const match = w.match(/(\d+)([smhd])/)
    if (!match) return { ms: 3600000 } // default 1 hour
    
    const value = parseInt(match[1])
    const unit = match[2]
    
    switch (unit) {
      case 's': return { ms: value * 1000 }
      case 'm': return { ms: value * 60 * 1000 }
      case 'h': return { ms: value * 60 * 60 * 1000 }
      case 'd': return { ms: value * 24 * 60 * 60 * 1000 }
      default: return { ms: 3600000 }
    }
  }
  
  const duration = parseWindow(window)
  
  switch (type) {
    case 'fixed':
      return new Ratelimit({
        redis,
        limiter: Ratelimit.fixedWindow(requests, window as any),
        prefix: config.namespace || 'ratelimit',
        analytics: false // Desabilitar analytics no Edge
      })
    
    case 'token-bucket':
      return new Ratelimit({
        redis,
        limiter: Ratelimit.tokenBucket(requests, window as any, requests),
        prefix: config.namespace || 'ratelimit',
        analytics: false
      })
    
    case 'sliding':
    default:
      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(requests, window as any),
        prefix: config.namespace || 'ratelimit',
        analytics: false
      })
  }
}

export async function rateLimitMiddleware(request: NextRequest) {
  try {
    const pathname = request.nextUrl.pathname
    
    // Ignorar rotas estáticas e de autenticação
    if (
      pathname.startsWith('/_next/') ||
      pathname.startsWith('/static/') ||
      pathname === '/favicon.ico' ||
      pathname.startsWith('/auth/')
    ) {
      return NextResponse.next()
    }

    // Obter informações do usuário
    const token = await getToken({ req: request })
    const userId = token?.sub
    const userPlan = (token?.planType as string) || 'FREE'
    const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'

    // Determinar identificador
    const identifier = userId || `anon:${ip}`

    // Obter configuração baseada no plano e rota
    const planConfig = PLAN_CONFIGS[userPlan] || PLAN_CONFIGS.FREE
    let config: RateLimitConfig

    // Procurar configuração específica da rota
    const routeConfig = Object.keys(planConfig).find(route => 
      route !== 'default' && route !== 'api' && pathname.startsWith(`/${route}`)
    )

    if (routeConfig) {
      config = planConfig[routeConfig]
    } else if (pathname.startsWith('/api/')) {
      config = planConfig.api || planConfig.default
    } else {
      config = planConfig.default
    }

    // Aplicar rate limiting
    const { redis } = await import('@/lib/redis')
    const limiter = getRateLimiter(config, redis)
    const result = await limiter.limit(identifier)

    // Preparar resposta
    const success = result.success
    let response: NextResponse

    if (!success) {
      response = NextResponse.json(
        {
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Try again in ${Math.ceil(result.reset - Date.now()) / 1000} seconds`,
          retryAfter: Math.ceil((result.reset - Date.now()) / 1000)
        },
        { status: 429 }
      )
    } else {
      response = NextResponse.next()
    }

    // Adicionar headers de rate limit
    response.headers.set('X-RateLimit-Limit', result.limit.toString())
    response.headers.set('X-RateLimit-Remaining', result.remaining.toString())
    response.headers.set('X-RateLimit-Reset', new Date(result.reset).toISOString())

    // Headers extras para debug (remover em produção)
    if (process.env.NODE_ENV !== 'production') {
      response.headers.set('X-RateLimit-Identifier', identifier)
      response.headers.set('X-RateLimit-Plan', userPlan)
    }

    // Se rate limit excedido, registrar via header para ser processado depois
    if (!success && userId) {
      response.headers.set('X-Abuse-Violation', 'rate-limit-exceeded')
      response.headers.set('X-Abuse-User-Id', userId)
      response.headers.set('X-Abuse-Path', pathname)
    }

    return response

  } catch (error) {
    console.error('[RateLimit Edge] Error:', error)
    // Em caso de erro, permitir requisição
    return NextResponse.next()
  }
}