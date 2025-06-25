import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createAuditLog, getClientIP } from '@/lib/audit';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY!);

const TakedownStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
} as const;

type TakedownStatusType = (typeof TakedownStatus)[keyof typeof TakedownStatus];

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const takedownRequestId = params.id;
    if (!takedownRequestId) {
      return NextResponse.json({ error: 'ID da solicitação de Takedown é obrigatório.' }, { status: 400 });
    }

    const existingTakedownRequest = await prisma.takedownRequest.findUnique({
      where: { id: takedownRequestId },
    });

    if (!existingTakedownRequest) {
      return NextResponse.json({ error: 'Solicitação de Takedown não encontrada.' }, { status: 404 });
    }

    if (existingTakedownRequest.userId !== session.user.id) {
      await createAuditLog(
        session.user.id,
        'takedown_request_send_forbidden',
        'TakedownRequest',
        {
          takedownRequestIdAttempted: takedownRequestId,
          actualOwnerUserId: existingTakedownRequest.userId,
          reason: 'Attempt to mark takedown request as sent for another user.'
        },
        { ip: getClientIP(request), userAgent: request.headers.get('user-agent') || undefined }
      );
      return NextResponse.json({ error: 'Acesso negado. Você não tem permissão para modificar esta solicitação.' }, { status: 403 });
    }

    if (existingTakedownRequest.status !== TakedownStatus.PENDING) {
      return NextResponse.json(
        { error: `A solicitação não pode ser marcada como enviada pois seu status atual é "${existingTakedownRequest.status}". Apenas solicitações pendentes podem ser enviadas.` },
        { status: 409 }
      );
    }

    const updatedTakedownRequest = await prisma.takedownRequest.update({
      where: { id: takedownRequestId },
      data: {
        status: TakedownStatus.SENT as TakedownStatusType,
        sentAt: new Date(),
        attempts: { increment: 1 },
      },
    });

    await createAuditLog(
      session.user.id,
      'takedown_request_sent',
      'TakedownRequest',
      {
        takedownRequestId: updatedTakedownRequest.id,
        newStatus: updatedTakedownRequest.status,
        sentAt: updatedTakedownRequest.sentAt
      },
      { ip: getClientIP(request), userAgent: request.headers.get('user-agent') || undefined }
    );

    const result = await resend.emails.send({
      from: process.env.RESEND_SENDER_FROM_EMAIL!,
      to: updatedTakedownRequest.recipientEmail,
      subject: updatedTakedownRequest.subject || 'Notificação DMCA',
      html: updatedTakedownRequest.message || '<p>Segue sua notificação DMCA.</p>',
    });

    if ((result as any).error) {
      throw new Error(`Erro ao enviar e-mail via Resend: ${(result as any).error}`);
    }

    return NextResponse.json(updatedTakedownRequest, { status: 200 });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Solicitação de Takedown não encontrada para atualização.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}