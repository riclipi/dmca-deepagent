const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

async function checkUsers() {
  try {
    console.log('🔍 Checking all users and their permissions...\n')
    
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        planType: true,
        status: true,
        createdAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    console.log(`Found ${users.length} users:\n`)
    
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name || 'No name'} (${user.email})`)
      console.log(`   ID: ${user.id}`)
      console.log(`   Plan: ${user.planType}`)
      console.log(`   Status: ${user.status}`)
      console.log(`   Admin Access: ${user.planType === 'SUPER_USER' && user.status === 'ACTIVE' ? '✅ YES' : '❌ NO'}`)
      console.log(`   Created: ${user.createdAt.toISOString()}`)
      console.log('')
    })

    console.log('\n📋 Summary:')
    console.log(`- Total users: ${users.length}`)
    console.log(`- Active users: ${users.filter(u => u.status === 'ACTIVE').length}`)
    console.log(`- Admin users: ${users.filter(u => u.planType === 'SUPER_USER' && u.status === 'ACTIVE').length}`)
    
  } catch (error) {
    console.error('❌ Error checking users:', error)
  } finally {
    await prisma.$disconnect()
  }
}

checkUsers()
