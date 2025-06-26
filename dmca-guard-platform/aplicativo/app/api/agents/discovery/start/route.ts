import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { DiscoveryAgent, DiscoveryConfig } from '@/lib/agents/DiscoveryAgent'
import { z } from 'zod'

// Schema para validação do request
const StartDiscoverySchema = z.object({
  brandProfileId: z.string().uuid('ID do perfil da marca inválido'),
  config: z.object({
    maxQueriesPerSession: z.number().min(10).max(500).optional(),
    minConfidenceThreshold: z.number().min(0.1).max(1.0).optional(),
    enableHistoricalAnalysis: z.boolean().optional(),
    searchProviders: z.array(z.enum(['serper', 'google', 'bing'])).optional(),
    concurrency: z.number().min(1).max(10).optional(),
    respectRateLimits: z.boolean().optional()
  }).optional()
})

/**
 * POST /api/agents/discovery/start
 * Iniciar descoberta de novos sites
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Validar dados do request
    const body = await request.json()
    const validatedData = StartDiscoverySchema.parse(body)

    // Inicializar agente de descoberta
    const discoveryAgent = new DiscoveryAgent(
      session.user.id, 
      validatedData.brandProfileId,
      validatedData.config as Partial<DiscoveryConfig>
    )

    // Iniciar sessão de descoberta
    const sessionId = await discoveryAgent.startDiscoverySession()

    return NextResponse.json({
      success: true,
      sessionId,
      message: 'Descoberta de sites iniciada com sucesso',
      estimatedDuration: '20-45 minutos',
      config: validatedData.config
    })

  } catch (error) {
    console.error('Erro ao iniciar descoberta:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Dados inválidos',
          details: error.errors
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}

/**
 * GET /api/agents/discovery/start
 * Listar sessões de descoberta ativas
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const brandProfileId = searchParams.get('brandProfileId')

    // TODO: Implementar busca por sessões ativas no banco
    // Por enquanto, retornar array vazio
    const activeSessions: any[] = []

    return NextResponse.json({
      activeSessions,
      total: activeSessions.length
    })

  } catch (error) {
    console.error('Erro ao buscar sessões de descoberta:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
