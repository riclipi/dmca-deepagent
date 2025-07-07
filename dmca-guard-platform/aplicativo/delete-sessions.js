#!/usr/bin/env node

/**
 * Script para deletar sessions específicas por ID
 * AVISO: Este script é destrutivo e deve ser usado apenas em ambientes de teste
 */

const { PrismaClient } = require('@prisma/client');
const { 
  validateTestEnvironment, 
  logTestHeader,
  confirmAction 
} = require('./lib/test-utils');

const prisma = new PrismaClient();

async function main() {
  // Validate test environment
  validateTestEnvironment();
  
  // Log script header
  logTestHeader('DELETE MONITORING SESSIONS');
  
  try {
    // Get session IDs from command line arguments or environment
    let sessionIds = process.argv.slice(2);
    
    if (sessionIds.length === 0) {
      // Try to get from environment variable
      const envSessionIds = process.env.TEST_DELETE_SESSION_IDS;
      if (envSessionIds) {
        sessionIds = envSessionIds.split(',').map(id => id.trim());
      }
    }
    
    if (sessionIds.length === 0) {
      console.error('❌ ERRO: Nenhum ID de sessão fornecido!');
      console.error('\nUso:');
      console.error('  node delete-sessions.js <session_id_1> <session_id_2> ...');
      console.error('  ou configure TEST_DELETE_SESSION_IDS no arquivo .env');
      return;
    }
    
    console.log('⚠️  AVISO: Esta operação é irreversível!');
    console.log(`📋 Sessões a serem deletadas: ${sessionIds.length}`);
    sessionIds.forEach((id, index) => {
      console.log(`  ${index + 1}. ${id}`);
    });
    console.log('');
    
    // Confirm action
    const confirmed = await confirmAction(`Isso deletará permanentemente ${sessionIds.length} sessão(ões).`);
    if (!confirmed) {
      console.log('❌ Operação cancelada pelo usuário.');
      return;
    }

    console.log('\n🗑️  Iniciando deleção...\n');
    
    let successCount = 0;
    let errorCount = 0;

    for (const sessionId of sessionIds) {
      console.log(`🔍 Processando sessão: ${sessionId}`);

      try {
        // First check if session exists
        const session = await prisma.monitoringSession.findUnique({
          where: { id: sessionId },
          select: {
            id: true,
            name: true,
            _count: {
              select: {
                detectedContents: true,
                violationHistories: true
              }
            }
          }
        });

        if (!session) {
          console.log(`⏭️  Sessão não encontrada: ${sessionId}`);
          errorCount++;
          continue;
        }

        console.log(`   Nome: ${session.name}`);
        console.log(`   Conteúdos detectados: ${session._count.detectedContents}`);
        console.log(`   Histórico de violações: ${session._count.violationHistories}`);

        // Delete the session (cascade will handle related records)
        await prisma.monitoringSession.delete({
          where: { id: sessionId }
        });
        
        console.log(`✅ Sessão deletada com sucesso: ${sessionId}`);
        successCount++;
      } catch (error) {
        console.log(`❌ Erro ao deletar sessão ${sessionId}: ${error.message}`);
        errorCount++;
      }
    }

    console.log('\n📊 Resumo da operação:');
    console.log(`✅ Deletadas com sucesso: ${successCount}`);
    console.log(`❌ Erros: ${errorCount}`);

  } catch (error) {
    console.error('❌ Erro fatal durante a deleção:', error);
  } finally {
    await prisma.$disconnect();
    console.log('\n--- SCRIPT FINALIZADO ---');
  }
}

// Execute only if called directly
if (require.main === module) {
  main().catch(console.error);
}

module.exports = main;