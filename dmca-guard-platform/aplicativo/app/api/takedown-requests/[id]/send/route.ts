import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { prisma } from '@/lib/prisma';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  console.log("--- [SEND API] Nova requisição recebida ---");

  if (!process.env.RESEND_SENDER_FROM_EMAIL) {
    console.error("!!! ERRO CRÍTICO: Variável RESEND_SENDER_FROM_EMAIL não definida.");
    return NextResponse.json({ error: "Resend config missing" }, { status: 500 });
  }

  try {
    const { id } = await params;
    const takedown = await prisma.takedownRequest.findUnique({
      where: { id },
      include: {
        detectedContent: {
          include: {
            dmcaContactInfo: true
          }
        }
      }
    });

    if (!takedown) {
      return NextResponse.json({ error: "TakedownRequest não encontrada" }, { status: 404 });
    }

    const recipientEmail = takedown.detectedContent?.dmcaContactInfo?.email;
    if (!recipientEmail) {
      return NextResponse.json({ error: "Destinatário não informado ou não encontrado" }, { status: 400 });
    }

    // Envia o e-mail
    const result = await resend.emails.send({
      from: process.env.RESEND_SENDER_FROM_EMAIL,
      to: recipientEmail,
      subject: takedown.subject || "Notificação DMCA",
      html: takedown.message || "<p>Segue sua notificação DMCA.</p>",
    });

    console.log("[SEND API] Resposta do Resend:", result);

    if (result.error) {
      throw new Error(`Erro ao enviar e-mail via Resend: ${result.error}`);
    }

    // Atualiza o status para SENT
    await prisma.takedownRequest.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date() },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[SEND API] ERRO:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Erro desconhecido" }, { status: 500 });
  }
}