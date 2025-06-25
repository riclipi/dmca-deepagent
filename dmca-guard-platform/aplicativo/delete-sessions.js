#!/usr/bin/env node

/**
 * Script para deletar sessions específicas por ID
 */

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 DELETANDO SESSIONS...\n')
  
  try {
    const sessionIds = [
      'cmc3t74bl00058k8dpa9sdhgf',
      'cmc3ylmzi00018k3krpv4hsia',
      'cmc3z0ww200058k3kmyttpp7j'
    ]

    for (const sessionId of sessionIds) {
      console.log(`🔍 Tentando deletar sessão: ${sessionId}`)

      // Try to delete the session
      try {
        await prisma.monitoringSession.delete({
          where: { id: sessionId }
        })
        console.log(`✅ Sessão ${sessionId} deletada com sucesso.`)
      } catch (error) {
        console.log(`❌ Erro ao deletar sessão ${sessionId}:`, error.message)
      }
    }

  } catch (error) {
    console.error('Erro durante a deleção das sessions:', error)
  } finally {
    await prisma.$disconnect()
    console.log('\n🛠️ Script de deleção concluído.')
  }
}

main()
  .catch(console.error)
