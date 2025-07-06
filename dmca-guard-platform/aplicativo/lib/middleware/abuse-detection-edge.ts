// lib/middleware/abuse-detection-edge.ts
// Versão Edge-compatible do abuse detection (sem Prisma)
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

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

// Cache em memória para rate limiting
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

    // Verificar rate limit
    const pathname = request.nextUrl.pathname
    const endpoint = Object.keys(ENDPOINT_LIMITS).find(ep => pathname.startsWith(ep))

    if (endpoint) {
      const isRateLimited = await checkRateLimit(request, userId, 1)
      if (isRateLimited) {
        // Registrar violação via API call (não diretamente no Edge)
        // Isso será feito no cliente ou no servidor
        return NextResponse.json(
          {
            error: ENDPOINT_LIMITS[endpoint].message,
            code: 'RATE_LIMIT_EXCEEDED'
          },
          { status: 429 }
        )
      }
    }

    // Adicionar headers com informações do usuário
    const response = NextResponse.next()
    response.headers.set('X-User-ID', userId)
    
    return response

  } catch (error) {
    console.error('[Abuse Detection Edge] Error:', error)
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
 * Verifica rate limit usando cache em memória
 */
async function checkRateLimit(
  request: NextRequest,
  identifier: string,
  multiplier: number
): Promise<boolean> {
  const pathname = request.nextUrl.pathname
  const endpoint = Object.keys(ENDPOINT_LIMITS).find(ep => pathname.startsWith(ep))

  if (!endpoint) {
    return false
  }

  const limit = ENDPOINT_LIMITS[endpoint]
  const key = `${identifier}:${endpoint}`
  const now = Date.now()

  // Obter contagem atual
  let record = requestCounts.get(key)

  if (!record || now > record.resetTime) {
    // Novo período
    record = {
      count: 1,
      resetTime: now + limit.windowMs
    }
    requestCounts.set(key, record)
    return false
  }

  // Incrementar contagem
  record.count++

  // Verificar limite (com multiplicador)
  const effectiveLimit = Math.floor(limit.maxRequests * multiplier)
  
  if (record.count > effectiveLimit) {
    return true // Rate limited
  }

  return false
}

// Limpar cache periodicamente para evitar vazamento de memória
declare global {
  var abuseDetectionCleanupInterval: NodeJS.Timeout | undefined
}

if (typeof globalThis !== 'undefined' && !globalThis.abuseDetectionCleanupInterval) {
  globalThis.abuseDetectionCleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [key, record] of requestCounts.entries()) {
      if (now > record.resetTime) {
        requestCounts.delete(key)
      }
    }
  }, 60 * 1000) // Limpar a cada minuto
}