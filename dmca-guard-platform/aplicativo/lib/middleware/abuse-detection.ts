// lib/middleware/abuse-detection.ts
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { abuseMonitoringService } from '@/lib/services/security/abuse-monitoring.service'
import { prisma } from '@/lib/prisma'

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
  message: string
}

// Configuração de rate limiting por endpoint
const ENDPOINT_LIMITS: Record<string, RateLimitConfig> = {
  '/api/brand-profiles': {
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 10,
    message: 'Muitas requisições para criar perfis de marca'
  },
  '/api/monitoring-sessions': {
    windowMs: 60 * 1000,
    maxRequests: 5,
    message: 'Muitas requisições para criar sessões'
  },
  '/api/agents/known-sites/scan': {
    windowMs: 5 * 60 * 1000, // 5 minutos
    maxRequests: 3,
    message: 'Muitas solicitações de varredura'
  },
  '/api/takedown-requests': {
    windowMs: 60 * 1000,
    maxRequests: 20,
    message: 'Muitas solicitações de remoção'
  }
}

// Cache em memória para rate limiting (em produção, usar Redis)
const requestCounts = new Map<string, { count: number; resetTime: number }>()

export async function abuseDetectionMiddleware(request: NextRequest) {
  try {
    // Obter token de autenticação
    const token = await getToken({ req: request })
    const userId = token?.sub

    if (!userId) {
      // Para usuários não autenticados, usar IP
      return handleAnonymousRequest(request)
    }

    // Verificar estado de abuso do usuário
    const abuseScore = await prisma.abuseScore.findUnique({
      where: { userId },
      select: { state: true, currentScore: true }
    })

    // Bloquear usuários com estado BLOCKED
    if (abuseScore?.state === 'BLOCKED') {
      return NextResponse.json(
        {
          error: 'Conta bloqueada devido a violações dos termos de uso',
          code: 'ACCOUNT_BLOCKED'
        },
        { status: 403 }
      )
    }

    // Aplicar rate limiting baseado no estado
    const rateLimitMultiplier = getRateLimitMultiplier(abuseScore?.state)
    const isRateLimited = await checkRateLimit(request, userId, rateLimitMultiplier)

    if (isRateLimited) {
      // Registrar violação de rate limit
      await abuseMonitoringService.recordViolation(
        userId,
        'EXCESSIVE_REQUESTS',
        0.1,
        `Rate limit excedido em ${request.nextUrl.pathname}`
      )

      return NextResponse.json(
        {
          error: 'Muitas requisições. Por favor, aguarde.',
          retryAfter: 60
        },
        { status: 429 }
      )
    }

    // Detectar padrões suspeitos
    await detectSuspiciousPatterns(request, userId)

    // Adicionar headers de segurança
    const response = NextResponse.next()
    response.headers.set('X-RateLimit-State', abuseScore?.state || 'CLEAN')
    response.headers.set('X-Abuse-Score', String(abuseScore?.currentScore || 0))

    return response
  } catch (error) {
    console.error('[Abuse Detection] Error:', error)
    // Em caso de erro, permitir requisição mas logar
    return NextResponse.next()
  }
}

/**
 * Trata requisições anônimas
 */
async function handleAnonymousRequest(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
  const key = `anon:${ip}`

  // Rate limiting mais restritivo para anônimos
  const isRateLimited = await checkRateLimit(request, key, 0.5)

  if (isRateLimited) {
    return NextResponse.json(
      {
        error: 'Muitas requisições. Por favor, faça login ou aguarde.',
        code: 'RATE_LIMIT_ANONYMOUS'
      },
      { status: 429 }
    )
  }

  return NextResponse.next()
}

/**
 * Verifica rate limit
 */
async function checkRateLimit(
  request: NextRequest,
  identifier: string,
  multiplier: number
): Promise<boolean> {
  const pathname = request.nextUrl.pathname
  const endpoint = Object.keys(ENDPOINT_LIMITS).find(ep => pathname.startsWith(ep))

  if (!endpoint) {
    // Endpoint não tem limite específico
    return false
  }

  const limit = ENDPOINT_LIMITS[endpoint]
  const key = `${identifier}:${endpoint}`
  const now = Date.now()

  // Obter contagem atual
  const current = requestCounts.get(key)

  if (!current || current.resetTime < now) {
    // Novo período
    requestCounts.set(key, {
      count: 1,
      resetTime: now + limit.windowMs
    })
    return false
  }

  // Incrementar contagem
  current.count++

  // Verificar limite (ajustado pelo multiplier)
  const adjustedLimit = Math.floor(limit.maxRequests * multiplier)
  return current.count > adjustedLimit
}

/**
 * Obtém multiplicador de rate limit baseado no estado
 */
function getRateLimitMultiplier(state?: string): number {
  switch (state) {
    case 'BLOCKED':
      return 0
    case 'HIGH_RISK':
      return 0.3
    case 'WARNING':
      return 0.7
    default:
      return 1
  }
}

/**
 * Detecta padrões suspeitos
 */
async function detectSuspiciousPatterns(request: NextRequest, userId: string) {
  const pathname = request.nextUrl.pathname
  const method = request.method
  const userAgent = request.headers.get('user-agent') || ''

  // Padrão 1: Requisições automatizadas (sem user agent válido)
  if (!userAgent || userAgent.includes('bot') || userAgent.includes('scraper')) {
    await abuseMonitoringService.recordViolation(
      userId,
      'SCRAPING',
      0.3,
      'Possível tentativa de scraping detectada'
    )
  }

  // Padrão 2: Acesso direto a APIs sem frontend
  const referer = request.headers.get('referer')
  if (!referer && method === 'POST' && !pathname.includes('auth')) {
    await prisma.userActivity.create({
      data: {
        userId,
        action: 'SUSPICIOUS_API_ACCESS',
        metadata: {
          pathname,
          method,
          userAgent
        }
      }
    })
  }

  // Padrão 3: Tentativas de acesso a recursos de outros usuários
  if (pathname.includes('/api/') && method === 'GET') {
    const url = new URL(request.url)
    const resourceId = url.searchParams.get('userId') || 
                      url.searchParams.get('brandProfileId')
    
    if (resourceId && resourceId !== userId) {
      // Log tentativa de acesso cross-user
      await prisma.userActivity.create({
        data: {
          userId,
          action: 'CROSS_USER_ACCESS_ATTEMPT',
          metadata: {
            pathname,
            attemptedResource: resourceId
          }
        }
      })
    }
  }
}

/**
 * Limpa cache periodicamente (evitar memory leak)
 */
setInterval(() => {
  const now = Date.now()
  for (const [key, data] of requestCounts.entries()) {
    if (data.resetTime < now) {
      requestCounts.delete(key)
    }
  }
}, 60 * 1000) // A cada minuto