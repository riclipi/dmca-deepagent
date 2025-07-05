// app/api/brand-profiles/[brandProfileId]/ownership/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ownershipValidationService } from '@/lib/services/security/ownership-validation.service'
import prisma from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { brandProfileId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { brandProfileId } = params

    // Verificar se o perfil pertence ao usuário
    const brandProfile = await prisma.brandProfile.findFirst({
      where: {
        id: brandProfileId,
        userId: session.user.id
      }
    })

    if (!brandProfile) {
      return NextResponse.json(
        { error: 'Perfil de marca não encontrado' },
        { status: 404 }
      )
    }

    // Obter instruções de verificação
    const instructions = await ownershipValidationService.getVerificationInstructions(brandProfileId)

    return NextResponse.json({
      success: true,
      brandProfile: {
        id: brandProfile.id,
        name: brandProfile.brandName,
        officialUrls: brandProfile.officialUrls
      },
      instructions
    })
  } catch (error) {
    console.error('[Ownership API] Error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { brandProfileId: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { brandProfileId } = params

    // Verificar se o perfil pertence ao usuário
    const brandProfile = await prisma.brandProfile.findFirst({
      where: {
        id: brandProfileId,
        userId: session.user.id
      }
    })

    if (!brandProfile) {
      return NextResponse.json(
        { error: 'Perfil de marca não encontrado' },
        { status: 404 }
      )
    }

    // Tentar validar propriedade
    try {
      await ownershipValidationService.validateBrandOwnership(
        session.user.id,
        brandProfile
      )

      return NextResponse.json({
        success: true,
        message: 'Propriedade validada com sucesso'
      })
    } catch (validationError: any) {
      return NextResponse.json(
        {
          success: false,
          error: validationError.message,
          requiresManualReview: validationError.message.includes('manual')
        },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('[Ownership API] Error:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}