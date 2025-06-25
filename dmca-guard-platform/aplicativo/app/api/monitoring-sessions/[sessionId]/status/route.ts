import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { SessionStatus } from '@prisma/client'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const monitoringSession = await prisma.monitoringSession.findFirst({
      where: {
        id: params.sessionId,
        userId: session.user.id,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        status: true,
        currentKeyword: true,
        progress: true,
        totalKeywords: true,
        processedKeywords: true,
        resultsFound: true,
        lastScanAt: true,
        nextScanAt: true,
        brandProfile: {
          select: {
            id: true,
            brandName: true,
            safeKeywords: true
          }
        }
      }
    })

    if (!monitoringSession) {
      return NextResponse.json(
        { error: 'Sessão de monitoramento não encontrada' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      id: monitoringSession.id,
      name: monitoringSession.name,
      status: monitoringSession.status,
      currentKeyword: monitoringSession.currentKeyword,
      progress: monitoringSession.progress,
      totalKeywords: monitoringSession.totalKeywords,
      processedKeywords: monitoringSession.processedKeywords,
      resultsFound: monitoringSession.resultsFound,
      lastScanAt: monitoringSession.lastScanAt,
      nextScanAt: monitoringSession.nextScanAt,
      brandProfile: {
        id: monitoringSession.brandProfile.id,
        brandName: monitoringSession.brandProfile.brandName,
        keywordCount: monitoringSession.brandProfile.safeKeywords?.length || 0
      },
      progressPercentage: monitoringSession.totalKeywords > 0 
        ? Math.round((monitoringSession.processedKeywords / monitoringSession.totalKeywords) * 100)
        : 0,
      isRunning: monitoringSession.status === 'RUNNING',
      isPaused: monitoringSession.status === 'PAUSED',
      isCompleted: monitoringSession.status === 'COMPLETED',
      hasError: monitoringSession.status === 'ERROR'
    })

  } catch (error) {
    console.error('Erro ao buscar status da sessão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { 
      status, 
      currentKeyword, 
      progress, 
      totalKeywords, 
      processedKeywords, 
      resultsFound 
    } = body

    // Verificar se a sessão pertence ao usuário
    const existingSession = await prisma.monitoringSession.findFirst({
      where: {
        id: params.sessionId,
        userId: session.user.id,
        isActive: true
      }
    })

    if (!existingSession) {
      return NextResponse.json(
        { error: 'Sessão de monitoramento não encontrada' },
        { status: 404 }
      )
    }

    const updateData: any = {}
    
    if (status && Object.values(SessionStatus).includes(status)) {
      updateData.status = status
    }
    
    if (currentKeyword !== undefined) {
      updateData.currentKeyword = currentKeyword
    }
    
    if (typeof progress === 'number' && progress >= 0 && progress <= 100) {
      updateData.progress = Math.round(progress)
    }
    
    if (typeof totalKeywords === 'number' && totalKeywords >= 0) {
      updateData.totalKeywords = totalKeywords
    }
    
    if (typeof processedKeywords === 'number' && processedKeywords >= 0) {
      updateData.processedKeywords = processedKeywords
    }
    
    if (typeof resultsFound === 'number' && resultsFound >= 0) {
      updateData.resultsFound = resultsFound
    }

    // Atualizar timestamps relevantes
    if (status === 'RUNNING' && existingSession.status !== 'RUNNING') {
      updateData.lastScanAt = new Date()
    }

    if (status === 'COMPLETED') {
      updateData.currentKeyword = null
      updateData.progress = 100
      updateData.lastScanAt = new Date()
      // Agendar próximo scan
      if (existingSession.scanFrequency) {
        updateData.nextScanAt = new Date(Date.now() + existingSession.scanFrequency * 60 * 60 * 1000)
        updateData.status = 'IDLE' // Voltar para IDLE após completar
      }
    }

    const updatedSession = await prisma.monitoringSession.update({
      where: { id: params.sessionId },
      data: updateData,
      select: {
        id: true,
        status: true,
        currentKeyword: true,
        progress: true,
        totalKeywords: true,
        processedKeywords: true,
        resultsFound: true,
        lastScanAt: true,
        nextScanAt: true
      }
    })

    return NextResponse.json({
      success: true,
      session: updatedSession,
      message: `Status da sessão atualizado para ${status || 'atual'}`
    })

  } catch (error) {
    console.error('Erro ao atualizar status da sessão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { action } = body

    // Verificar se a sessão pertence ao usuário
    const monitoringSession = await prisma.monitoringSession.findFirst({
      where: {
        id: params.sessionId,
        userId: session.user.id,
        isActive: true
      }
    })

    if (!monitoringSession) {
      return NextResponse.json(
        { error: 'Sessão de monitoramento não encontrada' },
        { status: 404 }
      )
    }

    let updateData: any = {}
    let message = ''

    switch (action) {
      case 'start':
        if (monitoringSession.status === 'IDLE' || monitoringSession.status === 'PAUSED') {
          updateData = {
            status: SessionStatus.RUNNING,
            lastScanAt: new Date()
          }
          message = 'Sessão iniciada'
        } else {
          return NextResponse.json(
            { error: 'Sessão não pode ser iniciada no estado atual' },
            { status: 400 }
          )
        }
        break

      case 'pause':
        if (monitoringSession.status === 'RUNNING') {
          updateData = {
            status: SessionStatus.PAUSED
          }
          message = 'Sessão pausada'
        } else {
          return NextResponse.json(
            { error: 'Apenas sessões em execução podem ser pausadas' },
            { status: 400 }
          )
        }
        break

      case 'stop':
        if (monitoringSession.status === 'RUNNING' || monitoringSession.status === 'PAUSED') {
          updateData = {
            status: SessionStatus.IDLE,
            currentKeyword: null,
            progress: 0,
            processedKeywords: 0
          }
          message = 'Sessão parada'
        } else {
          return NextResponse.json(
            { error: 'Sessão não pode ser parada no estado atual' },
            { status: 400 }
          )
        }
        break

      case 'reset':
        updateData = {
          status: SessionStatus.IDLE,
          currentKeyword: null,
          progress: 0,
          processedKeywords: 0,
          resultsFound: 0,
          totalKeywords: 0
        }
        message = 'Sessão resetada'
        break

      default:
        return NextResponse.json(
          { error: 'Ação não reconhecida' },
          { status: 400 }
        )
    }

    const updatedSession = await prisma.monitoringSession.update({
      where: { id: params.sessionId },
      data: updateData,
      select: {
        id: true,
        status: true,
        currentKeyword: true,
        progress: true,
        totalKeywords: true,
        processedKeywords: true,
        resultsFound: true
      }
    })

    return NextResponse.json({
      success: true,
      session: updatedSession,
      message
    })

  } catch (error) {
    console.error('Erro ao executar ação na sessão:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}