// dmca-guard-platform/app/api/ingest/google-alerts/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { fetchGoogleAlertsFromGmail } from '@/lib/services/gmail'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    // Email da Lary – pode vir do banco/session/.env, ajuste conforme necessário!
    const userEmail = process.env.SUPER_USER_EMAIL || 'lary@example.com'
    const detectedContents = await fetchGoogleAlertsFromGmail(userEmail)

    // Salva tudo no banco (exemplo para super user; ajuste para multi-user depois)
    for (const content of detectedContents) {
      await prisma.detectedContent.create({
        data: {
          userId: 'COLOQUE_O_USER_ID_DA_LARY_AQUI', // ajuste para buscar dinâmico se quiser
          brandProfileId: 'ID_DO_BRAND_PROFILE', // opcional, se tiver
          monitoringSessionId: 'ID_DA_SESSÃO',   // opcional, se quiser
          title: content.title,
          infringingUrl: content.infringingUrl,
          platform: content.platform,
          detectedAt: content.detectedAt,
        },
      });
    }

    return NextResponse.json({
      message: 'Conteúdos detectados importados!',
      count: detectedContents.length,
      detectedContents,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
