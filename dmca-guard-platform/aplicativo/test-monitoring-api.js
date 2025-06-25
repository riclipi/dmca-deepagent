#!/usr/bin/env node

/**
 * Teste da API de Monitoring Sessions
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('🧪 TESTANDO API DE MONITORING SESSIONS...\n')
  
  try {
    // 1. Buscar brand profiles para usar nos testes
    console.log('1️⃣ Buscando Brand Profiles...')
    const brandProfiles = await prisma.brandProfile.findMany({
      where: { isActive: true },
      select: {
        id: true,
        brandName: true,
        _count: { select: { monitoringSessions: true } }
      }
    })

    for (const profile of brandProfiles) {
      console.log(`   🏷️  ${profile.brandName} (${profile.id})`)
      console.log(`      Sessions: ${profile._count.monitoringSessions}`)
    }

    // 2. Buscar todas as monitoring sessions
    console.log('\n2️⃣ Testando busca de todas as sessions...')
    const allSessions = await prisma.monitoringSession.findMany({
      where: { isActive: true },
      include: {
        brandProfile: {
          select: {
            id: true,
            brandName: true
          }
        }
      }
    })

    console.log(`   📊 Total de sessions ativas: ${allSessions.length}`)
    
    for (const session of allSessions) {
      console.log(`   🔍 ${session.name}`)
      console.log(`      Brand: ${session.brandProfile.brandName}`)
      console.log(`      Profile ID: ${session.brandProfileId}`)
      console.log(`      Keywords: ${session.totalKeywords}`)
    }

    // 3. Testar filtro por brandProfileId
    if (brandProfiles.length > 0) {
      const testProfileId = brandProfiles[0].id
      
      console.log(`\n3️⃣ Testando filtro por brandProfileId: ${testProfileId}`)
      
      const filteredSessions = await prisma.monitoringSession.findMany({
        where: {
          isActive: true,
          brandProfileId: testProfileId
        },
        include: {
          brandProfile: {
            select: {
              id: true,
              brandName: true
            }
          }
        }
      })

      console.log(`   📊 Sessions filtradas: ${filteredSessions.length}`)
      
      for (const session of filteredSessions) {
        console.log(`   🔍 ${session.name}`)
        console.log(`      ✅ Brand Profile ID correto: ${session.brandProfileId === testProfileId}`)
      }

      // 4. Simular formato da API
      console.log('\n4️⃣ Formato da resposta da API:')
      const apiResponse = {
        sessions: filteredSessions,
        total: filteredSessions.length
      }
      
      console.log('   📄 Resposta simulada:')
      console.log(`   {`)
      console.log(`     "sessions": [`)
      apiResponse.sessions.forEach((session, index) => {
        console.log(`       {`)
        console.log(`         "id": "${session.id}",`)
        console.log(`         "name": "${session.name}",`)
        console.log(`         "brandProfileId": "${session.brandProfileId}",`)
        console.log(`         "totalKeywords": ${session.totalKeywords}`)
        console.log(`       }${index < apiResponse.sessions.length - 1 ? ',' : ''}`)
      })
      console.log(`     ],`)
      console.log(`     "total": ${apiResponse.total}`)
      console.log(`   }`)
    }

    console.log('\n✅ TESTE CONCLUÍDO!')

  } catch (error) {
    console.error('❌ Erro durante o teste:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch(console.error)
