import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog, getClientIP } from '@/lib/audit'
import { canPerformAction, getPlanLimits } from '@/lib/plans'
import { KeywordIntegrationService } from '@/lib/services/keyword-integration'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

// Schema de validação para criação integrada
const integratedMonitoringSchema = z.object({
  // Brand Profile data
  brandName: z.string().min(2, 'Nome da marca deve ter pelo menos 2 caracteres'),
  description: z.string().optional(),
  officialUrls: z.array(z.string().url()).default([]),
  socialMedia: z.record(z.string()).optional(),
  
  // Monitoring Session data
  sessionName: z.string().min(3, 'Nome da sessão deve ter pelo menos 3 caracteres'),
  sessionDescription: z.string().optional(),
  targetPlatforms: z.array(z.string()).min(1, 'Selecione pelo menos uma plataforma'),
  scanFrequency: z.number().min(1, 'Frequência deve ser pelo menos 1 hora'),
  customKeywords: z.array(z.string()).default([]),
  excludeKeywords: z.array(z.string()).default([]),
  
  // Keywords generation options
  generateKeywords: z.boolean().default(true),
  keywordConfig: z.object({
    minLength: z.number().default(4),
    maxVariations: z.number().default(30),
    includeLeetspeakLight: z.boolean().default(true),
    includeSeparators: z.boolean().default(true),
    includeSpacing: z.boolean().default(true)
  }).optional()
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = integratedMonitoringSchema.parse(body)

    // Verificar limites do plano para brand profiles
    const currentBrandProfiles = await prisma.brandProfile.count({
      where: {
        userId: session.user.id,
        isActive: true
      }
    })

    if (!canPerformAction(session.user.planType, 'createBrandProfile', currentBrandProfiles)) {
      const limits = getPlanLimits(session.user.planType)
      return NextResponse.json(
        { error: `Limite de perfis de marca atingido (${limits.brandProfiles}). Faça upgrade do seu plano.` },
        { status: 403 }
      )
    }

    // Verificar limites do plano para monitoring sessions
    const currentSessions = await prisma.monitoringSession.count({
      where: {
        userId: session.user.id,
        isActive: true
      }
    })

    if (!canPerformAction(session.user.planType, 'createMonitoringSession', currentSessions)) {
      const limits = getPlanLimits(session.user.planType)
      return NextResponse.json(
        { error: `Limite de sessões de monitoramento atingido (${limits.monitoringSessions}). Faça upgrade do seu plano.` },
        { status: 403 }
      )
    }

    // Verificar frequência de scan baseada no plano
    const planLimits = getPlanLimits(session.user.planType)
    if (validatedData.scanFrequency < planLimits.scanFrequency) {
      return NextResponse.json(
        { error: `Frequência de scan muito alta para seu plano. Mínimo: ${planLimits.scanFrequency} horas.` },
        { status: 403 }
      )
    }

    // Criar Brand Profile e Monitoring Session em uma transação
    const result = await prisma.$transaction(async (tx) => {
      // 1. Criar Brand Profile
      const brandProfile = await tx.brandProfile.create({
        data: {
          userId: session.user.id,
          brandName: validatedData.brandName,
          description: validatedData.description,
          officialUrls: validatedData.officialUrls,
          socialMedia: validatedData.socialMedia || {},
          keywords: [], // Legacy field, will be replaced by safe keywords
          isActive: true
        }
      })

      return { brandProfile }
    })

    // 2. Gerar keywords seguras APÓS a transação
    let keywordStats = { safeCount: 0, moderateCount: 0, dangerousCount: 0 }
    if (validatedData.generateKeywords) {
      try {
        const keywordResult = await KeywordIntegrationService.ensureSafeKeywords(
          result.brandProfile.id, 
          false // não forçar regeneração
        )
        keywordStats = keywordResult
      } catch (error) {
        console.warn('Erro ao gerar keywords seguras:', error)
        // Continuar mesmo se a geração de keywords falhar
      }
    }

    // 3. Obter keywords seguras atualizadas
    const updatedProfile = await prisma.brandProfile.findUnique({
      where: { id: result.brandProfile.id },
      select: { safeKeywords: true }
    })

    // 4. Calcular total de keywords para a sessão
    const profileKeywordsCount = updatedProfile?.safeKeywords?.length || 0
    
    // Filtrar keywords customizadas válidas (não vazias)
    const validCustomKeywords = validatedData.customKeywords.filter(k => k && k.trim().length > 0)
    
    // Calcular total considerando keywords do perfil + customizadas - excluídas
    let totalKeywords = 0
    if (validatedData.generateKeywords) {
      totalKeywords += profileKeywordsCount
    }
    totalKeywords += validCustomKeywords.length
    totalKeywords -= validatedData.excludeKeywords.length
    
    console.log(`📊 Cálculo de keywords:`)
    console.log(`   Profile keywords: ${profileKeywordsCount}`)
    console.log(`   Custom keywords: ${validCustomKeywords.length}`)
    console.log(`   Exclude keywords: ${validatedData.excludeKeywords.length}`)
    console.log(`   Total calculado: ${totalKeywords}`)

    // 5. Criar Monitoring Session
    const monitoringSession = await prisma.monitoringSession.create({
      data: {
        userId: session.user.id,
        brandProfileId: result.brandProfile.id,
        name: validatedData.sessionName,
        description: validatedData.sessionDescription,
        targetPlatforms: validatedData.targetPlatforms,
        useProfileKeywords: true, // Sempre usar keywords do perfil
        customKeywords: validCustomKeywords,
        excludeKeywords: validatedData.excludeKeywords,
        scanFrequency: validatedData.scanFrequency,
        totalKeywords: Math.max(0, totalKeywords), // Garantir que não seja negativo
        nextScanAt: new Date(Date.now() + validatedData.scanFrequency * 60 * 60 * 1000)
      }
    })

    // Consolidar resultado final
    const finalResult = {
      brandProfile: result.brandProfile,
      monitoringSession,
      keywordStats
    }

    // Log de auditoria
    await createAuditLog(
      session.user.id,
      'integrated_monitoring_create',
      'integrated_monitoring',
      { 
        brandProfileId: finalResult.brandProfile.id,
        brandName: finalResult.brandProfile.brandName,
        monitoringSessionId: finalResult.monitoringSession.id,
        sessionName: finalResult.monitoringSession.name,
        keywordStats: finalResult.keywordStats
      },
      {
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined
      }
    )

    // Resposta com dados completos
    const response = {
      success: true,
      message: 'Brand Profile e Sessão de Monitoramento criados com sucesso!',
      brandProfile: {
        id: finalResult.brandProfile.id,
        brandName: finalResult.brandProfile.brandName,
        description: finalResult.brandProfile.description,
        isActive: finalResult.brandProfile.isActive
      },
      monitoringSession: {
        id: finalResult.monitoringSession.id,
        name: finalResult.monitoringSession.name,
        description: finalResult.monitoringSession.description,
        targetPlatforms: finalResult.monitoringSession.targetPlatforms,
        scanFrequency: finalResult.monitoringSession.scanFrequency,
        totalKeywords: finalResult.monitoringSession.totalKeywords,
        status: finalResult.monitoringSession.status
      },
      keywords: {
        generated: validatedData.generateKeywords,
        safeCount: finalResult.keywordStats.safeCount,
        moderateCount: finalResult.keywordStats.moderateCount,
        dangerousCount: finalResult.keywordStats.dangerousCount,
        totalKeywordsInSession: finalResult.monitoringSession.totalKeywords
      }
    }

    return NextResponse.json(response, { status: 201 })

  } catch (error: any) {
    console.error('Erro ao criar monitoramento integrado:', error)
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Buscar todos os monitoramentos integrados do usuário
    const integratedMonitoring = await prisma.brandProfile.findMany({
      where: {
        userId: session.user.id,
        isActive: true
      },
      include: {
        monitoringSessions: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            description: true,
            status: true,
            targetPlatforms: true,
            totalKeywords: true,
            processedKeywords: true,
            progress: true,
            resultsFound: true,
            lastScanAt: true,
            nextScanAt: true,
            createdAt: true
          }
        },
        _count: {
          select: {
            monitoringSessions: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    // Estatísticas gerais
    const stats = {
      totalBrandProfiles: integratedMonitoring.length,
      totalSessions: integratedMonitoring.reduce((acc, bp) => acc + bp.monitoringSessions.length, 0),
      activeSessions: integratedMonitoring.reduce((acc, bp) => 
        acc + bp.monitoringSessions.filter(s => s.status === 'RUNNING').length, 0
      ),
      totalKeywords: integratedMonitoring.reduce((acc, bp) => 
        acc + (bp.safeKeywords?.length || 0), 0
      ),
      totalResults: integratedMonitoring.reduce((acc, bp) => 
        acc + bp.monitoringSessions.reduce((sessAcc, sess) => sessAcc + sess.resultsFound, 0), 0
      )
    }

    return NextResponse.json({
      integratedMonitoring,
      stats
    })

  } catch (error) {
    console.error('Erro ao buscar monitoramentos integrados:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
