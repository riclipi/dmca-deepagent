// dmca-guard-platform/app/app/api/dashboard/stats/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  // --- LÓGICA MODIFICADA PARA LER userId ---
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }
  // ------------------------------------------

  try {
    // --- USANDO O userId DINÂMICO NAS CONSULTAS ---
    const brandProfiles = await prisma.brandProfile.count({ where: { userId } });
    const monitoringSessions = await prisma.monitoringSession.count({ where: { userId } });
    const detectedContent = await prisma.detectedContent.count({ where: { userId } });
    const takedownRequests = await prisma.takedownRequest.count({ where: { userId } });
    const unreadNotifications = await prisma.notification.count({
      where: { userId, read: false },
    });
    
    // As consultas de 'recent' e 'analytics' também precisam ser atualizadas
    // para usar o 'userId' em seus filtros 'where'.
    // Vou deixar como exemplo, você precisará adaptar às suas models.
    const recentDetected = await prisma.detectedContent.findMany({
      where: { userId },
      orderBy: { detectedAt: 'desc' },
      take: 5,
      include: { brandProfile: true }
    });

    const recentTakedowns = await prisma.takedownRequest.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { detectedContent: true }
    });

    // ... (adapte as demais consultas de analytics conforme necessário)

    const stats = {
      overview: {
        brandProfiles,
        monitoringSessions,
        detectedContent,
        takedownRequests,
        unreadNotifications,
      },
      recent: {
        detectedContent: recentDetected,
        takedowns: recentTakedowns,
      },
      analytics: {
        // ... (resultados das consultas de analytics)
        takedownsByStatus: {}, 
        contentByPlatform: {},
        last30Days: { detectedContent: 0, takedowns: 0 }
      },
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('[STATS_API]', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}