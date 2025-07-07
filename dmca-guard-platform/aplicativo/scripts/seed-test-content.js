const { PrismaClient } = require('@prisma/client');
const { 
  validateTestEnvironment, 
  getTestIds, 
  getTestContent,
  logTestHeader,
  confirmAction 
} = require('../lib/test-utils');

async function main() {
  // Validate we're in a test environment
  validateTestEnvironment();
  
  // Log script header
  logTestHeader('SEED TEST CONTENT');

  const prisma = new PrismaClient();
  
  try {
    // Get test IDs from environment
    const testIds = getTestIds();
    const testContent = getTestContent();
    
    // Show what we're about to do
    console.log('📋 Configuração do teste:');
    console.log(`- Brand Profile ID: ${testIds.brandProfileId}`);
    console.log(`- Monitoring Session ID: ${testIds.monitoringSessionId}`);
    console.log(`- URL Infratora: ${testContent.infringingUrl}`);
    console.log('');

    // Confirm action
    const confirmed = await confirmAction('Isso criará conteúdo de teste no banco de dados.');
    if (!confirmed) {
      console.log('❌ Operação cancelada pelo usuário.');
      return;
    }

    console.log('\n--- ETAPA 1: VERIFICANDO PERFIL DE MARCA ---');
    const brandProfile = await prisma.brandProfile.findUnique({
      where: { id: testIds.brandProfileId },
    });

    if (!brandProfile) {
      console.error(`\n❌ ERRO: Nenhum Perfil de Marca foi encontrado com o ID: ${testIds.brandProfileId}`);
      console.error('Certifique-se de criar o perfil de marca de teste primeiro.');
      return;
    }

    console.log(`✅ Perfil de marca encontrado: ${brandProfile.brandName}`);

    console.log('\n--- ETAPA 2: VERIFICANDO SESSÃO DE MONITORAMENTO ---');
    const monitoringSession = await prisma.monitoringSession.findUnique({
      where: { id: testIds.monitoringSessionId },
    });

    if (!monitoringSession) {
      console.error(`\n❌ ERRO: Nenhuma Sessão de Monitoramento foi encontrada com o ID: ${testIds.monitoringSessionId}`);
      console.error('Certifique-se de criar a sessão de monitoramento de teste primeiro.');
      return;
    }

    console.log(`✅ Sessão de monitoramento encontrada: ${monitoringSession.name}`);

    console.log('\n--- ETAPA 3: CRIANDO CONTEÚDO DE TESTE ---');
    const newDetectedContent = await prisma.detectedContent.create({
      data: {
        title: `Conteúdo de Teste - ${new Date().toISOString()}`,
        infringingUrl: testContent.infringingUrl,
        platform: testContent.platform,
        contentType: testContent.contentType,
        isConfirmed: false,
        
        // Conectando todas as relações obrigatórias
        user: { connect: { id: brandProfile.userId } },
        brandProfile: { connect: { id: testIds.brandProfileId } },
        monitoringSession: { connect: { id: testIds.monitoringSessionId } },
      }
    });

    console.log('\n✅ SUCESSO! Conteúdo de teste criado:');
    console.log(`- ID: ${newDetectedContent.id}`);
    console.log(`- Título: ${newDetectedContent.title}`);
    console.log(`- URL: ${newDetectedContent.infringingUrl}`);
    console.log(`- Plataforma: ${newDetectedContent.platform}`);
    console.log(`- Tipo: ${newDetectedContent.contentType}`);

  } catch (error) {
    console.error('\n❌ ERRO durante a execução:', error);
    console.error('\nDica: Verifique se os IDs de teste estão corretos no arquivo .env');
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