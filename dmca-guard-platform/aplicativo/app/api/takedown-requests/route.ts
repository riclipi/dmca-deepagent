import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { takedownRequestSchema } from '@/lib/validations'
import { generateDmcaNotice } from '@/lib/dmca-templates'
import { createAuditLog, getClientIP } from '@/lib/audit'
import { canPerformAction } from '@/lib/plans'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')

    const where: any = {
      userId: session.user.id
    }

    if (status) {
      where.status = status.toUpperCase()
    }

    const [takedownRequests, total] = await Promise.all([
      prisma.takedownRequest.findMany({
        where,
        include: {
          detectedContent: {
            select: {
              id: true,
              title: true,
              infringingUrl: true,
              platform: true,
              brandProfile: {
                select: {
                  id: true,
                  brandName: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit
      }),
      prisma.takedownRequest.count({ where })
    ])

    return NextResponse.json({
      data: takedownRequests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    })

  } catch (error) {
    console.error('Erro ao buscar solicitações de takedown:', error)
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
    const validatedData = takedownRequestSchema.parse(body)

    // Verificar limites do plano
    const currentMonth = new Date()
    currentMonth.setDate(1)
    currentMonth.setHours(0, 0, 0, 0)

    const takedownsThisMonth = await prisma.takedownRequest.count({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: currentMonth
        }
      }
    })

    if (!canPerformAction(session.user.planType, 'sendTakedown', takedownsThisMonth)) {
      return NextResponse.json(
        { error: 'Limite de takedowns mensais atingido. Faça upgrade do seu plano.' },
        { status: 403 }
      )
    }

    // Buscar conteúdo detectado e dados do usuário
    const [detectedContent, user] = await Promise.all([
      prisma.detectedContent.findFirst({
        where: {
          id: validatedData.detectedContentId,
          userId: session.user.id
        },
        include: {
          brandProfile: true
        }
      }),
      prisma.user.findUnique({
        where: { id: session.user.id }
      })
    ])

    if (!detectedContent) {
      return NextResponse.json(
        { error: 'Conteúdo não encontrado' },
        { status: 404 }
      )
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Gerar notificação DMCA
    const dmcaNotice = generateDmcaNotice('pt', {
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phone || undefined,
      infringingUrl: detectedContent.infringingUrl,
      contentDescription: detectedContent.title,
      originalUrl: detectedContent.brandProfile.officialUrls[0]
    })

    // Criar solicitação de takedown
    const takedownRequest = await prisma.takedownRequest.create({
      data: {
        userId: session.user.id,
        detectedContentId: validatedData.detectedContentId,
        platform: validatedData.platform,
        recipientEmail: validatedData.recipientEmail,
        subject: dmcaNotice.subject,
        message: validatedData.customMessage || dmcaNotice.body,
        status: 'PENDING'
      }
    })

    // Chamar endpoint de envio de e-mail após criar a takedown request
    try {
      const baseUrl = process.env.NEXTAUTH_URL;
      if (!baseUrl) {
        console.error('NEXTAUTH_URL is not set. Email sending will fail.');
        // Optionally, you could throw an error here or handle it differently
        // depending on desired behavior when NEXTAUTH_URL is missing.
        // For now, we'll log and let the fetch attempt fail, which will be caught.
      }
      const sendRes = await fetch(`${baseUrl}/api/takedown-requests/${takedownRequest.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipientEmail: validatedData.recipientEmail })
      });
      const sendData = await sendRes.json();
      if (!sendRes.ok) {
        console.error('Erro ao enviar e-mail via Resend:', sendData);
      }
    } catch (sendErr) {
      console.error('Erro ao chamar endpoint de envio de e-mail:', sendErr);
    }

    // Log de auditoria
    await createAuditLog(
      session.user.id,
      'takedown_request_create',
      'takedown_request',
      { 
        takedownRequestId: takedownRequest.id,
        detectedContentId: validatedData.detectedContentId,
        platform: validatedData.platform
      },
      {
        ip: getClientIP(request),
        userAgent: request.headers.get('user-agent') || undefined
      }
    )

    return NextResponse.json(takedownRequest)

  } catch (error: any) {
    console.error('Erro ao criar solicitação de takedown:', error)
    
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
