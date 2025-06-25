import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { createAuditLog, getClientIP } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const brandProfileId = url.searchParams.get('brandProfileId')
    const limit = parseInt(url.searchParams.get('limit') || '50')
    const offset = parseInt(url.searchParams.get('offset') || '0')

    const where: any = {
      userId: session.user.id
    }

    if (status) {
      where.status = status
    }

    if (brandProfileId) {
      where.brandProfileId = brandProfileId
    }

    const [reviews, total] = await Promise.all([
      prisma.keywordReview.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: [
          { riskScore: 'desc' },
          { createdAt: 'desc' }
        ],
        take: limit,
        skip: offset
      }),
      prisma.keywordReview.count({ where })
    ])

    // Buscar informações dos brand profiles
    const brandProfileIds = [...new Set(reviews.map(r => r.brandProfileId))]
    const brandProfiles = await prisma.brandProfile.findMany({
      where: {
        id: { in: brandProfileIds },
        userId: session.user.id
      },
      select: {
        id: true,
        brandName: true
      }
    })

    const brandProfileMap = Object.fromEntries(
      brandProfiles.map(bp => [bp.id, bp])
    )

    const reviewsWithBrandInfo = reviews.map(review => ({
      ...review,
      brandProfile: brandProfileMap[review.brandProfileId]
    }))

    return NextResponse.json({
      reviews: reviewsWithBrandInfo,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total
      },
      stats: {
        pending: reviews.filter(r => r.status === 'PENDING').length,
        approved: reviews.filter(r => r.status === 'APPROVED').length,
        rejected: reviews.filter(r => r.status === 'REJECTED').length,
        averageRiskScore: reviews.length > 0 
          ? Math.round(reviews.reduce((sum, r) => sum + r.riskScore, 0) / reviews.length)
          : 0
      }
    })

  } catch (error) {
    console.error('Erro ao buscar reviews de keywords:', error)
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
    const { reviewId, action, notes } = body

    if (!reviewId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'reviewId e action (approve/reject) são obrigatórios' },
        { status: 400 }
      )
    }

    // Verificar se o review pertence ao usuário
    const existingReview = await prisma.keywordReview.findFirst({
      where: {
        id: reviewId,
        userId: session.user.id
      },
      include: {
        user: {
          select: {
            id: true,
            name: true
          }
        }
      }
    })

    if (!existingReview) {
      return NextResponse.json(
        { error: 'Review não encontrado' },
        { status: 404 }
      )
    }

    if (existingReview.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Review já foi processado' },
        { status: 400 }
      )
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'
    const isApproved = action === 'approve'

    // Atualizar review em uma transação
    const result = await prisma.$transaction(async (tx) => {
      // Atualizar o review
      const updatedReview = await tx.keywordReview.update({
        where: { id: reviewId },
        data: {
          status: newStatus,
          isApproved,
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          reviewNotes: notes || null
        }
      })

      // Se aprovado, mover keyword de moderate para safe no brand profile
      if (isApproved) {
        const brandProfile = await tx.brandProfile.findUnique({
          where: { id: existingReview.brandProfileId }
        })

        if (brandProfile) {
          const moderateKeywords = brandProfile.moderateKeywords || []
          const safeKeywords = brandProfile.safeKeywords || []

          // Remover da lista moderate e adicionar à safe
          const updatedModerateKeywords = moderateKeywords.filter(k => k !== existingReview.keyword)
          const updatedSafeKeywords = safeKeywords.includes(existingReview.keyword) 
            ? safeKeywords 
            : [...safeKeywords, existingReview.keyword]

          await tx.brandProfile.update({
            where: { id: existingReview.brandProfileId },
            data: {
              moderateKeywords: updatedModerateKeywords,
              safeKeywords: updatedSafeKeywords,
              lastKeywordUpdate: new Date()
            }
          })

          // Atualizar totalKeywords em sessões que usam este perfil
          await tx.monitoringSession.updateMany({
            where: {
              brandProfileId: existingReview.brandProfileId,
              useProfileKeywords: true,
              isActive: true
            },
            data: {
              totalKeywords: updatedSafeKeywords.length
            }
          })
        }
      }

      return updatedReview
    })

    // Log de auditoria
    await createAuditLog(
      session.user.id,
      'keyword_review',
      'keyword_review',
      {
        reviewId,
        keyword: existingReview.keyword,
        action,
        riskScore: existingReview.riskScore,
        brandProfileId: existingReview.brandProfileId,
        notes
      },
      {
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined
      }
    )

    return NextResponse.json({
      success: true,
      review: result,
      message: `Keyword "${existingReview.keyword}" ${action === 'approve' ? 'aprovada' : 'rejeitada'} com sucesso`
    })

  } catch (error) {
    console.error('Erro ao processar review de keyword:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const body = await request.json()
    const { reviewIds, action, notes } = body

    if (!reviewIds || !Array.isArray(reviewIds) || reviewIds.length === 0) {
      return NextResponse.json(
        { error: 'reviewIds deve ser um array não vazio' },
        { status: 400 }
      )
    }

    if (!['approve', 'reject', 'bulk_approve', 'bulk_reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Ação não válida' },
        { status: 400 }
      )
    }

    // Verificar se todos os reviews pertencem ao usuário
    const existingReviews = await prisma.keywordReview.findMany({
      where: {
        id: { in: reviewIds },
        userId: session.user.id,
        status: 'PENDING'
      }
    })

    if (existingReviews.length !== reviewIds.length) {
      return NextResponse.json(
        { error: 'Alguns reviews não foram encontrados ou já foram processados' },
        { status: 400 }
      )
    }

    const isApprove = action.includes('approve')
    const newStatus = isApprove ? 'APPROVED' : 'REJECTED'

    // Processar em lote
    const results = await prisma.$transaction(async (tx) => {
      // Atualizar todos os reviews
      const updatedReviews = await tx.keywordReview.updateMany({
        where: {
          id: { in: reviewIds },
          userId: session.user.id
        },
        data: {
          status: newStatus,
          isApproved: isApprove,
          reviewedBy: session.user.id,
          reviewedAt: new Date(),
          reviewNotes: notes || null
        }
      })

      // Se aprovados, atualizar brand profiles
      if (isApprove) {
        const brandProfileUpdates = new Map<string, { moderate: string[], safe: string[] }>()

        // Agrupar por brand profile
        for (const review of existingReviews) {
          if (!brandProfileUpdates.has(review.brandProfileId)) {
            const brandProfile = await tx.brandProfile.findUnique({
              where: { id: review.brandProfileId }
            })
            
            if (brandProfile) {
              brandProfileUpdates.set(review.brandProfileId, {
                moderate: [...(brandProfile.moderateKeywords || [])],
                safe: [...(brandProfile.safeKeywords || [])]
              })
            }
          }

          const update = brandProfileUpdates.get(review.brandProfileId)
          if (update) {
            // Remover da moderate, adicionar à safe
            update.moderate = update.moderate.filter(k => k !== review.keyword)
            if (!update.safe.includes(review.keyword)) {
              update.safe.push(review.keyword)
            }
          }
        }

        // Aplicar atualizações aos brand profiles
        for (const [brandProfileId, update] of brandProfileUpdates) {
          await tx.brandProfile.update({
            where: { id: brandProfileId },
            data: {
              moderateKeywords: update.moderate,
              safeKeywords: update.safe,
              lastKeywordUpdate: new Date()
            }
          })

          // Atualizar sessões
          await tx.monitoringSession.updateMany({
            where: {
              brandProfileId,
              useProfileKeywords: true,
              isActive: true
            },
            data: {
              totalKeywords: update.safe.length
            }
          })
        }
      }

      return updatedReviews
    })

    // Log de auditoria
    await createAuditLog(
      session.user.id,
      'keyword_bulk_review',
      'keyword_review',
      {
        reviewIds,
        action,
        count: reviewIds.length,
        keywords: existingReviews.map(r => r.keyword),
        notes
      },
      {
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined
      }
    )

    return NextResponse.json({
      success: true,
      processed: results.count,
      message: `${results.count} keywords ${isApprove ? 'aprovadas' : 'rejeitadas'} com sucesso`
    })

  } catch (error) {
    console.error('Erro ao processar reviews em lote:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}