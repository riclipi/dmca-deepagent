import { NextRequest, NextResponse } from 'next/server'
import { RemovalVerificationAgent } from '@/lib/agents/RemovalVerificationAgent'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const verificationAgent = new RemovalVerificationAgent()

// POST /api/takedown/schedule-verifications
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      )
    }

    // Executar verificações recorrentes
    await verificationAgent.scheduleRecurringVerifications()

    return NextResponse.json({
      success: true,
      message: 'Verificações automáticas executadas com sucesso'
    })

  } catch (error: any) {
    console.error('Erro ao agendar verificações:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

// GET /api/takedown/schedule-verifications - Endpoint para cron jobs
export async function GET(request: NextRequest) {
  try {
    // Verificar se a requisição vem de um serviço autorizado (cron job)
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.CRON_SECRET_TOKEN

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json(
        { error: 'Token de autorização inválido' },
        { status: 401 }
      )
    }

    console.log('🕒 Executando verificações automáticas via cron job...')

    // Executar verificações recorrentes
    await verificationAgent.scheduleRecurringVerifications()

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: 'Verificações automáticas executadas via cron job'
    })

  } catch (error: any) {
    console.error('Erro no cron job de verificações:', error)
    return NextResponse.json(
      { error: error.message || 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
