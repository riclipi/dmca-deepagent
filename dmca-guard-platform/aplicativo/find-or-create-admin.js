const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { 
  validateTestEnvironment, 
  getTestIds,
  getTestCredentials,
  logTestHeader,
  confirmAction 
} = require('./lib/test-utils');

const prisma = new PrismaClient();

async function findOrCreateAdmin() {
  // Validate test environment
  validateTestEnvironment();
  
  // Log script header
  logTestHeader('FIND OR CREATE ADMIN USER');

  try {
    // Get admin user ID from environment
    const testIds = getTestIds();
    const targetUserId = testIds.adminUserId;
    const credentials = getTestCredentials();
    
    console.log('🔍 Buscando usuário admin específico...\n');
    console.log(`📋 Configuração:`);
    console.log(`- Admin User ID: ${targetUserId}`);
    console.log(`- Admin Email: ${credentials.adminUser.email}`);
    console.log('');
    
    // List all users for debugging (in test environment only)
    if (process.env.NODE_ENV !== 'production') {
      console.log('📋 Listando todos os usuários (apenas em ambiente de teste):');
      const allUsers = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          planType: true,
          status: true
        }
      });
      
      allUsers.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name || 'Sem nome'} (${user.email || 'Sem email'})`);
        console.log(`   ID: ${user.id}`);
        console.log(`   Plano: ${user.planType}`);
        console.log('');
      });
    }

    // Find specific user
    let targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });

    if (targetUser) {
      console.log('✅ Usuário encontrado! Atualizando privilégios...');
      
      // Confirm before updating
      const confirmed = await confirmAction('Isso promoverá o usuário para SUPER_USER.');
      if (!confirmed) {
        console.log('❌ Operação cancelada pelo usuário.');
        return;
      }
      
      // Update to admin
      targetUser = await prisma.user.update({
        where: { id: targetUserId },
        data: {
          planType: 'SUPER_USER',
          status: 'ACTIVE'
        }
      });
      
      console.log('✅ Usuário promovido para admin!');
    } else {
      console.log('❌ Usuário não encontrado. Criando novo usuário admin...');
      
      // Confirm before creating
      const confirmed = await confirmAction('Isso criará um novo usuário admin de teste.');
      if (!confirmed) {
        console.log('❌ Operação cancelada pelo usuário.');
        return;
      }
      
      // Create new user with specified ID
      const hashedPassword = await bcrypt.hash(credentials.adminUser.password, 12);
      
      targetUser = await prisma.user.create({
        data: {
          id: targetUserId,
          email: credentials.adminUser.email,
          name: 'Test Admin User',
          password: hashedPassword,
          planType: 'SUPER_USER',
          status: 'ACTIVE',
          emailVerified: true
        }
      });
      
      console.log('✅ Novo usuário admin criado!');
    }

    console.log('\n📋 Dados finais do usuário:');
    console.log(`- ID: ${targetUser.id}`);
    console.log(`- Nome: ${targetUser.name}`);
    console.log(`- Email: ${targetUser.email}`);
    console.log(`- Plano: ${targetUser.planType}`);
    console.log(`- Status: ${targetUser.status}`);
    console.log(`- Acesso Admin: ✅ SIM`);
    
    console.log('\n🌐 Acesso ao painel admin:');
    console.log(`- URL: ${process.env.BASE_URL || 'http://localhost:3000'}/admin`);
    console.log(`- Email: ${targetUser.email}`);
    console.log(`- Senha: ${credentials.adminUser.password} (apenas para teste)`);
    console.log('\n⚠️  AVISO: Nunca use senhas fracas em produção!');

  } catch (error) {
    console.error('❌ Erro:', error);
    console.error('\nDica: Verifique se o TEST_ADMIN_USER_ID está configurado corretamente.');
  } finally {
    await prisma.$disconnect();
  }
}

// Execute only if called directly
if (require.main === module) {
  findOrCreateAdmin().catch(console.error);
}

module.exports = findOrCreateAdmin;