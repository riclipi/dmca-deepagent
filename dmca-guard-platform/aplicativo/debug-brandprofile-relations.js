#!/usr/bin/env node

/**
 * Script para investigar relações entre BrandProfile e MonitoringSession
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 INVESTIGAÇÃO: BrandProfile ↔ MonitoringSession Relations\n')
  
  try {
    // 1. Buscar todos os brand profiles
    console.log('1️⃣ ANALISANDO BRAND PROFILES...')
    const brandProfiles = await prisma.brandProfile.findMany({
      select: {
        id: true,
        brandName: true,
        userId: true,
        safeKeywords: true,
        isActive: true
      }
    })

    console.log(`📋 Total de Brand Profiles: ${brandProfiles.length}`)
    
    for (const profile of brandProfiles) {
      console.log(`\n  🏷️  ${profile.brandName} (${profile.id})`)
      console.log(`     User: ${profile.userId}`)
      console.log(`     Active: ${profile.isActive}`)
      console.log(`     Safe Keywords: ${profile.safeKeywords?.length || 0}`)
    }

    // 2. Buscar todas as monitoring sessions
    console.log('\n\n2️⃣ ANALISANDO MONITORING SESSIONS...')
    const sessions = await prisma.monitoringSession.findMany({
      select: {
        id: true,
        name: true,
        brandProfileId: true,
        userId: true,
        useProfileKeywords: true,
        totalKeywords: true,
        isActive: true
      }
    })

    console.log(`📋 Total de Monitoring Sessions: ${sessions.length}`)
    
    for (const session of sessions) {
      console.log(`\n  🔍 ${session.name} (${session.id})`)
      console.log(`     User: ${session.userId}`)
      console.log(`     BrandProfile ID: ${session.brandProfileId}`)
      console.log(`     Active: ${session.isActive}`)
      console.log(`     Use Profile Keywords: ${session.useProfileKeywords}`)
      console.log(`     Total Keywords: ${session.totalKeywords}`)
      
      // Verificar se o brandProfileId existe
      const profileExists = brandProfiles.find(p => p.id === session.brandProfileId)
      if (profileExists) {
        console.log(`     ✅ Brand Profile encontrado: ${profileExists.brandName}`)
        console.log(`     🎯 Keywords do perfil: ${profileExists.safeKeywords?.length || 0}`)
      } else {
        console.log(`     ❌ Brand Profile NÃO ENCONTRADO!`)
      }
    }

    // 3. Verificar sessions com JOIN direto
    console.log('\n\n3️⃣ TESTANDO JOIN DIRETO...')
    const sessionsWithProfile = await prisma.monitoringSession.findMany({
      where: { isActive: true },
      include: {
        brandProfile: true
      }
    })

    for (const session of sessionsWithProfile) {
      console.log(`\n  🔗 ${session.name}`)
      console.log(`     Session Brand Profile ID: ${session.brandProfileId}`)
      
      if (session.brandProfile) {
        console.log(`     ✅ JOIN SUCCESS: ${session.brandProfile.brandName}`)
        console.log(`     🏷️  Profile ID: ${session.brandProfile.id}`)
        console.log(`     🎯 Safe Keywords: ${session.brandProfile.safeKeywords?.length || 0}`)
        console.log(`     👤 Profile User: ${session.brandProfile.userId}`)
        console.log(`     🔄 Profile Active: ${session.brandProfile.isActive}`)
      } else {
        console.log(`     ❌ JOIN FAILED: brandProfile is null`)
      }
    }

    // 4. Verificar por inconsistências de userId
    console.log('\n\n4️⃣ VERIFICANDO INCONSISTÊNCIAS DE USUÁRIO...')
    
    for (const session of sessions) {
      const profile = brandProfiles.find(p => p.id === session.brandProfileId)
      
      if (profile && session.userId !== profile.userId) {
        console.log(`\n  ⚠️  INCONSISTÊNCIA ENCONTRADA:`)
        console.log(`     Session: ${session.name}`)
        console.log(`     Session User: ${session.userId}`)
        console.log(`     Profile User: ${profile.userId}`)
        console.log(`     ❌ USERS DIFERENTES!`)
      }
    }

    // 5. Verificar sessions órfãs
    console.log('\n\n5️⃣ VERIFICANDO SESSIONS ÓRFÃS...')
    
    const orphanSessions = sessions.filter(session => 
      !brandProfiles.find(p => p.id === session.brandProfileId)
    )

    if (orphanSessions.length > 0) {
      console.log(`❌ ${orphanSessions.length} sessions órfãs encontradas:`)
      orphanSessions.forEach(session => {
        console.log(`   - ${session.name} (${session.id}) -> brandProfileId: ${session.brandProfileId}`)
      })
    } else {
      console.log(`✅ Nenhuma session órfã encontrada`)
    }

    // 6. Tentar corrigir problemas automáticamente
    console.log('\n\n6️⃣ PROPONDO CORREÇÕES...')
    
    const problemSessions = sessionsWithProfile.filter(session => 
      session.useProfileKeywords && 
      session.totalKeywords === 0 && 
      session.brandProfile && 
      (session.brandProfile.safeKeywords?.length || 0) > 0
    )

    if (problemSessions.length > 0) {
      console.log(`\n🔧 ${problemSessions.length} sessions precisam de correção:`)
      
      for (const session of problemSessions) {
        const expectedTotal = session.brandProfile.safeKeywords?.length || 0
        console.log(`\n  🔧 ${session.name}:`)
        console.log(`     Atual: ${session.totalKeywords}`)
        console.log(`     Esperado: ${expectedTotal}`)
        console.log(`     Correção necessária: Sim`)
        
        // APLICAR CORREÇÃO AUTOMÁTICA
        try {
          await prisma.monitoringSession.update({
            where: { id: session.id },
            data: {
              totalKeywords: expectedTotal,
              processedKeywords: 0,
              progress: 0,
              currentKeyword: null
            }
          })
          console.log(`     ✅ CORRIGIDO AUTOMATICAMENTE!`)
        } catch (error) {
          console.log(`     ❌ Erro na correção: ${error.message}`)
        }
      }
    } else {
      console.log(`✅ Nenhuma session precisa de correção`)
    }

  } catch (error) {
    console.error('❌ Erro durante a investigação:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch(console.error)
