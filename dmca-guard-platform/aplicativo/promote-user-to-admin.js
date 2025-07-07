const { PrismaClient } = require('@prisma/client');
const { 
  validateTestEnvironment, 
  getTestIds,
  logTestHeader,
  confirmAction 
} = require('./lib/test-utils');

const prisma = new PrismaClient();

async function promoteUserToAdmin() {
  // Validate test environment
  validateTestEnvironment();
  
  // Log script header
  logTestHeader('PROMOTE USER TO ADMIN');

  try {
    // Get user ID from environment
    const testIds = getTestIds();
    const userId = testIds.userId;
    
    console.log('🔍 Verificando usuário...\n');
    console.log(`📋 Configuração:`);
    console.log(`- User ID: ${userId}`);
    console.log('');
    
    // Find current user
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        planType: true,
        status: true
      }
    });

    if (!currentUser) {
      console.error(`❌ Usuário não encontrado com ID: ${userId}`);
      console.error('Verifique se o TEST_USER_ID está configurado corretamente.');
      return;
    }

    console.log('📋 Usuário encontrado:');
    console.log(`- Nome: ${currentUser.name || 'Sem nome'}`);
    console.log(`- Email: ${currentUser.email}`);
    console.log(`- Plano atual: ${currentUser.planType}`);
    console.log(`- Status atual: ${currentUser.status}`);
    
    // Check if already admin
    if (currentUser.planType === 'SUPER_USER') {
      console.log('\n✅ Usuário já é administrador!');
      return;
    }
    
    // Confirm promotion
    const confirmed = await confirmAction('Isso promoverá o usuário para SUPER_USER (administrador).');
    if (!confirmed) {
      console.log('❌ Operação cancelada pelo usuário.');
      return;
    }
    
    console.log('\n🔄 Promovendo para administrador...');
    
    // Update to admin
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        planType: 'SUPER_USER',
        status: 'ACTIVE'
      },
      select: {
        id: true,
        email: true,
        name: true,
        planType: true,
        status: true
      }
    });

    console.log('\n✅ Usuário promovido com sucesso!');
    console.log('📋 Dados atualizados:');
    console.log(`- ID: ${updatedUser.id}`);
    console.log(`- Nome: ${updatedUser.name || 'Sem nome'}`);
    console.log(`- Email: ${updatedUser.email}`);
    console.log(`- Plano: ${updatedUser.planType}`);
    console.log(`- Status: ${updatedUser.status}`);
    console.log(`- Acesso Admin: ✅ SIM`);
    
    console.log('\n🌐 Agora você pode acessar:');
    console.log(`- Painel Admin: ${process.env.BASE_URL || 'http://localhost:3000'}/admin`);
    console.log('- (Faça logout e login novamente se necessário)');

  } catch (error) {
    console.error('❌ Erro ao promover usuário:', error);
    console.error('\nDica: Verifique se o TEST_USER_ID está configurado corretamente.');
  } finally {
    await prisma.$disconnect();
    console.log('\n--- SCRIPT FINALIZADO ---');
  }
}

// Execute only if called directly
if (require.main === module) {
  promoteUserToAdmin().catch(console.error);
}

module.exports = promoteUserToAdmin;