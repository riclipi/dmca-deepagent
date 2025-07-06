// app/api/brand-profiles/create-with-validation/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { ownershipValidationService } from '@/lib/services/security/ownership-validation.service'
import { antiFloodingService } from '@/lib/services/security/anti-flooding.service'

// Schema de validação
const createBrandProfileSchema = z.object({
  brandName: z.string().min(2).max(100),
  description: z.string().optional(),
  officialUrls: z.array(z.string().url()).min(1),
  socialMedia: z.object({
    twitter: z.string().url().optional(),
    facebook: z.string().url().optional(),
    instagram: z.string().url().optional(),
    youtube: z.string().url().optional()
  }).optional(),
  keywords: z.array(z.string()).min(3).max(50)
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    // Verificar se usuário pode criar perfis (anti-flooding)
    const canCreate = await antiFloodingService.canUserPerformAction(
      session.user.id,
      'BRAND_PROFILE_CREATE'
    )

    if (!canCreate) {
      return NextResponse.json(
        { 
          error: 'Limite de criação de perfis excedido. Tente novamente mais tarde.',
          code: 'RATE_LIMIT_EXCEEDED'
        },
        { status: 429 }
      )
    }

    // Validar dados
    const body = await request.json()
    const validatedData = createBrandProfileSchema.parse(body)

    // Verificar duplicação de nome
    const existingProfile = await prisma.brandProfile.findFirst({
      where: {
        userId: session.user.id,
        brandName: {
          equals: validatedData.brandName,
          mode: 'insensitive'
        }
      }
    })

    if (existingProfile) {
      return NextResponse.json(
        { error: 'Já existe um perfil com este nome' },
        { status: 409 }
      )
    }

    // Validar keywords com anti-flooding
    const validatedKeywords = await antiFloodingService.validateKeywordCreation(
      session.user.id,
      validatedData.keywords,
      'temp-brand-id' // Será substituído após criar o perfil
    )

    // Criar perfil
    const brandProfile = await prisma.brandProfile.create({
      data: {
        userId: session.user.id,
        brandName: validatedData.brandName,
        description: validatedData.description,
        officialUrls: validatedData.officialUrls,
        socialMedia: validatedData.socialMedia || {},
        keywords: validatedKeywords,
        safeKeywords: validatedKeywords, // Inicialmente todas são consideradas seguras
        moderateKeywords: [],
        dangerousKeywords: []
      }
    })

    // Iniciar validação de propriedade em background
    try {
      await ownershipValidationService.validateBrandOwnership(
        session.user.id,
        brandProfile
      )
    } catch (validationError) {
      // Não bloquear criação, mas avisar sobre validação pendente
      console.log(`[API] Ownership validation pending for brand ${brandProfile.id}`)
    }

    // Registrar atividade
    await prisma.userActivity.create({
      data: {
        userId: session.user.id,
        action: 'BRAND_PROFILE_CREATE',
        metadata: {
          brandProfileId: brandProfile.id,
          brandName: brandProfile.brandName
        }
      }
    })

    return NextResponse.json({
      success: true,
      brandProfile,
      message: 'Perfil criado com sucesso. Validação de propriedade em andamento.',
      requiresValidation: true
    })

  } catch (error) {
    console.error('[API] Error creating brand profile:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { 
          error: 'Dados inválidos',
          details: error.errors
        },
        { status: 400 }
      )
    }

    if (error instanceof Error) {
      // Erros específicos do sistema anti-abuse
      if (error.message.includes('spam')) {
        return NextResponse.json(
          { 
            error: error.message,
            code: 'SPAM_DETECTED'
          },
          { status: 400 }
        )
      }

      if (error.message.includes('validação')) {
        return NextResponse.json(
          { 
            error: error.message,
            code: 'VALIDATION_REQUIRED'
          },
          { status: 400 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}