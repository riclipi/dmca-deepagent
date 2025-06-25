#!/usr/bin/env node

/**
 * Script para corrigir sessions com contagem incorreta de keywords
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 CORRIGINDO CONTAGEM DE KEYWORDS NAS SESSIONS...\n')
  
  try {
    // Buscar sessions que usam profile keywords
    const sessions = await prisma.monitoringSession.findMany({
      where: {
        useProfileKeywords: true,
        isActive: true
      },
      include: {
        brandProfile: {
          select: {
            id: true,
            brandName: true,
            safeKeywords: true
          }
        }
      }
    })

    console.log(`📋 Sessions encontradas: ${sessions.length}`)
    
    for (const session of sessions) {
      const profileKeywordsCount = session.brandProfile.safeKeywords?.length || 0
      const customKeywordsCount = session.customKeywords?.length || 0
      const excludeKeywordsCount = session.excludeKeywords?.length || 0
      
      const expectedTotal = profileKeywordsCount + customKeywordsCount - excludeKeywordsCount
      const currentTotal = session.totalKeywords
      
      console.log(`\n🔍 ${session.name}`)
      console.log(`   Brand: ${session.brandProfile.brandName}`)
      console.log(`   Profile keywords: ${profileKeywordsCount}`)
      console.log(`   Custom keywords: ${customKeywordsCount}`)
      console.log(`   Exclude keywords: ${excludeKeywordsCount}`)
      console.log(`   Current total: ${currentTotal}`)
      console.log(`   Expected total: ${expectedTotal}`)
      
      if (currentTotal !== expectedTotal) {
        console.log(`   ❌ CORRIGINDO: ${currentTotal} → ${expectedTotal}`)
        
        await prisma.monitoringSession.update({
          where: { id: session.id },
          data: {
            totalKeywords: expectedTotal,
            processedKeywords: 0, // Reset progress
            progress: 0,
            currentKeyword: null
          }
        })
        
        console.log(`   ✅ CORRIGIDO!`)
      } else {
        console.log(`   ✅ OK`)
      }
    }
    
    console.log('\n🎉 CORREÇÃO CONCLUÍDA!')

  } catch (error) {
    console.error('❌ Erro durante a correção:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch(console.error)
