// app/api/integrations/gmail/route.ts - Gmail integration management

import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { gmailService } from '@/lib/services/gmail-secure'

// GET - Obter status da integração ou URL de autenticação
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const searchParams = request.nextUrl.searchParams
    const action = searchParams.get('action')

    if (action === 'auth-url') {
      // Gerar URL de autenticação
      const authUrl = gmailService.generateAuthUrl(session.user.id)
      return NextResponse.json({ authUrl })
    }

    // Verificar status da integração
    const status = await gmailService.checkIntegrationStatus(session.user.id)
    return NextResponse.json(status)
  } catch (error) {
    console.error('Gmail integration error:', error)
    return NextResponse.json(
      { error: 'Erro ao verificar integração' },
      { status: 500 }
    )
  }
}

// DELETE - Desconectar integração
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    await gmailService.disconnectIntegration(session.user.id)
    
    return NextResponse.json({ 
      success: true,
      message: 'Integração com Gmail desconectada' 
    })
  } catch (error) {
    console.error('Gmail disconnect error:', error)
    return NextResponse.json(
      { error: 'Erro ao desconectar integração' },
      { status: 500 }
    )
  }
}

// POST - Buscar alertas do Gmail
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { maxResults = 20, daysBack = 7 } = body

    try {
      const alerts = await gmailService.fetchGoogleAlerts(session.user.id, {
        maxResults,
        daysBack
      })

      return NextResponse.json({
        success: true,
        alerts,
        count: alerts.length
      })
    } catch (error: any) {
      if (error.message?.includes('não autenticado')) {
        return NextResponse.json(
          { error: 'Gmail não conectado. Faça a autenticação primeiro.' },
          { status: 401 }
        )
      }
      throw error
    }
  } catch (error) {
    console.error('Gmail fetch alerts error:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar alertas do Gmail' },
      { status: 500 }
    )
  }
}