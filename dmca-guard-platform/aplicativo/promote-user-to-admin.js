const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function promoteUserToAdmin() {
  try {
    const userId = 'cmbu5dsr700008kt9qdf5th1x'
    
    console.log('🔍 Verificando usuário atual...\n')
    
    // Buscar usuário atual
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        planType: true,
        status: true
      }
    })

    if (!currentUser) {
      console.log('❌ Usuário não encontrado!')
      return
    }

    console.log('📋 Usuário encontrado:')
    console.log(`- ID: ${currentUser.id}`)
    console.log(`- Nome: ${currentUser.name || 'Sem nome'}`)
    console.log(`- Email: ${currentUser.email}`)
    console.log(`- Plano atual: ${currentUser.planType}`)
    console.log(`- Status atual: ${currentUser.status}`)
    
    console.log('\n🔄 Promovendo para administrador...')
    
    // Atualizar para admin
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
    })

    console.log('\n✅ Usuário promovido com sucesso!')
    console.log('📋 Dados atualizados:')
    console.log(`- ID: ${updatedUser.id}`)
    console.log(`- Nome: ${updatedUser.name || 'Sem nome'}`)
    console.log(`- Email: ${updatedUser.email}`)
    console.log(`- Plano: ${updatedUser.planType}`)
    console.log(`- Status: ${updatedUser.status}`)
    console.log(`- Acesso Admin: ✅ SIM`)
    
    console.log('\n🌐 Agora você pode acessar:')
    console.log('- Painel Admin: http://localhost:3000/admin')
    console.log('- (Faça logout e login novamente se necessário)')

  } catch (error) {
    console.error('❌ Erro ao promover usuário:', error)
  } finally {
    await prisma.$disconnect()
  }
}

promoteUserToAdmin()
