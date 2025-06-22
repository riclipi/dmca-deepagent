import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  try {
    const brandProfiles = await prisma.brandProfile.count({ where: { userId } });
    const monitoringSessions = await prisma.monitoringSession.count({ where: { userId } });
    const detectedContent = await prisma.detectedContent.count({ where: { userId } });
    const takedownRequests = await prisma.takedownRequest.count({ where: { userId } });
    
    // --- A CORREÇÃO ESTÁ AQUI ---
    const unreadNotifications = await prisma.notification.count({
      where: { userId, isRead: false }, // Corrigido de 'read' para 'isRead'
    });
    // --- FIM DA CORREÇÃO ---
    
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
    // Retornando o erro do Prisma para melhor depuração, se for um erro de validação
    if (error instanceof prisma.PrismaClientValidationError) {
        return NextResponse.json({ error: 'Invalid API request.', details: error.message }, { status: 400 });
    }
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}