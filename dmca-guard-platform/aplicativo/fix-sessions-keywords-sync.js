#!/usr/bin/env node

/**
 * Script de Correção: Sincronização Session ↔ Keywords
 * 
 * Este script corrige a sincronização entre sessions e keywords dos brand profiles
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 CORREÇÃO: Sincronização Session ↔ Keywords\n')
  
  try {
    // 1. Buscar todas as sessions que usam profile keywords
    console.log('1️⃣ BUSCANDO SESSIONS PROBLEMÁTICAS...')
    const sessions = await prisma.monitoringSession.findMany({
      where: {
        isActive: true,
        useProfileKeywords: true
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

    console.log(`📋 Total de sessions encontradas: ${sessions.length}`)
    
    const sessionsToFix = []
    
    for (const session of sessions) {
      const profileKeywords = session.brandProfile.safeKeywords || []
      const currentTotal = session.totalKeywords
      const expectedTotal = profileKeywords.length + 
                          (session.customKeywords?.length || 0) - 
                          (session.excludeKeywords?.length || 0)
      
      console.log(`\n  🔍 ${session.name}`)
      console.log(`     Brand: ${session.brandProfile.brandName}`)
      console.log(`     Keywords do perfil: ${profileKeywords.length}`)
      console.log(`     Total atual: ${currentTotal}`)
      console.log(`     Total esperado: ${expectedTotal}`)
      
      if (currentTotal !== expectedTotal) {
        console.log(`     ❌ PRECISA CORREÇÃO!`)
        sessionsToFix.push({
          session,
          expectedTotal,
          profileKeywords: profileKeywords.length
        })
      } else {
        console.log(`     ✅ OK`)
      }
    }
    
    if (sessionsToFix.length === 0) {
      console.log('\n✅ Todas as sessions estão sincronizadas!')
      return
    }
    
    console.log(`\n2️⃣ CORRIGINDO ${sessionsToFix.length} SESSIONS...`)
    
    for (const { session, expectedTotal, profileKeywords } of sessionsToFix) {
      try {
        console.log(`\n  🔧 Corrigindo: ${session.name}`)
        
        await prisma.monitoringSession.update({
          where: { id: session.id },
          data: {
            totalKeywords: expectedTotal,
            processedKeywords: 0, // Reset progress
            progress: 0,
            currentKeyword: null
          }
        })
        
        console.log(`     ✅ Atualizado: totalKeywords=${expectedTotal}`)
        console.log(`     🔄 Progress resetado para nova contagem`)
        
      } catch (error) {
        console.log(`     ❌ ERRO: ${error.message}`)
      }
    }
    
    // 3. Verificar se a sincronização funcionou
    console.log('\n3️⃣ VERIFICANDO CORREÇÕES...')
    
    const verifySession = await prisma.monitoringSession.findMany({
      where: {
        id: { in: sessionsToFix.map(s => s.session.id) }
      },
      select: {
        id: true,
        name: true,
        totalKeywords: true,
        brandProfile: {
          select: {
            brandName: true,
            safeKeywords: true
          }
        }
      }
    })
    
    for (const session of verifySession) {
      const profileKeywords = session.brandProfile.safeKeywords?.length || 0
      console.log(`\n  ✅ ${session.name}`)
      console.log(`     Keywords do perfil: ${profileKeywords}`)
      console.log(`     Total da session: ${session.totalKeywords}`)
      
      if (session.totalKeywords === profileKeywords) {
        console.log(`     ✅ SINCRONIZADO!`)
      } else {
        console.log(`     ⚠️  Ainda há diferença...`)
      }
    }
    
    console.log('\n🎉 CORREÇÃO CONCLUÍDA!')
    console.log('\n💡 PRÓXIMOS PASSOS:')
    console.log('   1. Teste as sessions no dashboard')
    console.log('   2. Inicie uma session para verificar se as keywords aparecem')
    console.log('   3. Se ainda houver problemas, verifique os brand profiles')
    
  } catch (error) {
    console.error('❌ Erro durante a correção:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch(console.error)
