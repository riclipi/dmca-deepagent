const { PrismaClient } = require('@prisma/client');

async function main() {
  const prisma = new PrismaClient();

  // Obter IDs e email das variáveis de ambiente
  const userId = process.env.TEST_USER_ID;
  const detectedContentId = process.env.TEST_DETECTED_CONTENT_ID;
  const recipientEmail = process.env.TEST_RECIPIENT_EMAIL;

  if (!userId || !detectedContentId || !recipientEmail) {
    console.error('❌ Erro: Variáveis de ambiente obrigatórias não configuradas');
    console.error('');
    console.error('Configure as seguintes variáveis de ambiente:');
    console.error('  TEST_USER_ID=id-do-usuario');
    console.error('  TEST_DETECTED_CONTENT_ID=id-do-conteudo');
    console.error('  TEST_RECIPIENT_EMAIL=email@exemplo.com');
    console.error('');
    console.error('Exemplo:');
    console.error('  TEST_USER_ID=abc123 TEST_DETECTED_CONTENT_ID=xyz789 TEST_RECIPIENT_EMAIL=test@example.com node scripts/create-test-email-ricardo.js');
    process.exit(1);
  }

  console.log(`🔥 CRIANDO EMAIL DE TESTE PARA ${recipientEmail}...`);

  try {
    const takedown = await prisma.takedownRequest.create({
      data: {
        userId,
        detectedContentId,
        platform: 'WEBSITE',
        recipientEmail,
        subject: 'DMCA Takedown Notice - Teste Real DMCA Guard',
        message: `
<!DOCTYPE html>
<html>
<head>
    <title>DMCA Takedown Notice</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .header { background: #f4f4f4; padding: 20px; text-align: center; }
        .content { padding: 20px; }
        .footer { background: #f4f4f4; padding: 10px; text-align: center; font-size: 12px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔒 DMCA Guard - Notificação de Violação de Direitos Autorais</h1>
    </div>
    
    <div class="content">
        <p><strong>Olá,</strong></p>
        
        <p>Este é um <strong>teste real</strong> do sistema DMCA Guard que você desenvolveu!</p>
        
        <p>🎉 <strong>PARABÉNS!</strong> O sistema de envio de emails está funcionando perfeitamente.</p>
        
        <h3>Detalhes da Violação (Teste):</h3>
        <ul>
            <li><strong>URL Infratora:</strong> https://www.site-exemplo.com/conteudo-teste</li>
            <li><strong>Plataforma:</strong> Website</li>
            <li><strong>Tipo:</strong> Imagem</li>
            <li><strong>Data de Detecção:</strong> ${new Date().toLocaleDateString('pt-BR')}</li>
        </ul>
        
        <p>🚀 <strong>Seu MVP está completo e funcional!</strong></p>
        
        <p>Funcionalidades validadas:</p>
        <ul>
            <li>✅ Dashboard operacional</li>
            <li>✅ Detecção de conteúdo</li>
            <li>✅ Criação de takedown requests</li>
            <li>✅ Envio de emails via Resend</li>
            <li>✅ Atualização de status no banco</li>
        </ul>
    </div>
    
    <div class="footer">
        <p>Este email foi enviado automaticamente pelo sistema DMCA Guard</p>
        <p>Desenvolvido com ❤️ pela equipe DMCA Guard</p>
    </div>
</body>
</html>
        `,
        status: 'PENDING',
        attempts: 0
      }
    });

    console.log('✅ TakedownRequest criada para seu email:', takedown.id);
    console.log('📧 Email destinatário:', takedown.recipientEmail);
    console.log('🔗 Para enviar, use:', `curl -X POST http://localhost:3000/api/takedown-requests/${takedown.id}/send`);
    
    return takedown.id;
  } catch (error) {
    console.error('❌ ERRO:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();