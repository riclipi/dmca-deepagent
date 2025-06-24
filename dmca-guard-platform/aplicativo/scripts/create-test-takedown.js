const { PrismaClient } = require('@prisma/client');

async function main() {
  console.log('🔥 CRIANDO TAKEDOWN REQUEST PARA TESTE DE EMAIL...');
  const prisma = new PrismaClient();

  try {
    const detectedContentId = 'cmcanyzsx0000vwwgwv9sfcjv';
    const userId = 'cmbu5dsr700008kt9qdf5th1x';
    
    // Criar takedown request
    const takedown = await prisma.takedownRequest.create({
      data: {
        userId: userId,
        detectedContentId: detectedContentId,
        platform: 'WEBSITE',
        recipientEmail: 'test@example.com',
        subject: 'DMCA Takedown Notice - Test',
        message: `
<!DOCTYPE html>
<html>
<head>
    <title>DMCA Takedown Notice</title>
</head>
<body>
    <h1>DMCA Takedown Notice</h1>
    <p>Dear Test Recipient,</p>
    
    <p>This is a test notification regarding copyright infringement detected at:</p>
    <p><strong>URL:</strong> https://www.site-infrator-exemplo.com/conteudo-vazado</p>
    
    <p>Please remove this content within 24 hours.</p>
    
    <p>Best regards,<br/>DMCA Guard Team</p>
</body>
</html>
        `,
        status: 'PENDING',
        attempts: 0
      }
    });

    console.log('✅ TAKEDOWN REQUEST CRIADA:', takedown.id);
    console.log('📧 Email destinatário:', takedown.recipientEmail);
    console.log('🔗 Para testar envio, use:', `curl -X POST http://localhost:3000/api/takedown-requests/${takedown.id}/send`);
    
    return takedown.id;
  } catch (error) {
    console.error('❌ ERRO:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();