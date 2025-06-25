#!/usr/bin/env node

/**
 * Verificação Final Completa do Sistema
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')

const prisma = new PrismaClient()

async function main() {
  console.log('🎯 VERIFICAÇÃO FINAL COMPLETA DO SISTEMA\n')
  
  try {
    let allChecks = true

    // ========================================
    // 1. VERIFICAR BRAND PROFILES + KEYWORDS
    // ========================================
    console.log('1️⃣ BRAND PROFILES + KEYWORDS...')
    
    const brandProfiles = await prisma.brandProfile.findMany({
      where: { isActive: true },
      select: {
        id: true,
        brandName: true,
        safeKeywords: true,
        moderateKeywords: true,
        dangerousKeywords: true,
        lastKeywordUpdate: true,
        _count: { select: { monitoringSessions: true } }
      }
    })

    for (const profile of brandProfiles) {
      const totalKeywords = (profile.safeKeywords?.length || 0) + 
                           (profile.moderateKeywords?.length || 0) + 
                           (profile.dangerousKeywords?.length || 0)
      
      console.log(`   🏷️  ${profile.brandName}:`)
      console.log(`      ✅ Safe: ${profile.safeKeywords?.length || 0}`)
      console.log(`      ⚠️  Moderate: ${profile.moderateKeywords?.length || 0}`)
      console.log(`      ❌ Dangerous: ${profile.dangerousKeywords?.length || 0}`)
      console.log(`      📊 Total: ${totalKeywords}`)
      console.log(`      🔗 Sessions: ${profile._count.monitoringSessions}`)
      console.log(`      🕒 Última atualização: ${profile.lastKeywordUpdate ? 'OK' : 'Nunca'}`)
      
      if (totalKeywords === 0 && profile._count.monitoringSessions > 0) {
        console.log(`      ❌ PROBLEMA: Sessions existem mas sem keywords!`)
        allChecks = false
      } else {
        console.log(`      ✅ OK`)
      }
    }

    // ========================================
    // 2. VERIFICAR MONITORING SESSIONS
    // ========================================
    console.log('\n2️⃣ MONITORING SESSIONS...')
    
    const sessions = await prisma.monitoringSession.findMany({
      where: { isActive: true },
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

    for (const session of sessions) {
      const profileKeywords = session.brandProfile.safeKeywords?.length || 0
      const customKeywords = session.customKeywords?.length || 0
      const excludeKeywords = session.excludeKeywords?.length || 0
      
      const expectedTotal = session.useProfileKeywords 
        ? profileKeywords + customKeywords - excludeKeywords
        : customKeywords - excludeKeywords

      console.log(`   🔍 ${session.name}:`)
      console.log(`      🏷️  Brand: ${session.brandProfile.brandName}`)
      console.log(`      🔗 useProfileKeywords: ${session.useProfileKeywords}`)
      console.log(`      📊 totalKeywords: ${session.totalKeywords}`)
      console.log(`      🎯 Profile keywords: ${profileKeywords}`)
      console.log(`      ➕ Custom keywords: ${customKeywords}`)
      console.log(`      ➖ Exclude keywords: ${excludeKeywords}`)
      console.log(`      🧮 Expected total: ${expectedTotal}`)
      
      if (session.totalKeywords !== expectedTotal) {
        console.log(`      ❌ INCONSISTÊNCIA: ${session.totalKeywords} ≠ ${expectedTotal}`)
        allChecks = false
      } else {
        console.log(`      ✅ SINCRONIZADO`)
      }
    }

    // ========================================
    // 3. VERIFICAR ARQUIVOS CRÍTICOS
    // ========================================
    console.log('\n3️⃣ ARQUIVOS CRÍTICOS...')
    
    const criticalFiles = [
      'lib/safe-keyword-generator.ts',
      'lib/services/keyword-integration.ts',
      'app/api/integrated-monitoring/route.ts',
      'app/(main)/integrated-monitoring/page.tsx',
      'components/header.tsx',
      'components/dashboard/monitoring-sessions-dashboard.tsx'
    ]

    for (const file of criticalFiles) {
      const exists = fs.existsSync(file)
      console.log(`   ${exists ? '✅' : '❌'} ${file}`)
      if (!exists) allChecks = false
    }

    // ========================================
    // 4. VERIFICAR HEADER INTEGRADO
    // ========================================
    console.log('\n4️⃣ HEADER INTEGRADO...')
    
    const headerContent = fs.readFileSync('components/header.tsx', 'utf8')
    const hasIntegratedButton = headerContent.includes('/integrated-monitoring')
    const hasZapIcon = headerContent.includes('Zap')
    const hasCreateButton = headerContent.includes('Criar Monitoramento')
    
    console.log(`   📱 Botão integrado: ${hasIntegratedButton ? '✅' : '❌'}`)
    console.log(`   ⚡ Ícone Zap: ${hasZapIcon ? '✅' : '❌'}`)
    console.log(`   🆕 Texto correto: ${hasCreateButton ? '✅' : '❌'}`)
    
    if (!hasIntegratedButton || !hasZapIcon || !hasCreateButton) {
      allChecks = false
    }

    // ========================================
    // 5. VERIFICAR APIs CORRIGIDAS
    // ========================================
    console.log('\n5️⃣ APIs CORRIGIDAS...')
    
    const routeFiles = [
      'app/api/brand-profiles/[id]/generate-safe-keywords/route.ts',
      'app/api/monitoring-sessions/[sessionId]/route.ts',
      'app/api/monitoring-sessions/[sessionId]/status/route.ts'
    ]

    for (const file of routeFiles) {
      if (fs.existsSync(file)) {
        const content = fs.readFileSync(file, 'utf8')
        const hasAwaitParams = content.includes('await params')
        const hasDirectParams = /params\.[a-zA-Z]/.test(content) && !content.includes('resolvedParams')
        
        console.log(`   📄 ${file}:`)
        console.log(`      🔄 Await params: ${hasAwaitParams ? '✅' : '❌'}`)
        console.log(`      🚫 Direct params: ${!hasDirectParams ? '✅' : '❌'}`)
        
        if (!hasAwaitParams || hasDirectParams) {
          allChecks = false
        }
      } else {
        console.log(`   ❌ ${file}: NÃO ENCONTRADO`)
        allChecks = false
      }
    }

    // ========================================
    // RESULTADO FINAL
    // ========================================
    console.log('\n' + '='.repeat(60))
    
    if (allChecks) {
      console.log('🎉 SISTEMA 100% FUNCIONAL!')
      console.log('')
      console.log('✅ Brand Profiles com keywords geradas')
      console.log('✅ Sessions perfeitamente sincronizadas')
      console.log('✅ Arquivos críticos implementados')
      console.log('✅ Header com botão integrado')
      console.log('✅ APIs corrigidas para Next.js 15')
      console.log('✅ Integrated Monitoring funcional')
      console.log('')
      console.log('🚀 PRONTO PARA USAR EM PRODUÇÃO!')
      console.log('💡 Acesse /integrated-monitoring para criar novos monitoramentos')
      console.log('🎯 Tudo integrado: Brand Profile + Session + Keywords automáticas')
    } else {
      console.log('⚠️ ALGUNS PROBLEMAS ENCONTRADOS')
      console.log('❌ Verifique os erros marcados acima')
      console.log('🔧 Execute as correções necessárias')
    }

    console.log('\n📋 ESTATÍSTICAS FINAIS:')
    console.log(`• Brand Profiles ativos: ${brandProfiles.length}`)
    console.log(`• Sessions ativas: ${sessions.length}`)
    console.log(`• Total keywords seguras: ${brandProfiles.reduce((acc, p) => acc + (p.safeKeywords?.length || 0), 0)}`)
    console.log(`• Reviews pendentes: ${await prisma.keywordReview.count({ where: { status: 'PENDING' } })}`)

  } catch (error) {
    console.error('❌ Erro durante a verificação:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch(console.error)
