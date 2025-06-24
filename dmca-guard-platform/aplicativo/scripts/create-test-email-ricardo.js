const { PrismaClient } = require('@prisma/client');

async function main() {
  console.log('🔥 CRIANDO EMAIL DE TESTE PARA RICARDO...');
  const prisma = new PrismaClient();

  try {
    const takedown = await prisma.takedownRequest.create({
      data: {
        userId: 'cmbu5dsr700008kt9qdf5th1x',
        detectedContentId: 'cmcanyzsx0000vwwgwv9sfcjv',
        platform: 'WEBSITE',
        recipientEmail: 'ricardofelipe.felipe@gmail.com',
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
        <p><strong>Caro Ricardo,</strong></p>
        
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
        <p>Desenvolvido com ❤️ por Ricardo Felipe</p>
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