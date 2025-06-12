
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { brandProfileSchema } from '@/lib/validations'
import { createAuditLog, getClientIP } from '@/lib/audit'
import { canPerformAction, getPlanLimits } from '@/lib/plans'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const brandProfiles = await prisma.brandProfile.findMany({
      where: {
        userId: session.user.id,
        isActive: true
      },
      include: {
        _count: {
          select: {
            monitoringSessions: true,
            detectedContent: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(brandProfiles)

  } catch (error) {
    console.error('Erro ao buscar perfis de marca:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = brandProfileSchema.parse(body)

    // Verificar limites do plano
    const currentCount = await prisma.brandProfile.count({
      where: {
        userId: session.user.id,
        isActive: true
      }
    })

    if (!canPerformAction(session.user.planType, 'createBrandProfile', currentCount)) {
      const limits = getPlanLimits(session.user.planType)
      return NextResponse.json(
        { 
          error: `Limite de perfis de marca atingido (${limits.brandProfiles}). Faça upgrade do seu plano.` 
        },
        { status: 403 }
      )
    }

    const brandProfile = await prisma.brandProfile.create({
      data: {
        userId: session.user.id,
        brandName: validatedData.brandName,
        description: validatedData.description,
        officialUrls: validatedData.officialUrls,
        socialMedia: validatedData.socialMedia,
        keywords: validatedData.keywords
      }
    })

    // Log de auditoria
    await createAuditLog(
      session.user.id,
      'brand_profile_create',
      'brand_profile',
      { brandProfileId: brandProfile.id, brandName: brandProfile.brandName },
      {
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined
      }
    )

    return NextResponse.json(brandProfile)

  } catch (error: any) {
    console.error('Erro ao criar perfil de marca:', error)
    
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
