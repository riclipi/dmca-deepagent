#!/usr/bin/env node

/**
 * Teste da busca real com keywords específicas
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 TESTANDO BUSCA REAL COM KEYWORDS ESPECÍFICAS...\n')
  
  try {
    // 1. Verificar brand profiles com keywords
    console.log('1️⃣ Brand Profiles com Keywords...')
    
    const profiles = await prisma.brandProfile.findMany({
      where: { 
        isActive: true,
        safeKeywords: { isEmpty: false }
      },
      select: {
        id: true,
        brandName: true,
        safeKeywords: true,
        moderateKeywords: true,
        monitoringSessions: {
          where: { isActive: true },
          select: {
            id: true,
            name: true,
            totalKeywords: true,
            customKeywords: true,
            excludeKeywords: true
          }
        }
      }
    })

    for (const profile of profiles) {
      console.log(`\n   🏷️  ${profile.brandName} (${profile.id})`)
      console.log(`      ✅ Safe Keywords: ${profile.safeKeywords?.length || 0}`)
      console.log(`      ⚠️  Moderate Keywords: ${profile.moderateKeywords?.length || 0}`)
      
      if (profile.safeKeywords && profile.safeKeywords.length > 0) {
        console.log(`      📝 Exemplos: ${profile.safeKeywords.slice(0, 3).join(', ')}`)
      }
      
      console.log(`      🔗 Sessions: ${profile.monitoringSessions.length}`)
      
      for (const session of profile.monitoringSessions) {
        console.log(`         🔍 ${session.name}`)
        console.log(`            Total: ${session.totalKeywords}`)
        console.log(`            Custom: ${session.customKeywords?.length || 0}`)
        console.log(`            Exclude: ${session.excludeKeywords?.length || 0}`)
      }
    }

    // 2. Simular lógica de keywords para busca
    console.log('\n2️⃣ Simulando Lógica de Keywords...')
    
    for (const profile of profiles.slice(0, 1)) { // Testar apenas o primeiro
      console.log(`\n   🧪 Testando para: ${profile.brandName}`)
      
      // Simular a mesma lógica da API
      let keywordsToSearch = []
      
      if (profile.safeKeywords && profile.safeKeywords.length > 0) {
        keywordsToSearch = [...profile.safeKeywords]
        console.log(`      🔐 Usando ${keywordsToSearch.length} keywords seguras`)
      } else {
        keywordsToSearch = [profile.brandName]
        console.log(`      ⚠️  Fallback para nome da marca`)
      }
      
      // Adicionar custom keywords se houver
      if (profile.monitoringSessions.length > 0) {
        const session = profile.monitoringSessions[0]
        if (session.customKeywords && session.customKeywords.length > 0) {
          keywordsToSearch.push(...session.customKeywords)
          console.log(`      ➕ Adicionadas ${session.customKeywords.length} keywords customizadas`)
        }
        
        if (session.excludeKeywords && session.excludeKeywords.length > 0) {
          const beforeCount = keywordsToSearch.length
          keywordsToSearch = keywordsToSearch.filter(k => !session.excludeKeywords.includes(k))
          const removed = beforeCount - keywordsToSearch.length
          console.log(`      ➖ Removidas ${removed} keywords excluídas`)
        }
      }
      
      console.log(`\n      🎯 KEYWORDS FINAIS PARA BUSCA:`)
      console.log(`         Total: ${keywordsToSearch.length}`)
      console.log(`         Lista: ${keywordsToSearch.slice(0, 5).join(', ')}${keywordsToSearch.length > 5 ? '...' : ''}`)
      
      // Mostrar o que seria buscado
      console.log(`\n      🔍 BUSCAS QUE SERIAM EXECUTADAS:`)
      keywordsToSearch.slice(0, 3).forEach((keyword, index) => {
        console.log(`         ${index + 1}. "${keyword}"`)
        console.log(`            - "${keyword} vazado"`)
        console.log(`            - "${keyword} leak"`)
        console.log(`            - site:twitter.com "${keyword}"`)
      })
      
      if (keywordsToSearch.length > 3) {
        console.log(`         ... e mais ${keywordsToSearch.length - 3} keywords`)
      }
    }

    // 3. Verificar se há sessions ativas para testar
    console.log('\n3️⃣ Sessions Disponíveis para Teste...')
    
    const activeSessions = await prisma.monitoringSession.findMany({
      where: { 
        isActive: true,
        brandProfile: {
          safeKeywords: { isEmpty: false }
        }
      },
      include: {
        brandProfile: {
          select: {
            brandName: true,
            safeKeywords: true
          }
        }
      }
    })

    for (const session of activeSessions) {
      console.log(`\n   🔍 ${session.name}`)
      console.log(`      Brand: ${session.brandProfile.brandName}`)
      console.log(`      Keywords do perfil: ${session.brandProfile.safeKeywords?.length || 0}`)
      console.log(`      Status: ${session.status}`)
      console.log(`      ✅ PRONTA PARA BUSCA REAL!`)
    }

    console.log('\n✅ DIAGNÓSTICO CONCLUÍDO!')
    console.log('\n💡 AGORA A BUSCA USARÁ:')
    console.log('   1. Keywords seguras do Brand Profile')
    console.log('   2. Keywords customizadas da Session')
    console.log('   3. Menos keywords excluídas')
    console.log('   4. NUNCA mais apenas o nome da marca!')

  } catch (error) {
    console.error('❌ Erro durante o teste:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch(console.error)
