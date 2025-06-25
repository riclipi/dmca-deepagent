#!/usr/bin/env node

/**
 * Verificação das correções de routes
 */

const fs = require('fs')
const path = require('path')

function checkRouteFile(filePath) {
  console.log(`\n🔍 Verificando: ${filePath}`)
  
  if (!fs.existsSync(filePath)) {
    console.log(`   ❌ Arquivo não encontrado`)
    return false
  }
  
  const content = fs.readFileSync(filePath, 'utf8')
  
  // Verificar se params está sendo await
  const hasProperParamsHandling = content.includes('await params') || content.includes('resolvedParams = await params')
  
  // Verificar se não tem uso direto de params.id sem await
  const hasDirectParamsAccess = /params\.[a-zA-Z]/.test(content) && !content.includes('resolvedParams')
  
  // Verificar imports corretos
  const hasCorrectPrismaImport = content.includes("from '@/lib/db'") || !content.includes('prisma')
  const hasIncorrectPrismaImport = content.includes("from '@/lib/prisma'")
  
  console.log(`   📋 Await params: ${hasProperParamsHandling ? '✅' : '❌'}`)
  console.log(`   📋 Sem acesso direto params: ${!hasDirectParamsAccess ? '✅' : '❌'}`)
  console.log(`   📋 Import prisma correto: ${hasCorrectPrismaImport && !hasIncorrectPrismaImport ? '✅' : '❌'}`)
  
  const isFixed = hasProperParamsHandling && !hasDirectParamsAccess && hasCorrectPrismaImport && !hasIncorrectPrismaImport
  
  console.log(`   🎯 Status: ${isFixed ? '✅ CORRIGIDO' : '❌ PRECISA CORREÇÃO'}`)
  
  return isFixed
}

function main() {
  console.log('🔧 VERIFICAÇÃO DAS CORREÇÕES DE ROUTES\n')
  
  const routesToCheck = [
    'app/api/brand-profiles/[id]/generate-safe-keywords/route.ts',
    'app/api/monitoring-sessions/[sessionId]/route.ts',
    'app/api/monitoring-sessions/[sessionId]/status/route.ts'
  ]
  
  let allFixed = true
  
  for (const route of routesToCheck) {
    const fullPath = path.join(__dirname, route)
    const isFixed = checkRouteFile(fullPath)
    if (!isFixed) {
      allFixed = false
    }
  }
  
  console.log('\n' + '='.repeat(60))
  
  if (allFixed) {
    console.log('🎉 TODAS AS ROUTES FORAM CORRIGIDAS!')
    console.log('✅ Compatibilidade com Next.js 15')
    console.log('✅ Imports corretos')
    console.log('✅ Await params implementado')
    console.log('\n💡 As routes devem funcionar sem erros agora!')
  } else {
    console.log('⚠️ ALGUMAS ROUTES AINDA PRECISAM CORREÇÃO')
    console.log('❌ Verifique os problemas apontados acima')
  }
}

main()
