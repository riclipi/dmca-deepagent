import { NextRequest, NextResponse } from 'next/server'
import { RemovalVerificationAgent } from '@/lib/agents/RemovalVerificationAgent'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const verificationAgent = new RemovalVerificationAgent()

// POST /api/takedown/verify-removal
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { takedownRequestId } = await request.json()

    if (!takedownRequestId) {
      return NextResponse.json(
        { error: 'takedownRequestId é obrigatório' },
        { status: 400 }
      )
    }

    // Iniciar verificação de remoção
    const sessionId = await verificationAgent.initiateRemovalVerification(takedownRequestId)

    return NextResponse.json({
      success: true,
      sessionId,
      message: 'Verificação de remoção iniciada'
    })

  } catch (error: any) {
    console.error('Erro na verificação de remoção:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// GET /api/takedown/verify-removal?url=...
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    const { searchParams } = new URL(request.url)
    const url = searchParams.get('url')

    if (!url) {
      return NextResponse.json(
        { error: 'URL é obrigatória' },
        { status: 400 }
      )
    }

    // Buscar histórico de verificações para a URL
    const history = await verificationAgent.getVerificationHistory(url)

    return NextResponse.json({
      success: true,
      data: {
        url,
        verificationHistory: history,
        totalVerifications: history.length,
        lastVerification: history[0] || null
      }
    })

  } catch (error: any) {
    console.error('Erro ao buscar histórico de verificações:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
