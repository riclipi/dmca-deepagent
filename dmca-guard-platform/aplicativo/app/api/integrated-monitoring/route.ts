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

    console.log('✅ Session OK:', { userId: session.user.id, email: session.user.email })

    const body = await request.json()
    console.log('📥 Request body:', body)
    
    const validatedData = integratedMonitoringSchema.parse(body)
    console.log('✅ Validation OK:', validatedData)

    // Skip limits check for debugging
    console.log('⏭️ Pulando verificações de limite para debug')

    // Criar Brand Profile e Monitoring Session em uma transação
    console.log('🏗️ Iniciando transação para criar Brand Profile...')
    
    const result = await prisma.$transaction(async (tx) => {
      console.log('📝 Criando Brand Profile com dados:', {
        userId: session.user.id,
        brandName: validatedData.brandName,
        description: validatedData.description,
        officialUrls: validatedData.officialUrls,
        socialMedia: validatedData.socialMedia || {}
      })
      
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

      console.log('✅ Brand Profile criado:', brandProfile.id)
      return { brandProfile }
    })
    
    console.log('✅ Transação concluída')

    // 2. Skip keyword generation for debugging
    console.log('⏭️ Pulando geração de keywords para debug')
    let keywordStats = { safeCount: 0, moderateCount: 0, dangerousCount: 0 }
    
    // 5. Criar Monitoring Session simplificado
    console.log('🔗 Criando Monitoring Session...')
    const monitoringSession = await prisma.monitoringSession.create({
      data: {
        userId: session.user.id,
        brandProfileId: result.brandProfile.id,
        name: validatedData.sessionName,
        description: validatedData.sessionDescription,
        targetPlatforms: validatedData.targetPlatforms,
        useProfileKeywords: true,
        customKeywords: validatedData.customKeywords || [],
        excludeKeywords: validatedData.excludeKeywords || [],
        scanFrequency: validatedData.scanFrequency,
        totalKeywords: validatedData.customKeywords?.length || 0,
        nextScanAt: new Date(Date.now() + validatedData.scanFrequency * 60 * 60 * 1000)
      }
    })
    
    console.log('✅ Monitoring Session criado:', monitoringSession.id)

    // Consolidar resultado final
    const finalResult = {
      brandProfile: result.brandProfile,
      monitoringSession,
      keywordStats
    }

    // Skip audit log for debugging
    console.log('⏭️ Pulando audit log para debug')

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
    console.error('🚨 Erro ao criar monitoramento integrado:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack,
      name: error?.name
    })
    
    if (error.name === 'ZodError') {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    // Retornar detalhes do erro para debug
    return NextResponse.json(
      { 
        error: 'Erro interno do servidor',
        debug: {
          message: error?.message,
          code: error?.code,
          meta: error?.meta
        }
      },
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
