// app/api/brand-profiles/[id]/generate-safe-keywords/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { safeKeywordGenerator } from '@/lib/safe-keyword-generator';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const resolvedParams = await params;
    const profileId = resolvedParams.id;
    
    // Buscar perfil de marca
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { 
        id: profileId,
        userId: session.user.id 
      }
    });

    if (!brandProfile) {
      return NextResponse.json(
        { error: 'Perfil de marca não encontrado' }, 
        { status: 404 }
      );
    }

    // Configurar geração de keywords
    const config = safeKeywordGenerator.getDefaultConfig(brandProfile.brandName);
    
    // Gerar keywords seguras
    const result = safeKeywordGenerator.generateSafeKeywords(config);
    
    // Atualizar perfil com as keywords geradas
    const updatedProfile = await prisma.brandProfile.update({
      where: { id: profileId },
      data: {
        safeKeywords: result.safe,
        moderateKeywords: result.moderate,
        dangerousKeywords: result.dangerous,
        keywordConfig: config,
        lastKeywordUpdate: new Date(),
        // Manter keywords antigas se existirem
        keywords: [...new Set([...brandProfile.keywords, ...result.safe])]
      }
    });

    console.log(`✅ Keywords geradas para ${brandProfile.brandName}:`);
    console.log(`   Seguras: ${result.safe.length}`);
    console.log(`   Moderadas: ${result.moderate.length}`);
    console.log(`   Perigosas: ${result.dangerous.length}`);

    return NextResponse.json({
      success: true,
      message: `Keywords geradas com sucesso para ${brandProfile.brandName}`,
      statistics: {
        safe: result.safe.length,
        moderate: result.moderate.length,
        dangerous: result.dangerous.length,
        total: result.total
      },
      keywords: {
        safe: result.safe,
        moderate: result.moderate,
        dangerous: result.dangerous
      },
      config: result.config
    });

  } catch (error) {
    console.error('Erro ao gerar keywords seguras:', error);
    return NextResponse.json(
      { error: 'Erro interno ao gerar keywords' },
      { status: 500 }
    );
  }
}

// GET para ver keywords atuais e estatísticas
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    const resolvedParams = await params;
    const profileId = resolvedParams.id;
    
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { 
        id: profileId,
        userId: session.user.id 
      }
    });

    if (!brandProfile) {
      return NextResponse.json(
        { error: 'Perfil de marca não encontrado' }, 
        { status: 404 }
      );
    }

    // Calcular estatísticas
    const stats = {
      safe: brandProfile.safeKeywords?.length || 0,
      moderate: brandProfile.moderateKeywords?.length || 0,
      dangerous: brandProfile.dangerousKeywords?.length || 0,
      lastUpdate: brandProfile.lastKeywordUpdate,
      hasKeywords: (brandProfile.safeKeywords?.length || 0) > 0
    };

    return NextResponse.json({
      success: true,
      brandName: brandProfile.brandName,
      statistics: stats,
      keywords: {
        safe: brandProfile.safeKeywords || [],
        moderate: brandProfile.moderateKeywords || [],
        dangerous: brandProfile.dangerousKeywords || []
      },
      config: brandProfile.keywordConfig || null
    });

  } catch (error) {
    console.error('Erro ao buscar keywords:', error);
    return NextResponse.json(
      { error: 'Erro interno' },
      { status: 500 }
    );
  }
}
