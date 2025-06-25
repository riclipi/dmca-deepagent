// app/api/scan/real-search/route.ts - API para Busca Real de Vazamentos

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
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
        select: {
          id: true,
          brandName: true,
          safeKeywords: true,
          moderateKeywords: true,
          dangerousKeywords: true,
          officialUrls: true
        }
      }),
      prisma.monitoringSession.findUnique({
        where: { id: monitoringSessionId, userId: session.user.id },
        select: {
          id: true,
          scanFrequency: true,
          customKeywords: true,
          excludeKeywords: true,
          useProfileKeywords: true
        }
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

    // Obter keywords efetivas para busca
    let keywordsToSearch: string[] = []
    
    // Usar keywords seguras do perfil se disponíveis
    if (brandProfile.safeKeywords && brandProfile.safeKeywords.length > 0) {
      keywordsToSearch = [...brandProfile.safeKeywords]
      console.log(`🔐 Usando ${keywordsToSearch.length} keywords seguras do perfil`)
    } else {
      // Fallback para o nome da marca
      keywordsToSearch = [brandProfile.brandName]
      console.log(`⚠️ Usando nome da marca como fallback: '${brandProfile.brandName}'`)
    }
    
    // Adicionar keywords customizadas da sessão se existirem
    if (monitoringSession.customKeywords && monitoringSession.customKeywords.length > 0) {
      keywordsToSearch.push(...monitoringSession.customKeywords)
      console.log(`➕ Adicionadas ${monitoringSession.customKeywords.length} keywords customizadas`)
    }
    
    // Remover keywords excluídas
    if (monitoringSession.excludeKeywords && monitoringSession.excludeKeywords.length > 0) {
      keywordsToSearch = keywordsToSearch.filter(k => !monitoringSession.excludeKeywords.includes(k))
      console.log(`➖ Removidas ${monitoringSession.excludeKeywords.length} keywords excluídas`)
    }
    
    console.log(`🎯 Total de keywords para busca: ${keywordsToSearch.length}`)
    console.log(`📝 Keywords: ${keywordsToSearch.slice(0, 5).join(', ')}${keywordsToSearch.length > 5 ? '...' : ''}`)

    // Atualizar status da sessão para RUNNING
    await prisma.monitoringSession.update({
      where: { id: monitoringSessionId },
      data: {
        status: 'RUNNING',
        currentKeyword: keywordsToSearch[0] || brandProfile.brandName,
        progress: 0,
        totalKeywords: keywordsToSearch.length,
        processedKeywords: 0,
        lastScanAt: new Date()
      }
    });

    // Inicializar serviço de busca
    const searchService = new SearchEngineService();
    
    // Executar busca para cada keyword com salvamento incremental
    console.log(`🔍 Iniciando busca real para ${brandProfile.brandName}...`);
    let allSearchResults: any[] = []
    let processedCount = 0
    let totalSavedCount = 0 // Contador total de resultados salvos
    
    for (const keyword of keywordsToSearch) {
      try {
        console.log(`Buscando: ${keyword}`)
        
        // Atualizar progresso ANTES da busca
        const currentProgress = Math.round(((processedCount + 0.1) / keywordsToSearch.length) * 100);
        await prisma.monitoringSession.update({
          where: { id: monitoringSessionId },
          data: {
            currentKeyword: keyword,
            processedKeywords: processedCount,
            progress: currentProgress
          }
        })
        
        // Configurar busca para esta keyword específica
        const searchConfig = {
          keyword: keyword,
          brandName: brandProfile.brandName,
          excludeDomains,
          maxResults: Math.ceil(maxResults / keywordsToSearch.length), // Distribuir maxResults
          platforms
        }
        
        // Executar busca
        const keywordResults = await searchService.performCompleteSearch(searchConfig)
        allSearchResults.push(...keywordResults)
        
        // SALVAMENTO INCREMENTAL: Salvar resultados desta keyword imediatamente
        console.log(`💾 Salvando ${keywordResults.length} resultados da keyword '${keyword}'...`);
        let keywordSavedCount = 0;
        
        for (const result of keywordResults) {
          try {
            // Verificar se já existe
            const existing = await prisma.detectedContent.findFirst({
              where: {
                infringingUrl: result.url,
                brandProfileId: brandProfileId
              }
            });
    
            if (existing) {
              console.log(`⚠️ Resultado já existe: ${result.url}`);
              continue;
            }
    
            if (result.confidence < 40) {
              console.log(`❌ Confiança muito baixa (${result.confidence}%), pulando...`);
              continue;
            }
    
            console.log(`✅ Salvando: ${result.title} (${result.confidence}%)`);
            await prisma.detectedContent.create({
              data: {
                userId: session.user.id,
                brandProfileId: brandProfileId,
                monitoringSessionId: monitoringSessionId,
                title: result.title,
                description: result.snippet,
                contentType: 'OTHER',
                infringingUrl: result.url,
                platform: result.platform,
                thumbnailUrl: result.thumbnailUrl,
                confidence: Math.round(result.confidence),
                keywordSource: keyword,
                platformType: result.source,
                priority: result.confidence >= 70 ? 'HIGH' : result.confidence >= 50 ? 'MEDIUM' : 'LOW',
                detectedAt: result.detectedAt
              }
            });
            keywordSavedCount++;
            totalSavedCount++;
            
          } catch (error) {
            console.error(`❌ Erro salvando resultado "${result.title}":`, error);
          }
        }
        
        console.log(`🎯 Keyword '${keyword}': ${keywordSavedCount}/${keywordResults.length} resultados salvos`);
        
        processedCount++
        
        // Atualizar progresso DEPOIS da busca E salvamento
        const finalProgress = Math.round((processedCount / keywordsToSearch.length) * 100);
        await prisma.monitoringSession.update({
          where: { id: monitoringSessionId },
          data: {
            processedKeywords: processedCount,
            progress: finalProgress,
            resultsFound: totalSavedCount // Atualizar contador em tempo real
          }
        })
        
        // Criar notificação imediata se encontrou novos resultados
        if (keywordSavedCount > 0) {
          await prisma.notification.create({
            data: {
              userId: session.user.id,
              title: `🔍 Novos resultados para '${keyword}'`,
              message: `Encontrados ${keywordSavedCount} novos vazamentos potenciais para ${brandProfile.brandName} com a keyword '${keyword}'.`,
              type: 'CONTENT_DETECTED'
            }
          });
        }
        
        // Pausa reduzida entre buscas
        await new Promise(resolve => setTimeout(resolve, 300))
        
      } catch (error) {
        console.error(`Erro buscando keyword '${keyword}':`, error)
        processedCount++
      }
    }
    
    // Remover duplicatas por URL para estatísticas finais
    const uniqueResults = allSearchResults.filter((result, index, self) => 
      index === self.findIndex(r => r.url === result.url)
    )

    console.log(`📊 Total coletado: ${allSearchResults.length} resultados`);
    console.log(`🔄 Após remoção de duplicatas: ${uniqueResults.length} resultados únicos`);
    console.log(`💾 Total salvos incrementalmente: ${totalSavedCount} resultados`);
    
    // Log de estatísticas de confiança
    const confidenceStats = {
      high: uniqueResults.filter(r => r.confidence >= 70).length,
      medium: uniqueResults.filter(r => r.confidence >= 50 && r.confidence < 70).length,
      low: uniqueResults.filter(r => r.confidence >= 40 && r.confidence < 50).length,
      veryLow: uniqueResults.filter(r => r.confidence < 40).length
    };
    console.log(`📊 Estatísticas de confiança:`, confidenceStats);

    // Atualizar sessão com resultados finais
    await prisma.monitoringSession.update({
      where: { id: monitoringSessionId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        processedKeywords: keywordsToSearch.length,
        resultsFound: totalSavedCount, // Usar contador total
        lastResultAt: totalSavedCount > 0 ? new Date() : undefined,
        nextScanAt: new Date(Date.now() + monitoringSession.scanFrequency * 60 * 60 * 1000)
      }
    });

    // Criar notificação final se encontrou resultados
    if (totalSavedCount > 0) {
      await prisma.notification.create({
        data: {
          userId: session.user.id,
          title: '🎉 Busca Completa!',
          message: `Busca finalizada! Total: ${totalSavedCount} novos vazamentos detectados para ${brandProfile.brandName} usando ${keywordsToSearch.length} keywords.`,
          type: 'CONTENT_DETECTED'
        }
      });
    }

    return NextResponse.json({
      success: true,
      message: `Busca concluída! Encontrados ${totalSavedCount} novos vazamentos potenciais.`,
      results: {
        totalSearched: uniqueResults.length,
        newDetections: totalSavedCount, // Usar contador total
        keywordsProcessed: keywordsToSearch.length,
        confidence: {
          high: uniqueResults.filter(r => r.confidence >= 70).length,
          medium: uniqueResults.filter(r => r.confidence >= 50 && r.confidence < 70).length,
          low: uniqueResults.filter(r => r.confidence < 50).length
        },
        platforms: Array.from(new Set(uniqueResults.map(r => r.platform))),
        incrementalSave: true // Indicar que foi usado salvamento incremental
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
