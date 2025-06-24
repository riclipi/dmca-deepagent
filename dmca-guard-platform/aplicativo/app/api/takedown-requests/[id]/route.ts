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
