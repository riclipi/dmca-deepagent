// app/api/scan/real-search/route.ts - API para Busca Real de Vazamentos

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import SearchEngineService from '@/lib/search-engines';

interface SearchRequestBody {
  brandProfileId: string;
  monitoringSessionId: string;
  platforms?: string[];
  maxResults?: number;
}

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const body: SearchRequestBody = await request.json();
    const { brandProfileId, monitoringSessionId, platforms = [], maxResults = 50 } = body;

    // Buscar perfil de marca e sessão de monitoramento
    const [brandProfile, monitoringSession] = await Promise.all([
      prisma.brandProfile.findUnique({
        where: { id: brandProfileId, userId: session.user.id },
      }),
      prisma.monitoringSession.findUnique({
        where: { id: monitoringSessionId, userId: session.user.id },
      })
    ]);

    if (!brandProfile || !monitoringSession) {
      return NextResponse.json({ error: 'Perfil ou sessão não encontrados' }, { status: 404 });
    }

    // Buscar whitelist de domínios do usuário
    const domainWhitelists = await prisma.domainWhitelist.findMany({
      where: { userId: session.user.id },
      select: { domain: true }
    });

    const excludeDomains = [
      ...domainWhitelists.map(w => w.domain),
      ...brandProfile.officialUrls.map(url => new URL(url).hostname),
      'onlyfans.com' // Sempre excluir site oficial OF
    ];

    // Configurar busca
    const searchConfig = {
      keyword: brandProfile.brandName,
      brandName: brandProfile.brandName,
      excludeDomains,
      maxResults,
      platforms
    };

    // Atualizar status da sessão para RUNNING
    await prisma.monitoringSession.update({
      where: { id: monitoringSessionId },
      data: {
        status: 'RUNNING',
        currentKeyword: brandProfile.brandName,
        progress: 0,
        lastScanAt: new Date()
      }
    });

    // Inicializar serviço de busca
    const searchService = new SearchEngineService();
    
    // Gerar e contar keywords
    const allKeywords = searchService.generateSearchKeywords(brandProfile.brandName);
    await prisma.monitoringSession.update({
      where: { id: monitoringSessionId },
      data: {
        totalKeywords: allKeywords.length,
        processedKeywords: 0
      }
    });

    // Executar busca real
    console.log(`🔍 Iniciando busca real para ${brandProfile.brandName}...`);
    const searchResults = await searchService.performCompleteSearch(searchConfig);

    console.log(`📊 Encontrados ${searchResults.length} resultados potenciais`);

    // Salvar resultados como conteúdo detectado
    let savedCount = 0;
    for (const result of searchResults) {
      try {
        // Verificar se já existe
        const existing = await prisma.detectedContent.findFirst({
          where: {
            infringingUrl: result.url,
            brandProfileId: brandProfileId
          }
        });

        if (!existing && result.confidence >= 40) { // Só salva com confiança >= 40%
          await prisma.detectedContent.create({
            data: {
              userId: session.user.id,
              brandProfileId: brandProfileId,
              monitoringSessionId: monitoringSessionId,
              title: result.title,
              description: result.snippet,
              contentType: 'OTHER', // Detectar tipo depois
              infringingUrl: result.url,
              platform: result.platform,
              thumbnailUrl: result.thumbnailUrl,
              confidence: Math.round(result.confidence),
              keywordSource: searchConfig.keyword,
              platformType: result.source,
              priority: result.confidence >= 70 ? 'HIGH' : result.confidence >= 50 ? 'MEDIUM' : 'LOW',
              detectedAt: result.detectedAt
            }
          });
          savedCount++;
        }
      } catch (error) {
        console.error('Erro salvando resultado:', error);
      }
    }

    // Atualizar sessão com resultados
    await prisma.monitoringSession.update({
      where: { id: monitoringSessionId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        processedKeywords: allKeywords.length,
        resultsFound: savedCount,
        lastResultAt: savedCount > 0 ? new Date() : undefined,
        nextScanAt: new Date(Date.now() + monitoringSession.scanFrequency * 60 * 60 * 1000)
      }
    });

    // Criar notificação se encontrou resultados
    if (savedCount > 0) {
      await prisma.notification.create({
        data: {
          userId: session.user.id,
          title: '🚨 Novo Conteúdo Vazado Detectado!',
          message: `Encontramos ${savedCount} possíveis vazamentos para ${brandProfile.brandName}. Verifique o dashboard para mais detalhes.`,
          type: 'CONTENT_DETECTED'
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: `Busca concluída! Encontrados ${savedCount} novos vazamentos potenciais.`,
      results: {
        totalSearched: searchResults.length,
        newDetections: savedCount,
        keywordsProcessed: allKeywords.length,
        confidence: {
          high: searchResults.filter(r => r.confidence >= 70).length,
          medium: searchResults.filter(r => r.confidence >= 50 && r.confidence < 70).length,
          low: searchResults.filter(r => r.confidence < 50).length
        },
        platforms: [...new Set(searchResults.map(r => r.platform))]
      }
    });

  } catch (error) {
    console.error('❌ Erro na busca real:', error);
    
    // Atualizar sessão como erro
    const body = await request.json().catch(() => ({}));
    if (body.monitoringSessionId) {
      await prisma.monitoringSession.update({
        where: { id: body.monitoringSessionId },
        data: { status: 'ERROR', progress: 0 }
      }).catch(console.error);
    }

    return NextResponse.json(
      { error: 'Erro interno na busca real', details: error instanceof Error ? error.message : 'Erro desconhecido' },
      { status: 500 }
    );
  }
}

// Endpoint para status da busca em tempo real
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'ID da sessão obrigatório' }, { status: 400 });
    }

    const monitoringSession = await prisma.monitoringSession.findUnique({
      where: { id: sessionId, userId: session.user.id },
      include: {
        brandProfile: {
          select: { brandName: true }
        },
        _count: {
          select: { detectedContent: true }
        }
      }
    });

    if (!monitoringSession) {
      return NextResponse.json({ error: 'Sessão não encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      sessionId: monitoringSession.id,
      brandName: monitoringSession.brandProfile.brandName,
      status: monitoringSession.status,
      progress: monitoringSession.progress,
      currentKeyword: monitoringSession.currentKeyword,
      totalKeywords: monitoringSession.totalKeywords,
      processedKeywords: monitoringSession.processedKeywords,
      resultsFound: monitoringSession.resultsFound,
      totalContent: monitoringSession._count.detectedContent,
      lastScanAt: monitoringSession.lastScanAt,
      nextScanAt: monitoringSession.nextScanAt
    });

  } catch (error) {
    console.error('Erro ao buscar status:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
