// dmca-guard-platform/app/app/api/dashboard/stats/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSession } from 'next-auth/react';
import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
  }
  
  const userId = session.user.id;

  try {
    // Contagens gerais para o usuário autenticado
    const brandProfiles = await prisma.brandProfile.count({ where: { userId } });
    const monitoringSessions = await prisma.monitoringSession.count({ where: { userId } });
    const detectedContent = await prisma.detectedContent.count({ where: { userId } });
    const takedownRequests = await prisma.takedownRequest.count({ where: { userId } });

    // --- AQUI ESTÁ A CORREÇÃO ---
    // O campo correto é 'isRead', e não 'read'.
    const unreadNotifications = await prisma.notification.count({
      where: { userId, isRead: false },
    });
    // --- FIM DA CORREÇÃO ---
    
    // Consultas para conteúdos e takedowns recentes do usuário
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
    
    // TODO: Implementar a lógica de analytics (se necessário no futuro)
    
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
        takedownsByStatus: {}, 
        contentByPlatform: {},
        last30Days: { detectedContent: 0, takedowns: 0 }
      },
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('[STATS_API]', error);
    // Retornamos o erro em formato JSON para facilitar o debug no frontend
    return NextResponse.json({ error: 'Internal Server Error', details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}