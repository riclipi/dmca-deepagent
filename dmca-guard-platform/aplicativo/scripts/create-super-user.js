#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function createSuperUser() {
  console.log('🔧 DMCA Guard - Criando Super User em Produção');
  console.log('===============================================');
  console.log('');

  const superUserEmail = process.env.SUPER_USER_EMAIL || 'larys.cubas@hotmail.com';
  const superUserName = 'Lary Cubas';
  const superUserPassword = 'DmcaGuard2024!';

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
    console.log(`🔑 Senha: ${superUserPassword}`);
    console.log(`🏆 Plano: ${superUser.planType}`);
    console.log('');
    console.log('⚠️  IMPORTANTE: Altere a senha no primeiro login!');

  } catch (error) {
    console.error('❌ Erro ao criar Super User:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

createSuperUser();