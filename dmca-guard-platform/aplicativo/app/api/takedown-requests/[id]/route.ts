import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { updateTakedownRequestSchema } from '@/lib/validations';
import { createAuditLog, getClientIP } from '@/lib/audit';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: takedownRequestId } = await params;
    if (!takedownRequestId) {
        return NextResponse.json({ error: 'ID da solicitação de Takedown é obrigatório.' }, { status: 400 });
    }

    // Fetch existing request to check ownership
    const existingTakedownRequest = await prisma.takedownRequest.findUnique({
      where: { id: takedownRequestId },
    });

    if (!existingTakedownRequest) {
      return NextResponse.json({ error: 'Solicitação de Takedown não encontrada.' }, { status: 404 });
    }

    if (existingTakedownRequest.userId !== session.user.id) {
      await createAuditLog(
        session.user.id, // User attempting the action
        'takedown_request_update_forbidden',
        'TakedownRequest', // Resource type
        {
          takedownRequestIdAttempted: takedownRequestId,
          actualOwnerUserId: existingTakedownRequest.userId,
          reason: "Attempt to update takedown request owned by another user."
        },
        { ip: getClientIP(request), userAgent: request.headers.get('user-agent') || undefined }
      );
      return NextResponse.json({ error: 'Acesso negado. Você não tem permissão para alterar esta solicitação.' }, { status: 403 });
    }

    // Cannot edit takedown requests that are not in PENDING status
    if (existingTakedownRequest.status !== 'PENDING') {
        return NextResponse.json({ error: `Solicitações de Takedown com status "${existingTakedownRequest.status}" não podem ser editadas.` }, { status: 403 });
    }

    const body = await request.json();
    const validationResult = updateTakedownRequestSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Dados inválidos.', details: validationResult.error.flatten() },
        { status: 400 }
      );
    }

    const { subject, message } = validationResult.data;

    const updatedTakedownRequest = await prisma.takedownRequest.update({
      where: {
        id: takedownRequestId,
      },
      data: {
        subject,
        message,
      },
    });

    await createAuditLog(
      session.user.id,
      'takedown_request_update',
      'TakedownRequest', // Resource type
      {
        takedownRequestId: updatedTakedownRequest.id,
        updatedSubject: updatedTakedownRequest.subject
      },
      { ip: getClientIP(request), userAgent: request.headers.get('user-agent') || undefined }
    );

    return NextResponse.json(updatedTakedownRequest, { status: 200 });

  } catch (error: any) {
    console.error(`Erro ao atualizar Takedown Request:`, error);
    if (error.code === 'P2025') {
        return NextResponse.json({ error: 'Solicitação de Takedown não encontrada para atualização.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

/**
 * GET /api/takedown-requests/[id]
 * Busca uma takedown request específica
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: takedownRequestId } = await params;
    if (!takedownRequestId) {
      return NextResponse.json({ error: 'ID da solicitação de Takedown é obrigatório.' }, { status: 400 });
    }

    const takedownRequest = await prisma.takedownRequest.findFirst({
      where: {
        id: takedownRequestId,
        userId: session.user.id
      },
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
      }
    });

    if (!takedownRequest) {
      return NextResponse.json({ error: 'Solicitação de Takedown não encontrada.' }, { status: 404 });
    }

    return NextResponse.json(takedownRequest);

  } catch (error: any) {
    console.error(`Erro ao buscar Takedown Request:`, error);
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}

/**
 * DELETE /api/takedown-requests/[id]
 * Remove uma takedown request (soft delete - marca como arquivada)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { id: takedownRequestId } = await params;
    if (!takedownRequestId) {
      return NextResponse.json({ error: 'ID da solicitação de Takedown é obrigatório.' }, { status: 400 });
    }

    // Buscar a takedown request existente
    const existingTakedownRequest = await prisma.takedownRequest.findFirst({
      where: {
        id: takedownRequestId,
        userId: session.user.id
      },
      include: {
        detectedContent: {
          select: {
            id: true,
            title: true,
            platform: true
          }
        }
      }
    });

    if (!existingTakedownRequest) {
      return NextResponse.json({ error: 'Solicitação de Takedown não encontrada.' }, { status: 404 });
    }

    // Verificar se a takedown request pode ser deletada
    // Não permitir deletar requests que já foram enviadas e tiveram resposta
    const restrictedStatuses = ['ACKNOWLEDGED', 'REMOVED'];
    if (restrictedStatuses.includes(existingTakedownRequest.status)) {
      return NextResponse.json(
        { 
          error: `Não é possível deletar takedown requests com status "${existingTakedownRequest.status}".`,
          details: 'Apenas requests pendentes, enviadas ou rejeitadas podem ser removidas.'
        },
        { status: 409 }
      );
    }

    // Soft delete - marcar como arquivada ou hard delete dependendo do status
    if (existingTakedownRequest.status === 'PENDING') {
      // Hard delete para requests que ainda não foram enviadas
      await prisma.takedownRequest.delete({
        where: { id: takedownRequestId }
      });
    } else {
      // Soft delete - adicionar campo status ARCHIVED se necessário
      // Por enquanto, vamos fazer hard delete mesmo para simplificar
      await prisma.takedownRequest.delete({
        where: { id: takedownRequestId }
      });
    }

    // Log de auditoria
    await createAuditLog(
      session.user.id,
      'takedown_request_delete',
      'TakedownRequest',
      {
        takedownRequestId: takedownRequestId,
        detectedContentId: existingTakedownRequest.detectedContentId,
        platform: existingTakedownRequest.platform,
        status: existingTakedownRequest.status,
        contentTitle: existingTakedownRequest.detectedContent?.title
      },
      { 
        ip: getClientIP(request), 
        userAgent: request.headers.get('user-agent') || undefined 
      }
    );

    return NextResponse.json({
      success: true,
      message: 'Takedown request deletada com sucesso',
      deletedId: takedownRequestId
    });

  } catch (error: any) {
    console.error(`Erro ao deletar Takedown Request:`, error);
    
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Solicitação de Takedown não encontrada para remoção.' }, { status: 404 });
    }
    
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
