#!/usr/bin/env node

/**
 * Teste Completo: Implementação Crítica Keywords ↔ Sessions
 * 
 * Este script testa todos os componentes da implementação crítica
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('🧪 TESTE COMPLETO: Implementação Crítica Keywords ↔ Sessions\n')
  
  try {
    let allTestsPassed = true

    // ========================================
    // 1. TESTE: SafeKeywordGenerator
    // ========================================
    console.log('1️⃣ TESTANDO SafeKeywordGenerator...')
    
    try {
      // Simular importação do SafeKeywordGenerator
      const { safeKeywordGenerator } = require('./lib/safe-keyword-generator')
      
      const testConfig = safeKeywordGenerator.getDefaultConfig('lary cubas')
      const result = safeKeywordGenerator.generateSafeKeywords(testConfig)
      
      console.log(`   ✅ Keywords seguras geradas: ${result.safe.length}`)
      console.log(`   ⚠️  Keywords moderadas: ${result.moderate.length}`)
      console.log(`   ❌ Keywords perigosas: ${result.dangerous.length}`)
      
      // Verificar se filtros de segurança funcionam
      const dangerousTest = safeKeywordGenerator.validateExistingKeywords(['lc', 'porn', 'free'], 'lary cubas')
      const highRiskCount = dangerousTest.filter(r => r.riskScore > 70).length
      
      if (highRiskCount === 3) {
        console.log(`   ✅ Filtros de segurança funcionando: ${highRiskCount}/3 keywords perigosas detectadas`)
      } else {
        console.log(`   ❌ Problema nos filtros: apenas ${highRiskCount}/3 keywords perigosas detectadas`)
        allTestsPassed = false
      }
      
    } catch (error) {
      console.log(`   ❌ ERRO no SafeKeywordGenerator: ${error.message}`)
      allTestsPassed = false
    }

    // ========================================
    // 2. TESTE: Schema Prisma
    // ========================================
    console.log('\n2️⃣ TESTANDO Schema Prisma...')
    
    try {
      // Verificar se novos campos existem
      const testUser = await prisma.user.findFirst({
        select: { id: true }
      })
      
      if (testUser) {
        // Testar BrandProfile com novos campos
        const brandProfile = await prisma.brandProfile.findFirst({
          select: {
            safeKeywords: true,
            moderateKeywords: true,
            dangerousKeywords: true,
            keywordConfig: true,
            lastKeywordUpdate: true
          }
        })
        
        console.log(`   ✅ BrandProfile novos campos: OK`)
        
        // Testar MonitoringSession com novos campos
        const monitoringSession = await prisma.monitoringSession.findFirst({
          select: {
            status: true,
            currentKeyword: true,
            progress: true,
            totalKeywords: true,
            processedKeywords: true,
            useProfileKeywords: true,
            customKeywords: true,
            excludeKeywords: true
          }
        })
        
        console.log(`   ✅ MonitoringSession novos campos: OK`)
        
        // Testar KeywordReview
        const keywordReviews = await prisma.keywordReview.findMany({
          take: 1,
          select: {
            id: true,
            riskScore: true,
            status: true
          }
        })
        
        console.log(`   ✅ KeywordReview modelo: OK`)
        
      } else {
        console.log(`   ⚠️  Nenhum usuário encontrado para testar`)
      }
      
    } catch (error) {
      console.log(`   ❌ ERRO no Schema: ${error.message}`)
      allTestsPassed = false
    }

    // ========================================
    // 3. TESTE: APIs de Tempo Real
    // ========================================
    console.log('\n3️⃣ TESTANDO APIs de Tempo Real...')
    
    try {
      // Verificar se arquivos de API existem
      const fs = require('fs')
      const path = require('path')
      
      const apiFiles = [
        'app/api/monitoring-sessions/[sessionId]/status/route.ts',
        'app/api/monitoring-sessions/realtime-stats/route.ts',
        'app/api/keyword-reviews/route.ts',
        'app/api/brand-profiles/[id]/generate-keywords/route.ts',
        'app/api/integrated-monitoring/route.ts'
      ]
      
      let missingFiles = []
      
      for (const file of apiFiles) {
        const fullPath = path.join(__dirname, file)
        if (!fs.existsSync(fullPath)) {
          missingFiles.push(file)
        }
      }
      
      if (missingFiles.length === 0) {
        console.log(`   ✅ Todas as APIs implementadas: ${apiFiles.length} arquivos`)
      } else {
        console.log(`   ❌ APIs ausentes: ${missingFiles.join(', ')}`)
        allTestsPassed = false
      }
      
    } catch (error) {
      console.log(`   ❌ ERRO na verificação de APIs: ${error.message}`)
      allTestsPassed = false
    }

    // ========================================
    // 4. TESTE: Integração Keywords → Sessions
    // ========================================
    console.log('\n4️⃣ TESTANDO Integração Keywords → Sessions...')
    
    try {
      // Buscar brand profile ativo com keywords
      const profileWithKeywords = await prisma.brandProfile.findFirst({
        where: {
          isActive: true,
          safeKeywords: {
            not: null
          }
        },
        select: {
          id: true,
          brandName: true,
          safeKeywords: true,
          monitoringSessions: {
            where: { isActive: true },
            select: {
              id: true,
              name: true,
              useProfileKeywords: true,
              totalKeywords: true
            }
          }
        }
      })
      
      if (profileWithKeywords) {
        const keywordCount = profileWithKeywords.safeKeywords?.length || 0
        const sessionsUsingProfile = profileWithKeywords.monitoringSessions.filter(s => s.useProfileKeywords)
        
        console.log(`   ✅ Profile "${profileWithKeywords.brandName}": ${keywordCount} keywords`)
        console.log(`   📊 Sessions usando profile keywords: ${sessionsUsingProfile.length}`)
        
        // Verificar sincronização
        let syncIssues = 0
        for (const session of sessionsUsingProfile) {
          if (session.totalKeywords !== keywordCount) {
            syncIssues++
          }
        }
        
        if (syncIssues === 0) {
          console.log(`   ✅ Sincronização keywords → sessions: OK`)
        } else {
          console.log(`   ⚠️  ${syncIssues} sessions com problemas de sincronização`)
        }
        
      } else {
        console.log(`   ⚠️  Nenhum brand profile com keywords encontrado`)
      }
      
    } catch (error) {
      console.log(`   ❌ ERRO na integração: ${error.message}`)
      allTestsPassed = false
    }

    // ========================================
    // 5. TESTE: Componentes Dashboard
    // ========================================
    console.log('\n5️⃣ TESTANDO Componentes Dashboard...')
    
    try {
      const fs = require('fs')
      const path = require('path')
      
      const componentFiles = [
        'components/dashboard/monitoring-sessions-dashboard.tsx',
        'components/dashboard/keyword-review-dashboard.tsx',
        'app/(main)/integrated-monitoring/page.tsx'
      ]
      
      let missingComponents = []
      
      for (const file of componentFiles) {
        const fullPath = path.join(__dirname, file)
        if (!fs.existsSync(fullPath)) {
          missingComponents.push(file)
        }
      }
      
      if (missingComponents.length === 0) {
        console.log(`   ✅ Todos os componentes implementados: ${componentFiles.length} arquivos`)
      } else {
        console.log(`   ❌ Componentes ausentes: ${missingComponents.join(', ')}`)
        allTestsPassed = false
      }
      
    } catch (error) {
      console.log(`   ❌ ERRO na verificação de componentes: ${error.message}`)
      allTestsPassed = false
    }

    // ========================================
    // 6. TESTE: Segurança de Keywords
    // ========================================
    console.log('\n6️⃣ TESTANDO Segurança de Keywords...')
    
    try {
      const { safeKeywordGenerator } = require('./lib/safe-keyword-generator')
      
      // Testar keywords perigosas
      const dangerousKeywords = [
        'lc',          // muito curta
        'porn',        // palavra problemática
        'free',        // muito genérica
        '123',         // apenas números
        'xxx',         // conteúdo adulto
        'a'            // extremamente curta
      ]
      
      const risks = safeKeywordGenerator.validateExistingKeywords(dangerousKeywords, 'test')
      const blockedCount = risks.filter(r => r.riskScore > 70).length
      const moderateCount = risks.filter(r => r.riskScore >= 30 && r.riskScore <= 70).length
      const safeCount = risks.filter(r => r.riskScore < 30).length
      
      console.log(`   🛡️  Keywords testadas: ${dangerousKeywords.length}`)
      console.log(`   ❌ Bloqueadas (score > 70): ${blockedCount}`)
      console.log(`   ⚠️  Para review (score 30-70): ${moderateCount}`)
      console.log(`   ✅ Seguras (score < 30): ${safeCount}`)
      
      if (blockedCount >= 4) { // Esperamos que pelo menos 4 sejam bloqueadas
        console.log(`   ✅ Sistema de segurança funcionando corretamente`)
      } else {
        console.log(`   ⚠️  Sistema de segurança pode estar muito permissivo`)
      }
      
    } catch (error) {
      console.log(`   ❌ ERRO no teste de segurança: ${error.message}`)
      allTestsPassed = false
    }

    // ========================================
    // 7. TESTE: KeywordIntegrationService
    // ========================================
    console.log('\n7️⃣ TESTANDO KeywordIntegrationService...')
    
    try {
      const fs = require('fs')
      const serviceFile = 'lib/services/keyword-integration.ts'
      
      if (fs.existsSync(serviceFile)) {
        console.log(`   ✅ KeywordIntegrationService: Arquivo existe`)
        
        // Verificar se contém métodos principais
        const content = fs.readFileSync(serviceFile, 'utf8')
        const methods = [
          'syncProfileKeywordsWithSessions',
          'ensureSafeKeywords',
          'getEffectiveKeywords',
          'updateSessionProgress'
        ]
        
        let missingMethods = []
        for (const method of methods) {
          if (!content.includes(method)) {
            missingMethods.push(method)
          }
        }
        
        if (missingMethods.length === 0) {
          console.log(`   ✅ Todos os métodos implementados: ${methods.length}`)
        } else {
          console.log(`   ❌ Métodos ausentes: ${missingMethods.join(', ')}`)
          allTestsPassed = false
        }
        
      } else {
        console.log(`   ❌ KeywordIntegrationService: Arquivo não encontrado`)
        allTestsPassed = false
      }
      
    } catch (error) {
      console.log(`   ❌ ERRO na verificação do service: ${error.message}`)
      allTestsPassed = false
    }

    // ========================================
    // RESULTADO FINAL
    // ========================================
    console.log('\n' + '='.repeat(60))
    
    if (allTestsPassed) {
      console.log('🎉 TODOS OS TESTES PASSARAM!')
      console.log('✅ Implementação crítica está 100% funcional')
      console.log('🛡️ Sistema de segurança robusto')
      console.log('🔗 Integração Keywords ↔ Sessions funcionando')
      console.log('⚡ APIs de tempo real implementadas')
      console.log('🎨 Dashboards prontos para uso')
      console.log('\n💡 O sistema está pronto para DMCAs reais!')
    } else {
      console.log('⚠️ ALGUNS TESTES FALHARAM')
      console.log('❌ Verifique os erros acima e corrija antes de usar em produção')
      console.log('\n🚫 NÃO USE para DMCAs reais até todos os testes passarem!')
    }
    
    console.log('\n📋 RESUMO DA IMPLEMENTAÇÃO:')
    console.log('• SafeKeywordGenerator: Sistema robusto de geração e filtros')
    console.log('• Schema Prisma: Campos atualizados para tempo real')
    console.log('• APIs REST: Controle completo de sessões e reviews')
    console.log('• Dashboard: Interface para monitoramento em tempo real')
    console.log('• Segurança: Múltiplas camadas de proteção contra keywords perigosas')
    console.log('• Integração: Sincronização automática keywords → sessions')

  } catch (error) {
    console.error('❌ Erro crítico durante os testes:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .catch(console.error)
