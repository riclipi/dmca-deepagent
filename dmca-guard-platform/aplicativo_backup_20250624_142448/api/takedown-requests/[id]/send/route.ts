import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { createAuditLog, getClientIP } from '@/lib/audit';
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// TakedownStatus enum values (as string literals, ensure they match your Prisma schema)
const TakedownStatus = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  // ... other statuses if needed for checks, though PENDING and SENT are primary here
};

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

    // Corrigir atribuição do status para o enum do Prisma
    const updatedTakedownRequest = await prisma.takedownRequest.update({
      where: { id: takedownRequestId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        attempts: {
          increment: 1,
        },
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
      from: process.env.RESEND_SENDER_FROM_EMAIL,
      to: updatedTakedownRequest.recipientEmail,
      subject: updatedTakedownRequest.subject || 'Notificação DMCA',
      html: updatedTakedownRequest.message || '<p>Segue sua notificação DMCA.</p>',
    });

    if (result.error) {
      throw new Error(`Erro ao enviar e-mail via Resend: ${result.error}`);
    }

    return NextResponse.json(updatedTakedownRequest, { status: 200 });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Solicitação de Takedown não encontrada para atualização.' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Erro interno do servidor.' }, { status: 500 });
  }
}
// dmca-guard-platform/app/app/api/takedown-requests/[id]/send/route.ts

import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { prisma } from '@/lib/db';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request, { params }: { params: { id: string } }) {
  console.log("--- [SEND API] Nova requisição recebida ---");

  if (!process.env.RESEND_SENDER_FROM_EMAIL) {
    console.error("!!! ERRO CRÍTICO: Variável RESEND_SENDER_FROM_EMAIL não definida.");
    return NextResponse.json({ error: "Resend config missing" }, { status: 500 });
  }

  try {
    const takedown = await prisma.takedownRequest.findUnique({
      where: { id: params.id },
    });

    if (!takedown) {
      return NextResponse.json({ error: "TakedownRequest não encontrada" }, { status: 404 });
    }

    if (!takedown.recipientEmail) {
      return NextResponse.json({ error: "Destinatário não informado" }, { status: 400 });
    }

    // Envia o e-mail
    const result = await resend.emails.send({
      from: process.env.RESEND_SENDER_FROM_EMAIL,
      to: takedown.recipientEmail,
      subject: takedown.subject || "Notificação DMCA",
      html: takedown.message || "<p>Segue sua notificação DMCA.</p>",
    });

    console.log("[SEND API] Resposta do Resend:", result);

    if (result.error) {
      throw new Error(`Erro ao enviar e-mail via Resend: ${result.error}`);
    }

    // Atualiza o status para SENT
    await prisma.takedownRequest.update({
      where: { id: params.id },
      data: { status: 'SENT', sentAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[SEND API] ERRO:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro desconhecido" }, { status: 500 });
  }
}