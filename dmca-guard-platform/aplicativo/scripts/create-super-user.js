#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createSuperUser() {
  console.log('🔧 DMCA Guard - Criando Super User em Produção');
  console.log('===============================================');
  console.log('');

  // Obter credenciais das variáveis de ambiente
  const superUserEmail = process.env.SUPER_USER_EMAIL;
  const superUserName = process.env.SUPER_USER_NAME;
  const superUserPassword = process.env.SUPER_USER_PASSWORD;

  // Validar que todas as variáveis estão configuradas
  if (!superUserEmail || !superUserName || !superUserPassword) {
    console.error('❌ Erro: Variáveis de ambiente obrigatórias não configuradas');
    console.error('');
    console.error('Configure as seguintes variáveis de ambiente:');
    console.error('  SUPER_USER_EMAIL=email@exemplo.com');
    console.error('  SUPER_USER_NAME="Nome do Usuário"');
    console.error('  SUPER_USER_PASSWORD="SenhaSegura123!"');
    console.error('');
    console.error('Exemplo:');
    console.error('  SUPER_USER_EMAIL=admin@dmcaguard.com SUPER_USER_NAME="Admin DMCA" SUPER_USER_PASSWORD="SuperSecure2024!" node scripts/create-super-user.js');
    process.exit(1);
  }

  try {
    // Verificar se usuário já existe
    const existingUser = await prisma.user.findUnique({
      where: { email: superUserEmail }
    });

    if (existingUser) {
      console.log(`✅ Super User já existe: ${superUserEmail}`);
      
      // Atualizar para SUPER_USER se necessário
      if (existingUser.planType !== 'SUPER_USER') {
        await prisma.user.update({
          where: { email: superUserEmail },
          data: { 
            planType: 'SUPER_USER',
            status: 'ACTIVE'
          }
        });
        console.log('✅ Usuário atualizado para SUPER_USER');
      }
      
      return;
    }

    // Criar hash da senha
    const hashedPassword = await bcrypt.hash(superUserPassword, 12);

    // Criar Super User
    const superUser = await prisma.user.create({
      data: {
        email: superUserEmail,
        name: superUserName,
        password: hashedPassword,
        planType: 'SUPER_USER',
        status: 'ACTIVE',
        emailVerified: true,
        emailVerifiedAt: new Date()
      }
    });

    console.log('✅ Super User criado com sucesso!');
    console.log(`📧 Email: ${superUser.email}`);
    console.log(`👤 Nome: ${superUser.name}`);
    console.log(`🏆 Plano: ${superUser.planType}`);
    console.log('');
    console.log('⚠️  IMPORTANTE: Guarde as credenciais em local seguro e altere a senha no primeiro login!');

  } catch (error) {
    console.error('❌ Erro ao criar Super User:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createSuperUser();