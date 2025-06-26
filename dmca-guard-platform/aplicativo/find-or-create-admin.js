const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function findOrCreateAdmin() {
  try {
    const targetUserId = 'cmbu5dsr700008kt9qdf5th1x'
    
    console.log('🔍 Buscando usuário específico...\n')
    
    // Primeiro, listar TODOS os usuários para debug
    console.log('📋 Todos os usuários no banco:')
    const allUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        planType: true,
        status: true
      }
    })
    
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || 'Sem nome'} (${user.email || 'Sem email'})`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Plano: ${user.planType}`)
      console.log('')
    })

    // Buscar usuário específico
    let targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    })

    if (targetUser) {
      console.log('✅ Usuário encontrado! Atualizando privilégios...')
      
      // Atualizar para admin
      targetUser = await prisma.user.update({
        where: { id: targetUserId },
        data: {
          planType: 'SUPER_USER',
          status: 'ACTIVE'
        }
      })
      
      console.log('✅ Usuário promovido para admin!')
    } else {
      console.log('❌ Usuário não encontrado. Criando novo usuário admin...')
      
      // Criar novo usuário com o ID especificado
      const hashedPassword = await bcrypt.hash('admin123', 12)
      
      targetUser = await prisma.user.create({
        data: {
          id: targetUserId,
          email: 'current.user@dmcaguard.com',
          name: 'Current User (Admin)',
          password: hashedPassword,
          planType: 'SUPER_USER',
          status: 'ACTIVE',
          emailVerified: true
        }
      })
      
      console.log('✅ Novo usuário admin criado!')
    }

    console.log('\n📋 Dados finais do usuário:')
    console.log(`- ID: ${targetUser.id}`)
    console.log(`- Nome: ${targetUser.name}`)
    console.log(`- Email: ${targetUser.email}`)
    console.log(`- Plano: ${targetUser.planType}`)
    console.log(`- Status: ${targetUser.status}`)
    console.log(`- Acesso Admin: ✅ SIM`)
    
    console.log('\n🌐 Acesso ao painel admin:')
    console.log('- URL: http://localhost:3000/admin')
    console.log('- Faça logout e login novamente se necessário')

  } catch (error) {
    console.error('❌ Erro:', error)
  } finally {
    await prisma.$disconnect()
  }
}

findOrCreateAdmin()
