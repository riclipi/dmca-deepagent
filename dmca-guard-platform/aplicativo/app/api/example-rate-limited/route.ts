// app/api/example-rate-limited/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { checkRateLimit } from '@/lib/middleware/rate-limit-advanced'

/**
 * Exemplo de API route com rate limiting customizado
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    // Rate limiting customizado para esta rota específica
    const { success, headers } = await checkRateLimit(request, {
      identifier: session?.user?.id || request.headers.get('x-forwarded-for') || 'anonymous',
      namespace: 'example-api',
      requests: 10, // 10 requisições
      window: '1m' // por minuto
    })

    // Se rate limit excedido
    if (!success) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too Many Requests',
          message: 'Você excedeu o limite de requisições. Tente novamente em breve.'
        }),
        {
          status: 429,
          headers: {
            ...Object.fromEntries(headers.entries()),
            'Content-Type': 'application/json'
          }
        }
      )
    }

    // Lógica normal da API
    const response = NextResponse.json({
      success: true,
      message: 'Requisição processada com sucesso',
      timestamp: new Date().toISOString(),
      user: session?.user?.email || 'anonymous'
    })

    // Adicionar headers de rate limit na resposta bem-sucedida
    headers.forEach((value, key) => {
      response.headers.set(key, value)
    })

    return response

  } catch (error) {
    console.error('[Example API] Error:', error)
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }
}

/**
 * POST com rate limiting diferente
 */
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  
  // Rate limiting mais restritivo para POST
  const { success, headers } = await checkRateLimit(request, {
    identifier: session?.user?.id || request.headers.get('x-forwarded-for') || 'anonymous',
    namespace: 'example-api-post',
    requests: 5, // apenas 5 requisições
    window: '5m' // por 5 minutos
  })

  if (!success) {
    return new NextResponse(
      JSON.stringify({
        error: 'Too Many Requests',
        message: 'Muitas tentativas de criação. Aguarde antes de tentar novamente.'
      }),
      {
        status: 429,
        headers: {
          ...Object.fromEntries(headers.entries()),
          'Content-Type': 'application/json'
        }
      }
    )
  }

  // Processar POST
  const body = await request.json()
  
  const response = NextResponse.json({
    success: true,
    message: 'Recurso criado com sucesso',
    data: body
  })

  // Adicionar headers
  headers.forEach((value, key) => {
    response.headers.set(key, value)
  })

  return response
}