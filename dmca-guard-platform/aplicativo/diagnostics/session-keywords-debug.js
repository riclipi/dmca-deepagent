#!/usr/bin/env node

/**
 * Script de Diagnóstico: Session ↔ Keywords Linkage
 * 
 * Este script analisa a integração entre sessões de monitoramento
 * e keywords para identificar problemas de linkagem.
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 DIAGNÓSTICO: Session ↔ Keywords Linkage\n')
  
  try {
    // 1. Verificar Brand Profiles com keywords
    console.log('1️⃣ ANALISANDO BRAND PROFILES...')
    const brandProfiles = await prisma.brandProfile.findMany({
      where: { isActive: true },
      select: {
        id: true,
        brandName: true,
        safeKeywords: true,
        moderateKeywords: true,
        dangerousKeywords: true,
        keywordConfig: true,
        lastKeywordUpdate: true,
        _count: {
          select: {
            monitoringSessions: true
          }
        }
      }
    })

    console.log(`📋 Total de Brand Profiles ativos: ${brandProfiles.length}`)
    
    for (const profile of brandProfiles) {
      const safeCount = profile.safeKeywords?.length || 0
      const moderateCount = profile.moderateKeywords?.length || 0
      const dangerousCount = profile.dangerousKeywords?.length || 0
      const totalKeywords = safeCount + moderateCount + dangerousCount
      
      console.log(`\n  🏷️  ${profile.brandName} (${profile.id})`)
      console.log(`     ✅ Safe: ${safeCount}`)
      console.log(`     ⚠️  Moderate: ${moderateCount}`)
      console.log(`     ❌ Dangerous: ${dangerousCount}`)
      console.log(`     📊 Total: ${totalKeywords}`)
      console.log(`     🔗 Sessions: ${profile._count.monitoringSessions}`)
      console.log(`     🕒 Última atualização: ${profile.lastKeywordUpdate || 'Nunca'}`)
      
      if (totalKeywords === 0) {
        console.log(`     ⚠️  PROBLEMA: Nenhuma keyword gerada!`)
      }
    }

    // 2. Verificar Monitoring Sessions
    console.log('\n\n2️⃣ ANALISANDO MONITORING SESSIONS...')
    const sessions = await prisma.monitoringSession.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        useProfileKeywords: true,
        customKeywords: true,
        excludeKeywords: true,
        totalKeywords: true,
        processedKeywords: true,
        progress: true,
        status: true,
        brandProfile: {
          select: {
            id: true,
            brandName: true,
            safeKeywords: true
          }
        }
      }
    })

    console.log(`📋 Total de Sessions ativas: ${sessions.length}`)
    
    for (const session of sessions) {
      console.log(`\n  🔍 ${session.name} (${session.id})`)
      console.log(`     🏷️  Brand: ${session.brandProfile.brandName}`)
      console.log(`     🔗 useProfileKeywords: ${session.useProfileKeywords}`)
      console.log(`     📊 totalKeywords: ${session.totalKeywords}`)
      console.log(`     ✅ processedKeywords: ${session.processedKeywords}`)
      console.log(`     📈 progress: ${session.progress}%`)
      console.log(`     🔄 status: ${session.status}`)
      
      // Custom keywords
      const customCount = session.customKeywords?.length || 0
      console.log(`     ➕ Custom keywords: ${customCount}`)
      
      // Exclude keywords
      const excludeCount = session.excludeKeywords?.length || 0
      console.log(`     ➖ Exclude keywords: ${excludeCount}`)
      
      // Profile keywords disponíveis
      const profileKeywordsCount = session.brandProfile.safeKeywords?.length || 0
      console.log(`     🎯 Profile safe keywords disponíveis: ${profileKeywordsCount}`)
      
      // Verificar inconsistências
      if (session.useProfileKeywords && profileKeywordsCount === 0) {
        console.log(`     ❌ PROBLEMA: useProfileKeywords=true mas sem keywords no perfil!`)
      }
      
      if (session.totalKeywords === 0 && (session.useProfileKeywords || customCount > 0)) {
        console.log(`     ❌ PROBLEMA: totalKeywords=0 mas deveria ter keywords!`)
      }
      
      if (session.totalKeywords !== (profileKeywordsCount + customCount - excludeCount) && session.useProfileKeywords) {
        const expected = profileKeywordsCount + customCount - excludeCount
        console.log(`     ⚠️  INCONSISTÊNCIA: totalKeywords=${session.totalKeywords}, esperado=${expected}`)
      }
    }

    // 3. Verificar Keyword Reviews pendentes
    console.log('\n\n3️⃣ ANALISANDO KEYWORD REVIEWS...')
    const reviews = await prisma.keywordReview.findMany({
      where: { status: 'PENDING' },
      select: {
        id: true,
        keyword: true,
        riskScore: true,
        riskReasons: true,
        brandProfileId: true,
        createdAt: true
      }
    })

    console.log(`📋 Total de Reviews pendentes: ${reviews.length}`)
    
    if (reviews.length > 0) {
      console.log('\n  📝 Reviews pendentes por Brand Profile:')
      const reviewsByProfile = {}
      for (const review of reviews) {
        if (!reviewsByProfile[review.brandProfileId]) {
          reviewsByProfile[review.brandProfileId] = []
        }
        reviewsByProfile[review.brandProfileId].push(review)
      }
      
      for (const [profileId, profileReviews] of Object.entries(reviewsByProfile)) {
        const profile = brandProfiles.find(p => p.id === profileId)
        console.log(`\n    🏷️  ${profile?.brandName || 'Unknown'} (${profileId}): ${profileReviews.length} pendentes`)
        
        for (const review of profileReviews.slice(0, 3)) {
          console.log(`       ⚠️  "${review.keyword}" (score: ${review.riskScore})`)
        }
        if (profileReviews.length > 3) {
          console.log(`       ... e mais ${profileReviews.length - 3}`)
        }
      }
    }

    // 4. Verificar integração KeywordIntegrationService
    console.log('\n\n4️⃣ TESTANDO KEYWORD INTEGRATION SERVICE...')
    
    for (const profile of brandProfiles.slice(0, 2)) { // Testar apenas os primeiros 2
      try {
        console.log(`\n  🧪 Testando sincronização para: ${profile.brandName}`)
        
        // Simular chamada do KeywordIntegrationService
        const sessions = await prisma.monitoringSession.findMany({
          where: {
            brandProfileId: profile.id,
            useProfileKeywords: true,
            isActive: true
          },
          select: { id: true }
        })

        const safeKeywordCount = profile.safeKeywords?.length || 0
        console.log(`     📊 Keywords seguras no perfil: ${safeKeywordCount}`)
        console.log(`     🔗 Sessions que usam profile keywords: ${sessions.length}`)
        
        if (sessions.length > 0 && safeKeywordCount > 0) {
          console.log(`     ✅ Integração parece OK`)
        } else if (sessions.length > 0 && safeKeywordCount === 0) {
          console.log(`     ❌ PROBLEMA: Sessions existem mas sem keywords seguras!`)
        }
        
      } catch (error) {
        console.log(`     ❌ ERRO ao testar: ${error.message}`)
      }
    }

    // 5. Resumo de problemas encontrados
    console.log('\n\n5️⃣ RESUMO DOS PROBLEMAS ENCONTRADOS:')
    
    const problemsFound = []
    
    // Profiles sem keywords
    const profilesWithoutKeywords = brandProfiles.filter(p => 
      (p.safeKeywords?.length || 0) === 0 && 
      (p.moderateKeywords?.length || 0) === 0 &&
      p._count.monitoringSessions > 0
    )
    
    if (profilesWithoutKeywords.length > 0) {
      problemsFound.push(`❌ ${profilesWithoutKeywords.length} Brand Profiles com sessions mas sem keywords`)
    }
    
    // Sessions com problemas de sincronização
    const problematicSessions = sessions.filter(s => 
      s.useProfileKeywords && 
      (s.brandProfile.safeKeywords?.length || 0) === 0
    )
    
    if (problematicSessions.length > 0) {
      problemsFound.push(`❌ ${problematicSessions.length} Sessions configuradas para usar profile keywords mas o perfil não tem keywords`)
    }
    
    // Sessions com totalKeywords = 0
    const sessionsWithoutTotal = sessions.filter(s => s.totalKeywords === 0)
    
    if (sessionsWithoutTotal.length > 0) {
      problemsFound.push(`❌ ${sessionsWithoutTotal.length} Sessions com totalKeywords=0`)
    }
    
    if (problemsFound.length === 0) {
      console.log('✅ Nenhum problema crítico encontrado!')
    } else {
      console.log('\n❌ PROBLEMAS ENCONTRADOS:')
      problemsFound.forEach(problem => console.log(`   ${problem}`))
    }

    // 6. Sugestões de correção
    console.log('\n\n6️⃣ SUGESTÕES DE CORREÇÃO:')
    
    if (profilesWithoutKeywords.length > 0) {
      console.log('\n🔧 Para Brand Profiles sem keywords:')
      console.log('   1. Execute a geração de keywords seguras:')
      profilesWithoutKeywords.forEach(profile => {
        console.log(`   POST /api/brand-profiles/${profile.id}/generate-keywords`)
      })
    }
    
    if (problematicSessions.length > 0) {
      console.log('\n🔧 Para Sessions problemáticas:')
      console.log('   1. Execute a sincronização manual:')
      problematicSessions.forEach(session => {
        console.log(`   PATCH /api/monitoring-sessions/${session.id}/status { "action": "sync_keywords" }`)
      })
    }
    
    if (reviews.length > 0) {
      console.log('\n🔧 Para Reviews pendentes:')
      console.log('   1. Aprove keywords seguras em lote:')
      console.log('   PATCH /api/keyword-reviews { "action": "bulk_approve", "reviewIds": [...] }')
    }

  } catch (error) {
    console.error('❌ Erro durante o diagnóstico:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch(console.error)
