const { PrismaClient } = require('@prisma/client');
const { 
  validateTestEnvironment, 
  getTestIds,
  getTestContent,
  logTestHeader,
  confirmAction,
  generateTestId 
} = require('../lib/test-utils');

async function main() {
  // Validate test environment
  validateTestEnvironment();
  
  // Log script header
  logTestHeader('CREATE TEST TAKEDOWN REQUEST');

  const prisma = new PrismaClient();

  try {
    // Get test IDs from environment
    const testIds = getTestIds();
    const testContent = getTestContent();
    
    console.log('📋 Configuração do teste:');
    console.log(`- User ID: ${testIds.userId}`);
    console.log(`- Detected Content ID: ${testIds.detectedContentId}`);
    console.log('');
    
    // Confirm action
    const confirmed = await confirmAction('Isso criará uma solicitação de takedown de teste.');
    if (!confirmed) {
      console.log('❌ Operação cancelada pelo usuário.');
      return;
    }

    // Verify detected content exists
    const detectedContent = await prisma.detectedContent.findUnique({
      where: { id: testIds.detectedContentId }
    });

    if (!detectedContent) {
      console.error(`\n❌ ERRO: Conteúdo detectado não encontrado com ID: ${testIds.detectedContentId}`);
      console.error('Execute o script seed-test-content.js primeiro para criar conteúdo de teste.');
      return;
    }

    console.log(`✅ Conteúdo detectado encontrado: ${detectedContent.title}`);
    
    // Create takedown request
    const takedownEmail = process.env.TEST_TAKEDOWN_EMAIL || 'test@example.com';
    const takedown = await prisma.takedownRequest.create({
      data: {
        userId: testIds.userId,
        detectedContentId: testIds.detectedContentId,
        platform: testContent.platform,
        recipientEmail: takedownEmail,
        subject: `DMCA Takedown Notice - Test ${generateTestId('takedown')}`,
        message: `
<!DOCTYPE html>
<html>
<head>
    <title>DMCA Takedown Notice - Test</title>
</head>
<body>
    <h1>DMCA Takedown Notice (TEST)</h1>
    <p>Dear Test Recipient,</p>
    
    <p><strong>THIS IS A TEST NOTIFICATION - NO ACTION REQUIRED</strong></p>
    
    <p>This is a test notification regarding copyright infringement detected at:</p>
    <p><strong>URL:</strong> ${testContent.infringingUrl}</p>
    
    <p>In a real scenario, this would be a formal DMCA takedown request.</p>
    
    <p>Test generated at: ${new Date().toISOString()}</p>
    
    <p>Best regards,<br/>DMCA Guard Test Team</p>
</body>
</html>
        `,
        status: 'PENDING',
        attempts: 0
      }
    });

    console.log('\n✅ TAKEDOWN REQUEST CRIADA COM SUCESSO!');
    console.log(`- ID: ${takedown.id}`);
    console.log(`- Email destinatário: ${takedown.recipientEmail}`);
    console.log(`- Status: ${takedown.status}`);
    console.log(`- Plataforma: ${takedown.platform}`);
    
    if (process.env.SKIP_EMAIL_SENDING !== 'true') {
      console.log('\n📧 Para testar envio de email:');
      console.log(`curl -X POST ${process.env.BASE_URL || 'http://localhost:3000'}/api/takedown-requests/${takedown.id}/send`);
    } else {
      console.log('\n⏭️ Envio de email desabilitado em ambiente de teste.');
    }
    
    return takedown.id;
  } catch (error) {
    console.error('\n❌ ERRO:', error);
    console.error('\nDica: Verifique se todos os IDs de teste estão configurados corretamente.');
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