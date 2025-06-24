import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { brandProfileSchema } from '@/lib/validations'
import { createAuditLog, getClientIP } from '@/lib/audit'

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params;
    const brandProfile = await prisma.brandProfile.findFirst({
      where: {
        id: id,
        userId: session.user.id
      },
      include: {
        _count: {
          select: {
            monitoringSessions: true,
            detectedContent: true
          }
        }
      }
    })

    if (!brandProfile) {
      return NextResponse.json(
        { error: 'Perfil de marca não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json(brandProfile)

  } catch (error) {
    console.error('Erro ao buscar perfil de marca:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params;
    const body = await request.json()
    const validatedData = brandProfileSchema.parse(body)

    const brandProfile = await prisma.brandProfile.findFirst({
      where: {
        id: id,
        userId: session.user.id
      }
    })

    if (!brandProfile) {
      return NextResponse.json(
        { error: 'Perfil de marca não encontrado' },
        { status: 404 }
      )
    }

    const updatedBrandProfile = await prisma.brandProfile.update({
      where: { id: id },
      data: {
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
      'brand_profile_update',
      'brand_profile',
      { brandProfileId: updatedBrandProfile.id, brandName: updatedBrandProfile.brandName },
      {
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined
      }
    )

    return NextResponse.json(updatedBrandProfile)

  } catch (error: any) {
    console.error('Erro ao atualizar perfil de marca:', error)
    
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { id } = await params;
    const brandProfile = await prisma.brandProfile.findFirst({
      where: {
        id: id,
        userId: session.user.id
      }
    })

    if (!brandProfile) {
      return NextResponse.json(
        { error: 'Perfil de marca não encontrado' },
        { status: 404 }
      )
    }

    // Soft delete
    await prisma.brandProfile.update({
      where: { id: id },
      data: { isActive: false }
    })

    // Log de auditoria
    await createAuditLog(
      session.user.id,
      'brand_profile_delete',
      'brand_profile',
      { brandProfileId: brandProfile.id, brandName: brandProfile.brandName },
      {
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined
      }
    )

    return NextResponse.json({ message: 'Perfil de marca removido com sucesso' })

  } catch (error) {
    console.error('Erro ao remover perfil de marca:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

