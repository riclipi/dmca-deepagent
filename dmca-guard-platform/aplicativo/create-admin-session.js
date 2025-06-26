const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function ensureAdminUser() {
  try {
    console.log('🔐 Ensuring admin user exists...\n')
    
    // Check if admin user exists
    let adminUser = await prisma.user.findUnique({
      where: { email: 'admin@dmcaguard.com' }
    })

    if (!adminUser) {
      console.log('Creating admin user...')
      const hashedPassword = await bcrypt.hash('admin123', 12)
      
      adminUser = await prisma.user.create({
        data: {
          email: 'admin@dmcaguard.com',
          name: 'System Admin',
          password: hashedPassword,
          planType: 'SUPER_USER',
          status: 'ACTIVE',
          emailVerified: new Date()
        }
      })
      console.log('✅ Admin user created!')
    } else {
      console.log('✅ Admin user already exists!')
    }

    console.log('\n📝 Admin credentials:')
    console.log('Email: admin@dmcaguard.com')
    console.log('Password: admin123')
    console.log('Plan: SUPER_USER')
    console.log('Status: ACTIVE')
    
    console.log('\n🌐 To access admin panel:')
    console.log('1. Go to http://localhost:3000/auth/login')
    console.log('2. Login with the credentials above')
    console.log('3. Navigate to http://localhost:3000/admin')

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

ensureAdminUser()
