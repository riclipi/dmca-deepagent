// lib/api-response.ts
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export interface ApiResponseMeta {
  timestamp?: string
  version?: string
  requestId?: string
  [key: string]: any
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface ApiErrorDetail {
  field?: string
  message: string
  code?: string
}

/**
 * Classe padronizada para respostas de API
 * Garante consistência em todas as respostas
 */
export class ApiResponse {
  /**
   * Resposta de sucesso genérica
   */
  static success<T = any>(
    data: T,
    meta?: ApiResponseMeta,
    status: number = 200
  ): NextResponse {
    return NextResponse.json(
      {
        success: true,
        data,
        meta: {
          timestamp: new Date().toISOString(),
          ...meta
        }
      },
      { status }
    )
  }

  /**
   * Resposta de criação (201 Created)
   */
  static created<T = any>(
    data: T,
    meta?: ApiResponseMeta
  ): NextResponse {
    return this.success(data, meta, 201)
  }

  /**
   * Resposta sem conteúdo (204 No Content)
   */
  static noContent(): NextResponse {
    return new NextResponse(null, { status: 204 })
  }

  /**
   * Resposta de erro genérica
   */
  static error(
    message: string,
    status: number = 500,
    errors?: ApiErrorDetail[],
    meta?: ApiResponseMeta
  ): NextResponse {
    return NextResponse.json(
      {
        success: false,
        error: {
          message,
          errors
        },
        meta: {
          timestamp: new Date().toISOString(),
          ...meta
        }
      },
      { status }
    )
  }

  /**
   * Erro de validação (400 Bad Request)
   */
  static validationError(
    error: ZodError | ApiErrorDetail[],
    message: string = 'Dados inválidos'
  ): NextResponse {
    let errors: ApiErrorDetail[]

    if (error instanceof ZodError) {
      errors = error.errors.map(err => ({
        field: err.path.join('.'),
        message: err.message,
        code: err.code
      }))
    } else {
      errors = error
    }

    return this.error(message, 400, errors)
  }

  /**
   * Não autorizado (401 Unauthorized)
   */
  static unauthorized(
    message: string = 'Não autorizado'
  ): NextResponse {
    return this.error(message, 401)
  }

  /**
   * Proibido (403 Forbidden)
   */
  static forbidden(
    message: string = 'Acesso negado'
  ): NextResponse {
    return this.error(message, 403)
  }

  /**
   * Não encontrado (404 Not Found)
   */
  static notFound(
    resource: string = 'Recurso'
  ): NextResponse {
    return this.error(`${resource} não encontrado`, 404)
  }

  /**
   * Bad Request (400 Bad Request)
   */
  static badRequest(
    message: string = 'Requisição inválida',
    errors?: ApiErrorDetail[]
  ): NextResponse {
    return this.error(message, 400, errors)
  }

  /**
   * Conflito (409 Conflict)
   */
  static conflict(
    message: string = 'Conflito ao processar requisição'
  ): NextResponse {
    return this.error(message, 409)
  }

  /**
   * Rate limit excedido (429 Too Many Requests)
   */
  static tooManyRequests(
    message: string = 'Muitas requisições. Tente novamente mais tarde.',
    retryAfter?: number
  ): NextResponse {
    const response = this.error(message, 429)
    
    if (retryAfter) {
      response.headers.set('Retry-After', retryAfter.toString())
    }
    
    return response
  }

  /**
   * Erro interno do servidor (500 Internal Server Error)
   */
  static serverError(
    error: any,
    isDevelopment: boolean = process.env.NODE_ENV === 'development'
  ): NextResponse {
    console.error('[API Error]', error)

    const message = isDevelopment && error instanceof Error
      ? error.message
      : 'Erro interno do servidor'

    const meta: ApiResponseMeta = {
      timestamp: new Date().toISOString()
    }

    if (isDevelopment && error instanceof Error) {
      meta.stack = error.stack
      meta.name = error.name
    }

    return this.error(message, 500, undefined, meta)
  }

  /**
   * Resposta paginada
   */
  static paginated<T = any>(
    data: T[],
    total: number,
    page: number,
    limit: number,
    meta?: ApiResponseMeta
  ): NextResponse {
    const totalPages = Math.ceil(total / limit)
    const paginationMeta: PaginationMeta = {
      page,
      limit,
      total,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1
    }

    return NextResponse.json({
      success: true,
      data,
      pagination: paginationMeta,
      meta: {
        timestamp: new Date().toISOString(),
        ...meta
      }
    })
  }

  /**
   * Resposta aceita para processamento assíncrono (202 Accepted)
   */
  static accepted<T = any>(
    data: T,
    location?: string,
    meta?: ApiResponseMeta
  ): NextResponse {
    const response = this.success(data, meta, 202)
    
    if (location) {
      response.headers.set('Location', location)
    }
    
    return response
  }

  /**
   * Helper para adicionar headers de rate limit
   */
  static withRateLimit(
    response: NextResponse,
    limit: number,
    remaining: number,
    reset: Date
  ): NextResponse {
    response.headers.set('X-RateLimit-Limit', limit.toString())
    response.headers.set('X-RateLimit-Remaining', remaining.toString())
    response.headers.set('X-RateLimit-Reset', reset.toISOString())
    
    return response
  }

  /**
   * Helper para adicionar headers de cache
   */
  static withCache(
    response: NextResponse,
    maxAge: number = 0,
    sMaxAge: number = 0,
    staleWhileRevalidate: number = 0
  ): NextResponse {
    const directives: string[] = []
    
    if (maxAge === 0) {
      directives.push('no-cache', 'no-store', 'must-revalidate')
    } else {
      directives.push(`max-age=${maxAge}`)
      
      if (sMaxAge > 0) {
        directives.push(`s-maxage=${sMaxAge}`)
      }
      
      if (staleWhileRevalidate > 0) {
        directives.push(`stale-while-revalidate=${staleWhileRevalidate}`)
      }
    }
    
    response.headers.set('Cache-Control', directives.join(', '))
    
    return response
  }

  /**
   * Helper para adicionar CORS headers
   */
  static withCORS(
    response: NextResponse,
    origin: string = '*',
    methods: string[] = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    headers: string[] = ['Content-Type', 'Authorization']
  ): NextResponse {
    response.headers.set('Access-Control-Allow-Origin', origin)
    response.headers.set('Access-Control-Allow-Methods', methods.join(', '))
    response.headers.set('Access-Control-Allow-Headers', headers.join(', '))
    
    return response
  }
}